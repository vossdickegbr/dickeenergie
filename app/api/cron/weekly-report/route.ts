import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { buildWeeklyReportPdf } from '@/lib/report'
import { weekPlan } from '@/lib/week'
import { readAdminSnapshot } from '@/lib/admin-snapshot'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { cronAuthorized, isBerlinSundayNine } from '@/lib/timezone'
import { nowIso, workMinutes } from '@/lib/utils'
import { commissionShares, salesOwnerOf } from '@/lib/commission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  if (!isBerlinSundayNine() && new URL(request.url).searchParams.get('force') !== '1') {
    return NextResponse.json({ ok: true, skipped: 'Nicht Sonntag 09:00 Uhr Europe/Berlin.' })
  }

  try {
    const recipient = process.env.REPORT_RECIPIENT
    const from = process.env.REPORT_FROM_EMAIL
    const apiKey = process.env.RESEND_API_KEY
    if (!recipient || !from || !apiKey) throw new Error('E-Mail-Versand ist nicht vollständig konfiguriert.')
    const idempotencyKey = `weekly-report:${weekPlan.id}`
    const client = createSupabaseAdminClient()
    const { data: existing, error: lookupError } = await client.from('weekly_reports').select('id').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (lookupError) throw lookupError
    if (existing) return NextResponse.json({ ok: true, skipped: 'Wochenbericht wurde bereits versendet.' })

    const snapshot = await readAdminSnapshot()
    const bytes = await buildWeeklyReportPdf(weekPlan, snapshot)
    const resend = new Resend(apiKey)
    const response = await resend.emails.send({
      from,
      to: recipient,
      subject: `Wochenabschluss ${weekPlan.startsOn} – ${weekPlan.district}`,
      html: '<p>Im Anhang befindet sich der automatisch erzeugte Wochenabschluss der Voss & Dicke FieldOps App.</p>',
      attachments: [{ filename: `Wochenabschluss_${weekPlan.startsOn}.pdf`, content: Buffer.from(bytes) }],
    })
    if (response.error) throw new Error(response.error.message)

    const visits = snapshot.visits.filter((item) => item.weekId === weekPlan.id && item.status !== 'open')
    const customers = snapshot.customers.filter((item) => item.weekId === weekPlan.id)
    const commissions = customers.reduce((totals, customer) => {
      const shares = commissionShares(customer)
      totals.total += shares.total
      totals.voss += shares.voss
      totals.dicke += shares.dicke
      if (salesOwnerOf(customer) === 'both') totals.shared += 1
      return totals
    }, { total: 0, voss: 0, dicke: 0, shared: 0 })
    const archive = {
      id: `archive-${weekPlan.id}`,
      weekId: weekPlan.id,
      title: weekPlan.title,
      district: weekPlan.district,
      startsOn: weekPlan.startsOn,
      endsOn: weekPlan.endsOn,
      archivedAt: nowIso(),
      summary: {
        visits: visits.length,
        red: visits.filter((item) => item.status === 'red').length,
        yellow: visits.filter((item) => item.status === 'yellow').length,
        green: visits.filter((item) => item.status === 'green').length,
        cancelled: customers.filter((item) => item.status === 'cancelled').length,
        netContracts: customers.filter((item) => item.status === 'active').length,
        workMinutesVoss: snapshot.workSessions.filter((item) => item.profileId === 'voss' && item.date >= weekPlan.startsOn && item.date <= weekPlan.endsOn).reduce((sum, item) => sum + workMinutes(item), 0),
        workMinutesDicke: snapshot.workSessions.filter((item) => item.profileId === 'dicke' && item.date >= weekPlan.startsOn && item.date <= weekPlan.endsOn).reduce((sum, item) => sum + workMinutes(item), 0),
        commissionTotalCents: commissions.total,
        commissionVossCents: commissions.voss,
        commissionDickeCents: commissions.dicke,
        sharedCustomers: commissions.shared,
      },
      improvementNotes: {},
      plan: weekPlan,
      report: { fileName: `Wochenabschluss_${weekPlan.startsOn}.pdf`, sentAt: nowIso() },
    }

    const { error: archiveError } = await client.from('app_records').upsert({
      id: archive.id,
      record_type: 'archive',
      payload: archive,
      created_by: null,
      updated_at: nowIso(),
    }, { onConflict: 'id' })
    if (archiveError) throw archiveError

    const { error: reportError } = await client.from('weekly_reports').insert({
      week_id: weekPlan.id,
      idempotency_key: idempotencyKey,
      sent_to: recipient,
      report_meta: { resendId: response.data?.id, fileName: `Wochenabschluss_${weekPlan.startsOn}.pdf` },
    })
    if (reportError) throw reportError

    return NextResponse.json({ ok: true, sent: true, id: response.data?.id })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Wochenbericht fehlgeschlagen.' }, { status: 500 })
  }
}
