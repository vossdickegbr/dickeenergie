import { NextResponse } from 'next/server'
import type { Customer } from '@/lib/types'
import { buildSignedCustomerPrivacyPdf, getCustomerDocument } from '@/lib/customer-privacy'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamProfile } from '@/lib/supabase/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const client = await createSupabaseServerClient()
    await requireTeamProfile(client)
    const { data, error } = await client.from('app_records').select('payload').eq('id', id).eq('record_type', 'customer').maybeSingle()
    if (error || !data) throw new Error('Kunde nicht gefunden.')
    const customer = data.payload as Customer
    if (!customer.privacyReceipt) throw new Error('Kein Datenschutz-Nachweis vorhanden.')
    const bytes = customer.privacyReceipt.inlinePdfBase64
      ? new Uint8Array(Buffer.from(customer.privacyReceipt.inlinePdfBase64, 'base64'))
      : customer.privacyReceipt.signatureDataUrl
        ? await buildSignedCustomerPrivacyPdf(customer, customer.privacyReceipt.signatureDataUrl, customer.privacyReceipt.acknowledgedBy)
        : (await getCustomerDocument(customer.privacyReceipt.documentId, customer.id)).bytes
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${customer.privacyReceipt.fileName.replace(/"/g, '')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dokument konnte nicht geladen werden.' }, { status: 404 })
  }
}
