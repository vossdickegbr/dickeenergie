import type { AppSnapshot, DeletedCustomer, DeletedVisit } from '@/lib/types'

export const recordTypes = {
  visits: 'visit',
  customers: 'customer',
  appointments: 'appointment',
  notifications: 'notification',
  workSessions: 'work_session',
  dayNotes: 'day_note',
  archives: 'archive',
} as const

export type RecordType = typeof recordTypes[keyof typeof recordTypes]

export function emptySnapshot(): AppSnapshot {
  return {
    visits: [],
    customers: [],
    appointments: [],
    notifications: [],
    workSessions: [],
    dayNotes: [],
    archives: [],
    deletedVisits: [],
    deletedCustomers: [],
    onlineCustomerIntakes: [],
  }
}

function isDeletedCustomer(value: unknown): value is DeletedCustomer {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DeletedCustomer>
  return candidate.kind === 'deleted_customer' && Boolean(candidate.customer?.id)
}

function isDeletedVisit(value: unknown): value is DeletedVisit {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DeletedVisit>
  return candidate.kind === 'deleted_visit' && Boolean(candidate.visit?.id)
}

export function snapshotFromRows(rows: Array<{ record_type: string; payload: unknown }>): AppSnapshot {
  const snapshot = emptySnapshot()
  const hiddenIds = new Set<string>()

  for (const row of rows) {
    if (row.record_type !== 'archive') continue
    if (isDeletedVisit(row.payload)) {
      snapshot.deletedVisits.push(row.payload)
      hiddenIds.add(row.payload.visit.id)
      row.payload.related.customers.forEach((item) => hiddenIds.add(item.id))
      row.payload.related.appointments.forEach((item) => hiddenIds.add(item.id))
      row.payload.related.notifications.forEach((item) => hiddenIds.add(item.id))
    }
    if (isDeletedCustomer(row.payload)) {
      const deleted = { ...row.payload, related: { visits: row.payload.related?.visits ?? [], appointments: row.payload.related?.appointments ?? [], notifications: row.payload.related?.notifications ?? [], documents: row.payload.related?.documents ?? [] } } as DeletedCustomer
      snapshot.deletedCustomers.push(deleted)
      hiddenIds.add(deleted.customer.id)
      deleted.related.visits.forEach((item) => hiddenIds.add(item.id))
      deleted.related.appointments.forEach((item) => hiddenIds.add(item.id))
      deleted.related.notifications.forEach((item) => hiddenIds.add(item.id))
    }
  }

  for (const row of rows) {
    const payload = row.payload as { id?: string; kind?: string }
    if (payload?.id && hiddenIds.has(payload.id)) continue

    switch (row.record_type) {
      case 'visit': snapshot.visits.push(row.payload as AppSnapshot['visits'][number]); break
      case 'customer': snapshot.customers.push(row.payload as AppSnapshot['customers'][number]); break
      case 'appointment': snapshot.appointments.push(row.payload as AppSnapshot['appointments'][number]); break
      case 'notification': snapshot.notifications.push(row.payload as AppSnapshot['notifications'][number]); break
      case 'work_session': snapshot.workSessions.push(row.payload as AppSnapshot['workSessions'][number]); break
      case 'day_note': snapshot.dayNotes.push(row.payload as AppSnapshot['dayNotes'][number]); break
      case 'archive': {
        if (payload?.kind === 'deleted_visit' || payload?.kind === 'deleted_visit_related' || payload?.kind === 'deleted_customer' || payload?.kind === 'deleted_customer_related') break
        snapshot.archives.push(row.payload as AppSnapshot['archives'][number])
        break
      }
    }
  }
  return snapshot
}
