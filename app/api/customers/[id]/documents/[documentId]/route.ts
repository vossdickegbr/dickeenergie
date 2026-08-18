import { NextResponse } from 'next/server'
import { CUSTOMER_DOCUMENT_BUCKET } from '@/lib/company-config'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await context.params
    const client = await createSupabaseServerClient()
    await requireTeamProfile(client)
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.from('customer_documents').select('file_name,storage_path,mime_type').eq('id', documentId).eq('customer_id', id).maybeSingle()
    if (error || !data) throw new Error('Dokument nicht gefunden.')
    const { data: file, error: fileError } = await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).download(data.storage_path)
    if (fileError || !file) throw new Error('Dokument konnte nicht geladen werden.')
    return new Response(Buffer.from(await file.arrayBuffer()), {
      headers: {
        'Content-Type': data.mime_type,
        'Content-Disposition': `attachment; filename="${String(data.file_name).replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dokument konnte nicht geladen werden.' }, { status: 404 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await context.params
    const client = await createSupabaseServerClient()
    const actor = await requireTeamProfile(client)
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.from('customer_documents').select('kind,storage_path').eq('id', documentId).eq('customer_id', id).maybeSingle()
    if (error || !data) throw new Error('Dokument nicht gefunden.')
    if (data.kind === 'privacy_notice') throw new Error('Der Datenschutz-Nachweis wird nur zusammen mit der Kundenkartei gelöscht.')
    const { error: storageError } = await admin.storage.from(CUSTOMER_DOCUMENT_BUCKET).remove([data.storage_path])
    if (storageError) throw storageError
    const { error: metaError } = await admin.from('customer_documents').delete().eq('id', documentId).eq('customer_id', id)
    if (metaError) throw metaError
    await admin.from('audit_log').insert({ actor_profile_id: actor.profileId, action: 'customer.document_deleted', entity_type: 'customer', entity_id: id, details: { documentId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dokument konnte nicht gelöscht werden.' }, { status: 400 })
  }
}
