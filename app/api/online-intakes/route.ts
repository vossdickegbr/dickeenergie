import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  generateOnlineIntakeCode,
  generateOnlineIntakeToken,
  hashOnlineIntakeCode,
  hashOnlineIntakeToken,
  mapOnlineIntakeRow,
  ONLINE_INTAKE_PRIVACY_VERSION,
  sendOnlineIntakeLinkEmail,
  type OnlineCustomerIntakeRow,
} from '@/lib/online-customer-intake'
import { makeId, nowIso } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name fehlt.').max(160),
  phone: z.string().trim().min(3, 'Telefonnummer fehlt.').max(40).refine((value) => /\d/.test(value), 'Telefonnummer fehlt.'),
  email: z.string().trim().email('E-Mail-Adresse ist ungültig.').max(254),
  street: z.string().trim().min(1, 'Straße fehlt.').max(160),
  houseNumber: z.string().trim().min(1, 'Hausnummer fehlt.').max(24),
  postalCode: z.string().trim().min(4, 'PLZ fehlt.').max(12),
  city: z.string().trim().min(1, 'Ort fehlt.').max(120),
  district: z.string().trim().min(1, 'Gebiet / Stadtteil fehlt.').max(120),
  serviceType: z.enum(['strom', 'gas', 'both']),
  salesOwner: z.enum(['voss', 'dicke', 'both']),
  commissionAmountCents: z.number().int().positive('Provision fehlt.').max(100_000_000),
  followUpAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Wiedervorlage fehlt.'),
  weekId: z.string().trim().min(1).max(140),
  dayId: z.string().trim().min(1).max(140),
}).strict()

export async function POST(request: NextRequest) {
  try {
    const client = await createSupabaseServerClient()
    const actor = await requireTeamProfile(client)
    const input = createSchema.parse(await request.json())
    const now = nowIso()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const token = generateOnlineIntakeToken()
    const code = generateOnlineIntakeCode()
    const id = makeId('online_intake')
    const reservedCustomerId = makeId('customer')
    const customerPayload = {
      ...input,
      email: input.email.toLowerCase(),
      source: 'online' as const,
    }

    const { data: inserted, error: insertError } = await client
      .from('online_customer_intakes')
      .insert({
        id,
        reserved_customer_id: reservedCustomerId,
        created_by: actor.profileId,
        status: 'email_pending',
        token_hash: hashOnlineIntakeToken(token),
        verification_code_hash: hashOnlineIntakeCode(code),
        verification_attempts: 0,
        customer_payload: customerPayload,
        privacy_notice_version: ONLINE_INTAKE_PRIVACY_VERSION,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()
    if (insertError || !inserted) {
      if (insertError?.message.toLowerCase().includes('online_customer_intakes')) {
        throw new Error('Die Online-Aufnahme ist in Supabase noch nicht eingerichtet. Bitte Migration 004 ausführen.')
      }
      throw insertError ?? new Error('Online-Aufnahme konnte nicht angelegt werden.')
    }

    let status: 'email_sent' | 'failed' = 'email_sent'
    let deliveryError: string | null = null
    let emailSentAt: string | null = nowIso()
    try {
      await sendOnlineIntakeLinkEmail({ customer: customerPayload, token, code, origin: request.nextUrl.origin, expiresAt })
    } catch (error) {
      status = 'failed'
      emailSentAt = null
      deliveryError = error instanceof Error ? error.message : 'E-Mail konnte nicht versendet werden.'
    }

    const { data: updated, error: updateError } = await client
      .from('online_customer_intakes')
      .update({ status, email_sent_at: emailSentAt, delivery_error: deliveryError })
      .eq('id', id)
      .select('*')
      .single()
    if (updateError || !updated) throw updateError ?? new Error('Versandstatus konnte nicht gespeichert werden.')

    return NextResponse.json({
      ok: true,
      intake: mapOnlineIntakeRow(updated as OnlineCustomerIntakeRow),
    })
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message ?? 'Bitte alle Pflichtfelder vollständig ausfüllen.'
      : error instanceof Error ? error.message : 'Online-Aufnahme konnte nicht gestartet werden.'
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
