import { NextResponse } from 'next/server'
import type { AddressVisit, Appointment, Customer, CustomerDocumentMeta, DeletedCustomer, NotificationItem } from '@/lib/types'
import { RETENTION_CONFIG } from '@/lib/company-config'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { cronAuthorized } from '@/lib/timezone'
import { deleteCustomerDocuments } from '@/lib/customer-privacy'
import { nowIso, toLocalDateKey } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDeletedCustomer(value: unknown): value is DeletedCustomer {
  return Boolean(value && typeof value === 'object' && (value as Partial<DeletedCustomer>).kind === 'deleted_customer' && (value as Partial<DeletedCustomer>).customer?.id)
}

function dateKeyPlusDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.from('app_records').select('id,record_type,payload')
    if (error) throw error
    const rows = data ?? []
    const today = toLocalDateKey()
    let trashed = 0
    let purged = 0
    let securityLogsPruned = 0
    const trashedIds = new Set<string>()

    const visits = rows.filter((row) => row.record_type === 'visit').map((row) => row.payload as AddressVisit)
    const appointments = rows.filter((row) => row.record_type === 'appointment').map((row) => row.payload as Appointment)
    const notifications = rows.filter((row) => row.record_type === 'notification').map((row) => row.payload as NotificationItem)
    const deleted = rows.filter((row) => row.record_type === 'archive' && isDeletedCustomer(row.payload)).map((row) => { const item = row.payload as DeletedCustomer; return { ...item, related: { visits: item.related?.visits ?? [], appointments: item.related?.appointments ?? [], notifications: item.related?.notifications ?? [], documents: item.related?.documents ?? [] } } as DeletedCustomer })

    for (const row of rows) {
      if (row.record_type !== 'customer') continue
      const customer = row.payload as Customer
      if (customer.status !== 'active') continue
      const draftDeadline = customer.recordState === 'draft' ? dateKeyPlusDays(customer.createdAt, RETENTION_CONFIG.followUpGraceDays) : undefined
      const deletionDue = customer.recordState === 'draft'
        ? Boolean(draftDeadline && draftDeadline <= today)
        : Boolean(customer.followUpGraceUntil && customer.followUpGraceUntil.slice(0, 10) <= today)
      if (!deletionDue) continue
      const deletionReason: DeletedCustomer['reason'] = customer.recordState === 'draft' ? 'incomplete_intake' : 'follow_up_expired'
      const customerVisits = visits.filter((item) => item.customerId === customer.id)
      const customerAppointments = appointments.filter((item) => item.customerId === customer.id)
      const appointmentIds = new Set(customerAppointments.map((item) => item.id))
      const customerNotifications = notifications.filter((item) => item.linkedId === customer.id || Boolean(item.linkedId && appointmentIds.has(item.linkedId)))
      const { data: documentRows, error: documentError } = await admin.from('customer_documents').select('id,customer_id,kind,file_name,mime_type,size_bytes,sha256,created_at').eq('customer_id', customer.id)
      if (documentError) throw documentError
      const documents: CustomerDocumentMeta[] = (documentRows ?? []).map((item) => ({ id: item.id, customerId: item.customer_id, kind: item.kind, fileName: item.file_name, mimeType: item.mime_type, sizeBytes: Number(item.size_bytes), sha256: item.sha256, createdAt: item.created_at }))
      const timestamp = nowIso()
      const trash: DeletedCustomer = {
        id: customer.id,
        kind: 'deleted_customer',
        customer,
        related: { visits: customerVisits, appointments: customerAppointments, notifications: customerNotifications, documents },
        deletedAt: timestamp,
        deletedBy: 'system',
        purgeAfter: dateKeyPlusDays(timestamp, RETENTION_CONFIG.customerTrashDays),
        reason: deletionReason,
        createdAt: customer.createdAt,
        updatedAt: timestamp,
      }
      const archiveRows = [
        { id: customer.id, record_type: 'archive', payload: trash, created_by: null, updated_at: timestamp },
        ...customerVisits.map((item) => ({ id: item.id, record_type: 'archive', payload: { id: item.id, kind: 'deleted_customer_related', trashId: customer.id, originalType: 'visit', original: item, createdAt: item.createdAt, updatedAt: timestamp }, created_by: null, updated_at: timestamp })),
        ...customerAppointments.map((item) => ({ id: item.id, record_type: 'archive', payload: { id: item.id, kind: 'deleted_customer_related', trashId: customer.id, originalType: 'appointment', original: item, createdAt: item.createdAt, updatedAt: timestamp }, created_by: null, updated_at: timestamp })),
        ...customerNotifications.map((item) => ({ id: item.id, record_type: 'archive', payload: { id: item.id, kind: 'deleted_customer_related', trashId: customer.id, originalType: 'notification', original: item, createdAt: item.createdAt, updatedAt: timestamp }, created_by: null, updated_at: timestamp })),
      ]
      const { error: archiveError } = await admin.from('app_records').upsert(archiveRows, { onConflict: 'id' })
      if (archiveError) throw archiveError
      await admin.from('audit_log').insert({ actor_profile_id: null, action: 'customer.auto_trashed', entity_type: 'customer', entity_id: customer.id, details: { reason: deletionReason } })
      trashedIds.add(customer.id)
      trashed += 1
    }

    for (const item of deleted) {
      if (item.purgeAfter.slice(0, 10) > today) continue
      const ids = [item.id, ...item.related.visits.map((entry) => entry.id), ...item.related.appointments.map((entry) => entry.id), ...item.related.notifications.map((entry) => entry.id)]
      await deleteCustomerDocuments(item.customer.id)
      const { error: auditDeleteError } = await admin.from('audit_log').delete().in('entity_id', ids)
      if (auditDeleteError) throw auditDeleteError
      const { error: recordsDeleteError } = await admin.from('app_records').delete().in('id', ids)
      if (recordsDeleteError) throw recordsDeleteError
      purged += 1
    }

    // Datenschutz-PDFs werden bewusst niemals automatisch per E-Mail erneut versendet.
    // Fehlgeschlagene manuelle Versuche bleiben als Status in der Kundenkartei sichtbar.

    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - RETENTION_CONFIG.securityLogDays)
    const { data: prunedLogs, error: pruneError } = await admin.from('audit_log').delete().lt('created_at', cutoff.toISOString()).select('id')
    if (pruneError) throw pruneError
    securityLogsPruned = prunedLogs?.length ?? 0
    const { error: rateLimitPruneError } = await admin.from('auth_rate_limits').delete().lt('updated_at', cutoff.toISOString())
    if (rateLimitPruneError) throw rateLimitPruneError

    return NextResponse.json({ ok: true, trashed, purged, securityLogsPruned })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Datenschutz-Löschlauf fehlgeschlagen.' }, { status: 500 })
  }
}
