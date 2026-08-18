import type { MapRoute, ProfileId } from '@/lib/types'

export const PROFILE_LABELS: Record<ProfileId, string> = {
  voss: 'Herr Voss',
  dicke: 'Herr Dicke',
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatDateTime(value?: string, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
    ...options,
  }).format(new Date(value))
}

export function formatDate(value?: string) {
  if (!value) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeZone: 'Europe/Berlin',
  }).format(new Date(`${value}T12:00:00+02:00`))
}

export function toLocalDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}


export function berlinDateTimeIso(dateKey: string, time = '09:00') {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  if (![year, month, day, hour, minute].every(Number.isFinite)) throw new Error('Ungültiges Datum.')
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let guess = desiredAsUtc
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess))
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
    const actualAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    guess += desiredAsUtc - actualAsUtc
  }
  return new Date(guess).toISOString()
}

export function nowIso() {
  return new Date().toISOString()
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function googleDirectionsUrl(route: MapRoute) {
  const [origin, ...rest] = route.stops
  const destination = rest.at(-1) ?? origin
  const waypoints = rest.slice(0, -1)
  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'walking',
  })
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function googleAddressUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

export function googleStreetViewSearchUrl(address: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(address)}/`
}

export function telUrl(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}

export function whatsappUrl(phone: string, message = 'Guten Tag, hier ist Voss & Dicke GbR.') {
  const normalized = phone.replace(/[^\d]/g, '').replace(/^0/, '49')
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

export function workMinutes(session: {
  startedAt: string
  endedAt?: string
  pauses: Array<{ startedAt: string; endedAt?: string }>
}) {
  const end = session.endedAt ?? new Date().toISOString()
  const total = minutesBetween(session.startedAt, end)
  const paused = session.pauses.reduce((sum, pause) => {
    if (!pause.endedAt) return sum + minutesBetween(pause.startedAt, end)
    return sum + minutesBetween(pause.startedAt, pause.endedAt)
  }, 0)
  return Math.max(0, total - paused)
}

export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} h`
}
