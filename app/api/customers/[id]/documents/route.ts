import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { CUSTOMER_DOCUMENT_BUCKET } from '@/lib/company-config'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { ensureCustomerDocumentBucket, readableStorageError } from '@/lib/customer-privacy'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { makeId, nowIso } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const client = await createSupabaseServerClient()
    await requireTeamProfile(client)
    const { data, error } = await client.from('customer_documents')
      .select('id,customer_id,kind,file_name,mime_type,size_bytes,sha256,created_at')
      .eq('customer_id', id).order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ ok: true, documents: data ?? [] }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dokumente konnten nicht geladen werden.' }, { status: 401 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: customerId } = await context.params
    const client = await createSupabaseServerClient()
    const actor = await requireTeamProfile(client)
    const { data: customer, error: customerError } = await client.from('app_records').select('id').eq('id', customerId).eq('record_type', 'customer').maybeSingle()
    if (customerError || !customer) throw new Error('Kunde nicht gefunden.')

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new Error('Keine Datei ausgewählt.')
    if (!allowedTypes.has(file.type)) throw new Error('Erlaubt sind PDF-, PNG-, JPG- und WebP-Dateien.')
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('Die Datei darf höchstens 10 MB groß sein.')

    const bytes = new Uint8Array(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const documentId = makeId('document')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160) || 'Dokument'
    const storagePath = `${customerId}/attachments/${documentId}-${safeName}`
    const admin = createSupabaseAdminClient()
    await ensureCustomerDocumentBucket(admin)
    const { error: uploadError } = await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).upload(storagePath, Buffer.from(bytes), {
      contentType: file.type,
      cacheControl: '0',
      upsert: false,
    })
    if (uploadError) throw new Error(readableStorageError(uploadError.message))

    const createdAt = nowIso()
    const { error: metaError } = await admin.from('customer_documents').insert({
      id: documentId,
      customer_id: customerId,
      kind: 'customer_attachment',
      file_name: safeName,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      sha256,
      created_by: actor.profileId,
      created_at: createdAt,
    })
    if (metaError) {
      await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).remove([storagePath])
      throw new Error(readableStorageError(metaError.message))
    }
    await admin.from('audit_log').insert({ actor_profile_id: actor.profileId, action: 'customer.document_uploaded', entity_type: 'customer', entity_id: customerId, details: { documentId, mimeType: file.type, sizeBytes: file.size } })
    return NextResponse.json({ ok: true, document: { id: documentId, customer_id: customerId, kind: 'customer_attachment', file_name: safeName, mime_type: file.type, size_bytes: file.size, sha256, created_at: createdAt } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dokument konnte nicht gespeichert werden.' }, { status: 400 })
  }
}
