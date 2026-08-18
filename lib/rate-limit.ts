import { createHmac } from 'node:crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super('Zu viele Versuche. Bitte später erneut versuchen.')
    this.name = 'RateLimitError'
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds))
  }
}

function rateLimitSecret() {
  const value = process.env.COMPANY_GATE_SECRET
  if (!value || value.length < 32) throw new Error('COMPANY_GATE_SECRET must contain at least 32 characters.')
  return value
}

export function requestClientId(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip')?.trim()
  return forwarded || realIp || 'unknown-client'
}

function hashKey(scope: string, identifier: string) {
  return createHmac('sha256', rateLimitSecret()).update(`${scope}:${identifier}`).digest('hex')
}

interface ConsumeOptions {
  scope: string
  identifier: string
  maxAttempts: number
  windowSeconds: number
  blockSeconds: number
}

export async function consumeRateLimit(options: ConsumeOptions) {
  const client = createSupabaseAdminClient()
  const keyHash = hashKey(options.scope, options.identifier)
  const now = new Date()
  const { data, error } = await client
    .from('auth_rate_limits')
    .select('attempts,window_started_at,blocked_until')
    .eq('key_hash', keyHash)
    .maybeSingle()
  if (error) throw error

  const blockedUntil = data?.blocked_until ? new Date(data.blocked_until) : undefined
  if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
    throw new RateLimitError((blockedUntil.getTime() - now.getTime()) / 1000)
  }

  const windowStarted = data?.window_started_at ? new Date(data.window_started_at) : undefined
  const windowExpired = !windowStarted || now.getTime() - windowStarted.getTime() >= options.windowSeconds * 1000
  const attempts = windowExpired ? 1 : Number(data?.attempts ?? 0) + 1
  const nextBlockedUntil = attempts > options.maxAttempts
    ? new Date(now.getTime() + options.blockSeconds * 1000)
    : null

  const { error: upsertError } = await client.from('auth_rate_limits').upsert({
    key_hash: keyHash,
    scope: options.scope,
    attempts,
    window_started_at: windowExpired ? now.toISOString() : windowStarted?.toISOString() ?? now.toISOString(),
    blocked_until: nextBlockedUntil?.toISOString() ?? null,
    updated_at: now.toISOString(),
  }, { onConflict: 'key_hash' })
  if (upsertError) throw upsertError

  if (nextBlockedUntil) throw new RateLimitError(options.blockSeconds)
  return keyHash
}

export async function clearRateLimit(scope: string, identifier: string) {
  const client = createSupabaseAdminClient()
  const { error } = await client.from('auth_rate_limits').delete().eq('key_hash', hashKey(scope, identifier))
  if (error) throw error
}

export function rateLimitResponse(error: RateLimitError) {
  return Response.json(
    { ok: false, error: error.message },
    { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
  )
}
