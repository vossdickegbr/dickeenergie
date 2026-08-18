import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_NAME, createCompanyGateToken, safeCompare, verifyCompanyPassword } from '@/lib/auth-company'
import { clearRateLimit, consumeRateLimit, RateLimitError, rateLimitResponse, requestClientId } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const clientId = requestClientId(request)
  try {
    await consumeRateLimit({ scope: 'company-login', identifier: clientId, maxAttempts: 8, windowSeconds: 15 * 60, blockSeconds: 15 * 60 })
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error)
    return NextResponse.json({ ok: false, error: 'Anmeldung ist vorübergehend nicht verfügbar.' }, { status: 503 })
  }

  const expectedUsername = process.env.COMPANY_USERNAME
  if (!expectedUsername || !process.env.COMPANY_PASSWORD_SCRYPT) {
    return NextResponse.json({ ok: false, error: 'Firmenzugang ist noch nicht konfiguriert.' }, { status: 503 })
  }

  const usernameOk = safeCompare(body.username ?? '', expectedUsername)
  const passwordOk = verifyCompanyPassword(body.password ?? '')
  if (!usernameOk || !passwordOk) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return NextResponse.json({ ok: false, error: 'Benutzername oder Passwort ist falsch.' }, { status: 401 })
  }

  await clearRateLimit('company-login', clientId).catch(() => undefined)

  const store = await cookies()
  store.set(COOKIE_NAME, createCompanyGateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60,
  })
  return NextResponse.json({ ok: true })
}
