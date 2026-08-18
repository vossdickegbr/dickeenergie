import type { Customer, CustomerAttribution, ProfileId } from '@/lib/types'
import { toLocalDateKey } from '@/lib/utils'

export interface WorkMonthPeriod {
  key: string
  start: string
  end: string
  label: string
}

function dateKey(year: number, monthIndex: number, day: number) {
  const date = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0))
  return date.toISOString().slice(0, 10)
}

function germanShortDate(value: string, includeYear = false) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'Europe/Berlin',
  }).format(new Date(`${value}T12:00:00Z`))
}

/**
 * Ein Arbeitsmonat läuft immer vom 16. eines Monats bis einschließlich 15. des Folgemonats.
 * Der Key ist das Enddatum, damit sich die Perioden stabil sortieren und speichern lassen.
 */
export function workMonthForDateKey(value: string): WorkMonthPeriod {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const monthIndex = month - 1
  const start = day <= 15
    ? dateKey(year, monthIndex - 1, 16)
    : dateKey(year, monthIndex, 16)
  const end = day <= 15
    ? dateKey(year, monthIndex, 15)
    : dateKey(year, monthIndex + 1, 15)
  return {
    key: end,
    start,
    end,
    label: `16.${germanShortDate(start).slice(3)} – ${germanShortDate(end, true)}`,
  }
}

export function currentWorkMonth(date = new Date()) {
  return workMonthForDateKey(toLocalDateKey(date))
}

export function customerWorkMonth(customer: Pick<Customer, 'completedAt'>) {
  return workMonthForDateKey(toLocalDateKey(new Date(customer.completedAt)))
}

export function salesOwnerOf(customer: Pick<Customer, 'salesOwner' | 'completedBy'>): CustomerAttribution {
  return customer.salesOwner ?? customer.completedBy
}

export function salesOwnerLabel(owner: CustomerAttribution) {
  if (owner === 'voss') return 'Herr Voss'
  if (owner === 'dicke') return 'Herr Dicke'
  return 'Gemeinsam 50/50'
}

export function commissionCents(customer: Pick<Customer, 'commissionAmountCents'>) {
  return Math.max(0, Math.round(customer.commissionAmountCents ?? 0))
}

export function isCommissionEarning(customer: Pick<Customer, 'status' | 'recordState' | 'commissionAmountCents'>) {
  return customer.status === 'active' && customer.recordState !== 'draft' && commissionCents(customer) > 0
}

export function commissionShares(customer: Pick<Customer, 'status' | 'recordState' | 'commissionAmountCents' | 'salesOwner' | 'completedBy'>) {
  const amount = isCommissionEarning(customer) ? commissionCents(customer) : 0
  const owner = salesOwnerOf(customer)
  if (owner === 'voss') return { voss: amount, dicke: 0, total: amount }
  if (owner === 'dicke') return { voss: 0, dicke: amount, total: amount }
  // Bei einem ungeraden Cent erhält Voss den unteren, Dicke den oberen Cent.
  // Der Gesamtbetrag bleibt dadurch centgenau und wird nie künstlich erhöht.
  const voss = Math.floor(amount / 2)
  const dicke = amount - voss
  return { voss, dicke, total: amount }
}

export function profileCommission(customer: Pick<Customer, 'status' | 'recordState' | 'commissionAmountCents' | 'salesOwner' | 'completedBy'>, profileId: ProfileId) {
  return commissionShares(customer)[profileId]
}

export function formatEuroFromCents(cents: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export function centsFromEuroInput(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return undefined
  const amount = Number(normalized)
  if (!Number.isFinite(amount) || amount < 0) return undefined
  return Math.round(amount * 100)
}

export function euroInputFromCents(cents?: number) {
  if (typeof cents !== 'number') return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}
