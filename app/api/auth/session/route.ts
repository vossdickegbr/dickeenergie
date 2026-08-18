import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_NAME, verifyCompanyGateToken } from '@/lib/auth-company'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { WorkSession } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const store = await cookies()
  const companyGate = verifyCompanyGateToken(store.get(COOKIE_NAME)?.value)
  try {
    const client = await createSupabaseServerClient()
    const profile = await requireTeamProfile(client)
    let activeWork = false
    try {
      const { data, error } = await client
        .from('app_records')
        .select('payload')
        .eq('record_type', 'work_session')
      if (error) throw error
      activeWork = (data ?? [])
        .map((row) => row.payload as WorkSession)
        .some((session) => session.profileId === profile.profileId && !session.endedAt)
    } catch {
      // Authentication must still work if the work-status lookup is briefly unavailable.
    }
    return NextResponse.json({ authenticated: true, companyGate, profileId: profile.profileId, displayName: profile.displayName, activeWork })
  } catch {
    return NextResponse.json({ authenticated: false, companyGate })
  }
}
