import { NextResponse } from 'next/server'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { snapshotFromRows } from '@/lib/records'
import { mapOnlineIntakeRow } from '@/lib/online-customer-intake'
import type { OnlineCustomerIntakeRow } from '@/lib/online-customer-intake'

export const dynamic = 'force-dynamic'

const onlineIntakeColumns = [
  'id',
  'reserved_customer_id',
  'created_by',
  'status',
  'customer_payload',
  'privacy_notice_version',
  'expires_at',
  'email_sent_at',
  'opened_at',
  'email_verified_at',
  'privacy_accepted_at',
  'signed_at',
  'completed_at',
  'finalized_at',
  'delivery_error',
  'privacy_email_status',
  'privacy_email_sent_at',
  'privacy_email_error',
  'final_customer_id',
  'created_at',
  'updated_at',
].join(',')

export async function GET() {
  try {
    const client = await createSupabaseServerClient()
    const profile = await requireTeamProfile(client)
    const [{ data, error }, { data: intakeRows, error: intakeError }] = await Promise.all([
      client
        .from('app_records')
        .select('record_type,payload')
        .order('updated_at', { ascending: false }),
      client
        .from('online_customer_intakes')
        .select(onlineIntakeColumns)
        .order('updated_at', { ascending: false }),
    ])
    if (error) throw error
    if (intakeError) {
      const missingMigration = intakeError.message.toLowerCase().includes('online_customer_intakes')
      if (!missingMigration) throw intakeError
    }

    const snapshot = snapshotFromRows(data ?? [])
    snapshot.onlineCustomerIntakes = (intakeRows ?? []).map((row) => mapOnlineIntakeRow({
      ...(row as unknown as Omit<OnlineCustomerIntakeRow, 'token_hash' | 'verification_code_hash' | 'verification_attempts' | 'signature_data_url' | 'privacy_receipt'>),
      signature_data_url: null,
      privacy_receipt: null,
    }))

    return NextResponse.json({ ok: true, profileId: profile.profileId, snapshot })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Daten konnten nicht geladen werden.'
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
