import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth-company'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const client = await createSupabaseServerClient()
    await client.auth.signOut()
  } catch {
    // Clear local cookies even if Supabase is temporarily unreachable.
  }
  const store = await cookies()
  store.delete(COOKIE_NAME)
  return NextResponse.json({ ok: true })
}
