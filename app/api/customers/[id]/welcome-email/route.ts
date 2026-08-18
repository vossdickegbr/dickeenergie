import { NextRequest, NextResponse } from 'next/server'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendCustomerWelcomeEmail, welcomeEmailFailure } from '@/lib/customer-welcome'
import type { Customer } from '@/lib/types'
import { nowIso } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const client = await createSupabaseServerClient()
    const actor = await requireTeamProfile(client)
    const { id } = await context.params
    const { data, error } = await client
      .from('app_records')
      .select('payload')
      .eq('id', id)
      .eq('record_type', 'customer')
      .maybeSingle()
    if (error) throw error
    if (!data?.payload) return NextResponse.json({ ok: false, error: 'Kunde nicht gefunden.' }, { status: 404 })

    const customer = data.payload as Customer
    let welcomeEmail
    try {
      welcomeEmail = await sendCustomerWelcomeEmail(customer)
    } catch (sendError) {
      welcomeEmail = welcomeEmailFailure(sendError, customer.email)
    }

    const updated: Customer = { ...customer, welcomeEmail, updatedAt: nowIso() }
    const { error: updateError } = await client.from('app_records').upsert({
      id: updated.id,
      record_type: 'customer',
      payload: updated,
      created_by: actor.profileId,
      updated_at: updated.updatedAt,
    }, { onConflict: 'id' })
    if (updateError) throw updateError

    try {
      await client.from('audit_log').insert({
        actor_profile_id: actor.profileId,
        action: welcomeEmail.status === 'sent' ? 'customer.welcome_email_sent' : 'customer.welcome_email_failed',
        entity_type: 'customer',
        entity_id: customer.id,
        details: {
          email: customer.email,
          status: welcomeEmail.status,
          resendId: welcomeEmail.resendId,
          error: welcomeEmail.error,
          manual: true,
        },
      })
    } catch { /* Der gespeicherte Versandstatus ist der maßgebliche Nachweis. */ }

    if (welcomeEmail.status !== 'sent') {
      return NextResponse.json({ ok: false, customer: updated, error: welcomeEmail.error ?? 'Dankes-E-Mail konnte nicht gesendet werden.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, customer: updated })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Dankes-E-Mail konnte nicht gesendet werden.' }, { status: 400 })
  }
}
