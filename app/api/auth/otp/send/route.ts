import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { COOKIE_NAME, verifyCompanyGateToken } from '@/lib/auth-company'
import { profileEmail } from '@/lib/profile-contact'
import { consumeRateLimit, RateLimitError, rateLimitResponse, requestClientId } from '@/lib/rate-limit'
import { createSupabasePublicServerClient } from '@/lib/supabase/server'

const schema = z.object({
  profileId: z.enum(['voss', 'dicke']),
})

export async function POST(request: Request) {
  const store = await cookies()
  if (!verifyCompanyGateToken(store.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ ok: false, error: 'Firmenanmeldung ist abgelaufen.' }, { status: 401 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }, { status: 400 })

  const configuredEmail = profileEmail(parsed.data.profileId).trim().toLowerCase()

  try {
    await consumeRateLimit({
      scope: 'otp-send',
      identifier: `${requestClientId(request)}:${parsed.data.profileId}:email`,
      maxAttempts: 5,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    })
    const client = createSupabasePublicServerClient()
    const { error } = await client.auth.signInWithOtp({
      email: configuredEmail,
      options: { shouldCreateUser: false },
    })
    if (error) throw error
    return NextResponse.json({ ok: true, destination: 'E-Mail-Adresse' })
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Code konnte nicht versendet werden.' }, { status: 400 })
  }
}
