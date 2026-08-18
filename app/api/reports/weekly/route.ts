import { NextResponse } from 'next/server'
import { buildWeeklyReportPdf } from '@/lib/report'
import { weekPlan } from '@/lib/week'
import { snapshotFromRows } from '@/lib/records'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const client = await createSupabaseServerClient()
    await requireTeamProfile(client)
    const { data, error } = await client.from('app_records').select('record_type,payload')
    if (error) throw error
    const bytes = await buildWeeklyReportPdf(weekPlan, snapshotFromRows(data ?? []))
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Wochenabschluss_${weekPlan.startsOn}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Bericht konnte nicht erstellt werden.' }, { status: 401 })
  }
}
