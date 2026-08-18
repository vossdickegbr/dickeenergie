import { NextRequest, NextResponse } from 'next/server'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isOnlineIntakeExpired, mapOnlineIntakeRow, type OnlineCustomerIntakeRow } from '@/lib/online-customer-intake'

export const dynamic = 'force-dynamic'

const safeColumns = [
  'id', 'reserved_customer_id', 'created_by', 'status', 'customer_payload', 'privacy_notice_version',
  'expires_at', 'email_sent_at', 'opened_at', 'email_verified_at', 'privacy_accepted_at', 'signed_at',
  'completed_at', 'finalized_at', 'delivery_error', 'privacy_email_status', 'privacy_email_sent_at',
  'privacy_email_error', 'final_customer_id', 'created_at', 'updated_at',
].join(',')

type SafeOnlineIntakeRow = Omit<OnlineCustomerIntakeRow,
  'token_hash' | 'verification_code_hash' | 'verification_attempts' | 'signature_data_url' | 'privacy_receipt'
>

function mapSafeRow(row: SafeOnlineIntakeRow) {
  return mapOnlineIntakeRow({ ...row, signature_data_url: null, privacy_receipt: null })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const client = await createSupabaseServerClient()
    await requireTeamProfile(client)
    const { id } = await context.params
    const { data, error } = await client.from('online_customer_intakes').select(safeColumns).eq('id', id).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ ok: false, error: 'Online-Aufnahme nicht gefunden.' }, { status: 404 })

    let row = data as unknown as SafeOnlineIntakeRow
    if (!['completed', 'finalized', 'expired'].includes(row.status) && isOnlineIntakeExpired(row.expires_at)) {
      const { data: expired, error: updateError } = await client
        .from('online_customer_intakes')
        .update({ status: 'expired', delivery_error: 'Der Kundenlink ist abgelaufen.' })
        .eq('id', id)
        .select(safeColumns)
        .single()
      if (updateError) throw updateError
      row = expired as unknown as SafeOnlineIntakeRow
    }

    return NextResponse.json({ ok: true, intake: mapSafeRow(row) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Status konnte nicht geladen werden.'
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
