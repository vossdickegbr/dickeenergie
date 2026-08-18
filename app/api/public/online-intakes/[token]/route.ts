import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { hashOnlineIntakeToken, isOnlineIntakeExpired, type OnlineCustomerIntakeRow } from '@/lib/online-customer-intake'
import { nowIso } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`
}

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    if (!token || token.length < 20) return NextResponse.json({ ok: false, error: 'Link ist ungültig.' }, { status: 404 })
    const admin = createSupabaseAdminClient()
    const tokenHash = hashOnlineIntakeToken(token)
    const { data, error } = await admin.from('online_customer_intakes').select('*').eq('token_hash', tokenHash).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ ok: false, error: 'Link ist ungültig oder wurde ersetzt.' }, { status: 404 })
    let row = data as OnlineCustomerIntakeRow

    if (!['completed', 'finalized', 'expired'].includes(row.status) && isOnlineIntakeExpired(row.expires_at)) {
      const { data: expired, error: updateError } = await admin.from('online_customer_intakes').update({
        status: 'expired',
        delivery_error: 'Der Kundenlink ist abgelaufen.',
      }).eq('id', row.id).select('*').single()
      if (updateError) throw updateError
      row = expired as OnlineCustomerIntakeRow
    } else if (['email_sent', 'email_pending', 'failed'].includes(row.status) && !row.opened_at) {
      const openedAt = nowIso()
      const { data: opened, error: updateError } = await admin.from('online_customer_intakes').update({
        status: 'opened',
        opened_at: openedAt,
      }).eq('id', row.id).select('*').single()
      if (updateError) throw updateError
      row = opened as OnlineCustomerIntakeRow
    }

    return NextResponse.json({
      ok: true,
      intake: {
        status: row.status,
        name: row.customer_payload.name,
        emailMasked: maskEmail(row.customer_payload.email),
        expiresAt: row.expires_at,
        privacyNoticeVersion: row.privacy_notice_version,
        completedAt: row.completed_at,
        finalizedAt: row.finalized_at,
        deliveryError: row.delivery_error,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Link konnte nicht geladen werden.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
