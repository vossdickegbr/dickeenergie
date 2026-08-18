import { NextRequest, NextResponse } from 'next/server'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  generateOnlineIntakeCode,
  generateOnlineIntakeToken,
  hashOnlineIntakeCode,
  hashOnlineIntakeToken,
  mapOnlineIntakeRow,
  sendOnlineIntakeLinkEmail,
  type OnlineCustomerIntakeRow,
} from '@/lib/online-customer-intake'
import { nowIso } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const client = await createSupabaseServerClient()
    await requireTeamProfile(client)
    const { id } = await context.params
    const { data, error } = await client.from('online_customer_intakes').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ ok: false, error: 'Online-Aufnahme nicht gefunden.' }, { status: 404 })
    const current = data as OnlineCustomerIntakeRow
    if (current.status === 'finalized') throw new Error('Diese Kundenkartei wurde bereits gespeichert.')
    if (current.status === 'completed') throw new Error('Der Kunde hat die Datenschutzinformation bereits bestätigt.')

    const token = generateOnlineIntakeToken()
    const code = generateOnlineIntakeCode()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const { error: prepareError } = await client.from('online_customer_intakes').update({
      status: 'email_pending',
      token_hash: hashOnlineIntakeToken(token),
      verification_code_hash: hashOnlineIntakeCode(code),
      verification_attempts: 0,
      expires_at: expiresAt,
      email_sent_at: null,
      opened_at: null,
      delivery_error: null,
    }).eq('id', id)
    if (prepareError) throw prepareError

    let status: 'email_sent' | 'failed' = 'email_sent'
    let deliveryError: string | null = null
    let emailSentAt: string | null = nowIso()
    try {
      await sendOnlineIntakeLinkEmail({
        customer: current.customer_payload,
        token,
        code,
        origin: request.nextUrl.origin,
        expiresAt,
      })
    } catch (error) {
      status = 'failed'
      emailSentAt = null
      deliveryError = error instanceof Error ? error.message : 'E-Mail konnte nicht versendet werden.'
    }

    const { data: updated, error: updateError } = await client.from('online_customer_intakes').update({
      status,
      email_sent_at: emailSentAt,
      delivery_error: deliveryError,
    }).eq('id', id).select('*').single()
    if (updateError || !updated) throw updateError ?? new Error('Versandstatus konnte nicht gespeichert werden.')

    return NextResponse.json({ ok: true, intake: mapOnlineIntakeRow(updated as OnlineCustomerIntakeRow) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'E-Mail konnte nicht erneut versendet werden.'
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
