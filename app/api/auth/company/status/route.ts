import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_NAME, verifyCompanyGateToken } from '@/lib/auth-company'

export const dynamic = 'force-dynamic'

export async function GET() {
  const store = await cookies()
  return NextResponse.json({ ok: verifyCompanyGateToken(store.get(COOKIE_NAME)?.value) })
}
