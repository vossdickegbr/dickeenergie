import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'vd_company_gate'
export { COOKIE_NAME }

function gateSecret() {
  const value = process.env.COMPANY_GATE_SECRET
  if (!value || value.length < 32) throw new Error('COMPANY_GATE_SECRET must contain at least 32 characters.')
  return value
}

function encode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function decode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

export function createCompanyGateToken(ttlSeconds = 60 * 60) {
  const payload = JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds, scope: 'company-gate' })
  const encoded = encode(payload)
  const signature = createHmac('sha256', gateSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyCompanyGateToken(token?: string) {
  if (!token) return false
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return false
  const expected = createHmac('sha256', gateSecret()).update(encoded).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const payload = JSON.parse(decode(encoded)) as { exp: number; scope: string }
    return payload.scope === 'company-gate' && payload.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function safeCompare(input: string, expected: string) {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function verifyCompanyPassword(input: string) {
  const encoded = process.env.COMPANY_PASSWORD_SCRYPT
  if (!encoded) return false
  const [salt, expectedHex] = encoded.split(':')
  if (!salt || !expectedHex) return false
  const actual = scryptSync(input, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
