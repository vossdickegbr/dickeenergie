import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { COOKIE_NAME, verifyCompanyGateToken } from '@/lib/auth-company'
import { profileEmail } from '@/lib/profile-contact'
import { clearRateLimit, consumeRateLimit, RateLimitError, rateLimitResponse, requestClientId } from '@/lib/rate-limit'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const schema = z.object({
  profileId: z.enum(['voss', 'dicke']),
  token: z.string().regex(/^\d{8}$/, 'Der Code muss aus 8 Ziffern bestehen.'),
})

export async function POST(request: Request) {
  const store = await cookies()
  if (!verifyCompanyGateToken(store.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ ok: false, error: 'Firmenanmeldung ist abgelaufen.' }, { status: 401 })
  }
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültiger Code.' }, { status: 400 })
  }

  const configuredEmail = profileEmail(parsed.data.profileId).trim().toLowerCase()

  const rateIdentifier = `${requestClientId(request)}:${parsed.data.profileId}`
  try {
    await consumeRateLimit({
      scope: 'otp-verify',
      identifier: rateIdentifier,
      maxAttempts: 8,
      windowSeconds: 15 * 60,
      blockSeconds: 30 * 60,
    })
    const client = await createSupabaseServerClient()
    const { error } = await client.auth.verifyOtp({
      email: configuredEmail,
      token: parsed.data.token,
      type: 'email',
    })
    if (error) throw error
    const profile = await requireTeamProfile(client)
    if (profile.profileId !== parsed.data.profileId) {
      await client.auth.signOut()
      throw new Error('Das bestätigte Konto passt nicht zum gewählten Profil.')
    }
    await clearRateLimit('otp-verify', rateIdentifier).catch(() => undefined)
    return NextResponse.json({ ok: true, profileId: profile.profileId })
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Code konnte nicht bestätigt werden.' }, { status: 401 })
  }
}
