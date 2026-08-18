import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAndStorePrivacyReceipt } from '@/lib/customer-privacy'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  hashOnlineIntakeToken,
  isOnlineIntakeExpired,
  verifyOnlineIntakeCode,
  type OnlineCustomerIntakeRow,
} from '@/lib/online-customer-intake'
import type { Customer } from '@/lib/types'
import { nowIso } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const completeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Der Bestätigungscode muss aus sechs Ziffern bestehen.'),
  signatureDataUrl: z.string().max(1_500_000).refine((value) => value.startsWith('data:image/png;base64,'), 'Ungültige Unterschrift.').optional(),
  acknowledgementAccepted: z.literal(true, { error: 'Bitte den Erhalt der Datenschutzinformation bestätigen.' }),
}).strict()

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const input = completeSchema.parse(await request.json())
    if (!token || token.length < 20) return NextResponse.json({ ok: false, error: 'Link ist ungültig.' }, { status: 404 })

    const admin = createSupabaseAdminClient()
    const tokenHash = hashOnlineIntakeToken(token)
    const { data, error } = await admin.from('online_customer_intakes').select('*').eq('token_hash', tokenHash).maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ ok: false, error: 'Link ist ungültig oder wurde ersetzt.' }, { status: 404 })
    const row = data as OnlineCustomerIntakeRow

    if (row.status === 'completed' || row.status === 'finalized') {
      return NextResponse.json({ ok: true, alreadyCompleted: true, completedAt: row.completed_at })
    }
    if (row.status === 'expired' || isOnlineIntakeExpired(row.expires_at)) {
      await admin.from('online_customer_intakes').update({ status: 'expired', delivery_error: 'Der Kundenlink ist abgelaufen.' }).eq('id', row.id)
      return NextResponse.json({ ok: false, error: 'Der Link ist abgelaufen. Bitte fordern Sie einen neuen Link an.' }, { status: 410 })
    }
    if (row.verification_attempts >= 8) {
      return NextResponse.json({ ok: false, error: 'Zu viele falsche Versuche. Bitte fordern Sie einen neuen Link an.' }, { status: 429 })
    }
    if (!verifyOnlineIntakeCode(input.code, row.verification_code_hash)) {
      await admin.from('online_customer_intakes').update({
        verification_attempts: row.verification_attempts + 1,
      }).eq('id', row.id)
      return NextResponse.json({ ok: false, error: 'Der Bestätigungscode ist nicht korrekt.' }, { status: 400 })
    }

    const now = nowIso()
    const payload = row.customer_payload
    const customer: Customer = {
      id: row.reserved_customer_id,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      street: payload.street,
      houseNumber: payload.houseNumber,
      postalCode: payload.postalCode,
      city: payload.city,
      district: payload.district,
      completedAt: now,
      completedBy: row.created_by,
      salesOwner: payload.salesOwner ?? row.created_by,
      commissionAmountCents: payload.commissionAmountCents,
      weekId: payload.weekId,
      dayId: payload.dayId,
      source: 'online',
      serviceType: payload.serviceType,
      recordState: 'active',
      followUpAt: payload.followUpAt,
      lastContactAt: now,
      status: 'active',
      createdAt: row.created_at,
      updatedAt: now,
    }

    const { receipt } = await createAndStorePrivacyReceipt(customer, input.signatureDataUrl, 'customer')
    // Nach der Bestätigung wird keine Datenschutz-PDF automatisch versendet.
    // Sie bleibt geschützt gespeichert und kann intern bewusst manuell versendet werden.
    const deliveryError = null

    const { error: updateError } = await admin.from('online_customer_intakes').update({
      status: 'completed',
      verification_attempts: 0,
      // Eine freiwillige Roh-Unterschrift wird nach Erstellung der PDF nicht zusätzlich gespeichert.
      signature_data_url: null,
      privacy_receipt: receipt,
      email_verified_at: now,
      privacy_accepted_at: now,
      signed_at: input.signatureDataUrl ? now : null,
      completed_at: now,
      delivery_error: deliveryError,
      privacy_email_status: receipt.emailStatus,
      privacy_email_sent_at: receipt.emailSentAt ?? null,
      privacy_email_error: null,
    }).eq('id', row.id)
    if (updateError) throw updateError

    return NextResponse.json({
      ok: true,
      completedAt: now,
      pdfEmailStatus: receipt.emailStatus,
      warning: undefined,
    })
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message ?? 'Bitte alle Angaben prüfen.'
      : error instanceof Error ? error.message : 'Bestätigung konnte nicht gespeichert werden.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
