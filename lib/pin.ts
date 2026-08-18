'use client'

const PREFIX = 'vd_pin_'
const RUNTIME_PROFILE_KEY = 'vd_runtime_authenticated_profile'
const MANUAL_LOCK_KEY = 'vd_manual_lock'
const ITERATIONS = 310_000
const DEVICE_TRUST_MS = 30 * 24 * 60 * 60 * 1000
const UNLOCK_WINDOW_MS = 12 * 60 * 60 * 1000

interface PinRecord {
  salt: string
  iv: string
  ciphertext: string
  failures: number
  lockedUntil?: number
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const value of array) binary += String.fromCharCode(value)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveKey(pin: string, salt: Uint8Array) {
  const source = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    source,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function createDevicePin(profileId: string, pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error('Der Schnell-PIN muss aus genau 6 Ziffern bestehen.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(pin, salt)
  const payload = new TextEncoder().encode(`voss-dicke-unlock:${profileId}:${crypto.randomUUID()}`)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)
  const record: PinRecord = {
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
    failures: 0,
  }
  localStorage.setItem(`${PREFIX}${profileId}`, JSON.stringify(record))
  localStorage.setItem('vd_trusted_profile', profileId)
  localStorage.setItem('vd_trusted_until', String(Date.now() + DEVICE_TRUST_MS))
  markDeviceUnlocked(profileId)
}

export function hasDevicePin(profileId: string) {
  return Boolean(localStorage.getItem(`${PREFIX}${profileId}`))
}

export function trustedProfile() {
  const until = Number(localStorage.getItem('vd_trusted_until') ?? 0)
  if (until < Date.now()) return null
  return localStorage.getItem('vd_trusted_profile') as 'voss' | 'dicke' | null
}

export function markDeviceUnlocked(profileId: string) {
  localStorage.setItem('vd_unlocked_profile', profileId)
  localStorage.setItem('vd_unlocked_until', String(Date.now() + UNLOCK_WINDOW_MS))
  localStorage.setItem('vd_trusted_profile', profileId)
  localStorage.setItem('vd_trusted_until', String(Date.now() + DEVICE_TRUST_MS))
}

export function isDeviceUnlocked(profileId: string) {
  return localStorage.getItem('vd_unlocked_profile') === profileId && Number(localStorage.getItem('vd_unlocked_until') ?? 0) > Date.now()
}

export function markDeviceLocked() {
  localStorage.removeItem('vd_unlocked_profile')
  localStorage.removeItem('vd_unlocked_until')
}

/**
 * Keeps the app open while the same browser/PWA instance is only sent to the
 * background. sessionStorage is intentionally used here: it survives a page
 * reload and a short app switch, but is normally cleared when the tab or the
 * installed app is actually closed.
 */
export function markRuntimeAuthenticated(profileId: string) {
  sessionStorage.setItem(RUNTIME_PROFILE_KEY, profileId)
}

export function runtimeAuthenticatedProfile() {
  return sessionStorage.getItem(RUNTIME_PROFILE_KEY) as 'voss' | 'dicke' | null
}

export function clearRuntimeAuthentication() {
  sessionStorage.removeItem(RUNTIME_PROFILE_KEY)
}

export function markManualLock() {
  localStorage.setItem(MANUAL_LOCK_KEY, '1')
  clearRuntimeAuthentication()
  markDeviceLocked()
}

export function isManuallyLocked() {
  return localStorage.getItem(MANUAL_LOCK_KEY) === '1'
}

export function clearManualLock() {
  localStorage.removeItem(MANUAL_LOCK_KEY)
}

export async function verifyDevicePin(profileId: string, pin: string) {
  const raw = localStorage.getItem(`${PREFIX}${profileId}`)
  if (!raw) return { ok: false, lockedSeconds: 0 }
  const record = JSON.parse(raw) as PinRecord
  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    return { ok: false, lockedSeconds: Math.ceil((record.lockedUntil - Date.now()) / 1000) }
  }
  try {
    const key = await deriveKey(pin, base64ToBytes(record.salt))
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(record.iv) },
      key,
      base64ToBytes(record.ciphertext),
    )
    localStorage.setItem(`${PREFIX}${profileId}`, JSON.stringify({ ...record, failures: 0, lockedUntil: undefined }))
    markDeviceUnlocked(profileId)
    return { ok: true, lockedSeconds: 0 }
  } catch {
    const failures = record.failures + 1
    const lockMinutes = failures >= 8 ? 30 : failures >= 5 ? 5 : 0
    localStorage.setItem(`${PREFIX}${profileId}`, JSON.stringify({
      ...record,
      failures,
      lockedUntil: lockMinutes ? Date.now() + lockMinutes * 60 * 1000 : undefined,
    } satisfies PinRecord))
    return { ok: false, lockedSeconds: lockMinutes * 60 }
  }
}

export function clearTrustedDevice(removePin = false) {
  const profile = localStorage.getItem('vd_trusted_profile')
  markDeviceLocked()
  clearRuntimeAuthentication()
  clearManualLock()
  localStorage.removeItem('vd_trusted_profile')
  localStorage.removeItem('vd_trusted_until')
  if (removePin && profile) localStorage.removeItem(`${PREFIX}${profile}`)
}
