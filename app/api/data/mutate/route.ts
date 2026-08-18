import { after, NextResponse } from 'next/server'
import { z } from 'zod'
import type { AddressVisit, Appointment, Customer, CustomerDocumentMeta, DeletedCustomer, DeletedVisit, NotificationItem, OnlineCustomerIntakeCustomer, PrivacyReceipt, WorkSession } from '@/lib/types'
import { berlinDateTimeIso, makeId, nowIso, toLocalDateKey } from '@/lib/utils'
import { RETENTION_CONFIG } from '@/lib/company-config'
import { createAndStorePrivacyReceipt, deleteCustomerDocuments, provisionalPrivacyReceipt, resendStoredPrivacyReceipt } from '@/lib/customer-privacy'
import { sendCustomerWelcomeEmail, welcomeEmailFailure } from '@/lib/customer-welcome'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import {
  appointmentInputSchema, archiveInputSchema, cancellationInputSchema, customerActionSchema, customerInputSchema, customerPrivacyIntakeSchema,
  dayNoteInputSchema, idOnlySchema, notificationInputSchema, visitInputSchema,
} from '@/lib/validation'

const base = z.object({
  action: z.enum([
    'saveVisit', 'deleteVisit', 'trashVisit', 'restoreVisit', 'purgeVisit', 'saveCustomer', 'saveCustomerPrivacy', 'finalizeOnlineCustomerIntake', 'resendPrivacyEmail',
    'trashCustomer', 'restoreCustomer', 'purgeCustomer', 'renewCustomer', 'cancelCustomer', 'saveAppointment', 'saveNotification',
    'acknowledgeNotification', 'startWork', 'togglePause', 'endWork', 'saveDayNote', 'saveArchive',
  ]),
  payload: z.unknown().optional(),
}).strict()

async function upsertRecord<T extends { id: string; createdAt?: string; updatedAt?: string }>(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, recordType: string, payload: T, createdBy: string) {
  const timestamp = nowIso()
  const normalized = { ...payload, createdAt: payload.createdAt ?? timestamp, updatedAt: timestamp }
  const { error } = await client.from('app_records').upsert({
    id: normalized.id,
    record_type: recordType,
    payload: normalized,
    created_by: createdBy,
    updated_at: timestamp,
  }, { onConflict: 'id' })
  if (error) throw error
  return normalized
}

async function getRecord<T>(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, id: string, type: string) {
  const { data, error } = await client.from('app_records').select('payload').eq('id', id).eq('record_type', type).maybeSingle()
  if (error) throw error
  return data?.payload as T | undefined
}

async function audit(client: Awaited<ReturnType<typeof createSupabaseServerClient>>, profileId: string, action: string, entityType?: string, entityId?: string, details?: unknown) {
  await client.from('audit_log').insert({ actor_profile_id: profileId, action, entity_type: entityType, entity_id: entityId, details: details ?? {} })
}

async function resolveOpenCustomerFollowUps(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customerId: string,
  actorProfileId: string,
) {
  const { data, error } = await client.from('app_records').select('payload').eq('record_type', 'notification')
  if (error) throw error
  const timestamp = nowIso()
  const open = (data ?? [])
    .map((row) => row.payload as NotificationItem)
    .filter((item) => item.type === 'follow_up' && item.linkedType === 'customer' && item.linkedId === customerId && !item.resolvedAt)
  for (const item of open) {
    await upsertRecord(client, 'notification', { ...item, resolvedAt: timestamp, updatedAt: timestamp }, actorProfileId)
  }
}


async function sendAndStoreWelcomeEmail(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customer: Customer,
  actorProfileId: string,
) {
  if (!customer.email) return customer

  let welcomeEmail
  try {
    welcomeEmail = await sendCustomerWelcomeEmail(customer)
  } catch (error) {
    welcomeEmail = welcomeEmailFailure(error, customer.email)
  }

  const updated = await upsertRecord(client, 'customer', {
    ...customer,
    welcomeEmail,
    updatedAt: nowIso(),
  }, actorProfileId) as Customer

  try {
    await audit(
      client,
      actorProfileId,
      welcomeEmail.status === 'sent' ? 'customer.welcome_email_sent' : 'customer.welcome_email_failed',
      'customer',
      customer.id,
      {
        email: customer.email,
        status: welcomeEmail.status,
        resendId: welcomeEmail.resendId,
        error: welcomeEmail.error,
      },
    )
  } catch { /* Der Versandstatus bleibt trotzdem in der Kundenkartei gespeichert. */ }

  return updated
}


async function updatePrivacyEmailTask(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customer: Customer,
  actorProfileId: string,
) {
  if (!customer.privacyReceipt || !customer.email) return
  const id = `privacy-email-status-${customer.id}`
  const existing = await getRecord<NotificationItem>(client, id, 'notification')
  const timestamp = nowIso()
  if (['sent', 'not_requested'].includes(customer.privacyReceipt.emailStatus)) {
    if (existing && !existing.resolvedAt) await upsertRecord(client, 'notification', { ...existing, resolvedAt: timestamp, updatedAt: timestamp }, actorProfileId)
    return
  }
  const notification: NotificationItem = {
    id,
    type: 'system',
    title: 'Datenschutz-PDF Versand prüfen',
    summary: 'Der manuell ausgelöste Versand war noch nicht erfolgreich. E-Mail-Konfiguration oder Empfängeradresse prüfen und in der Kundenkartei erneut senden.',
    scheduledAt: timestamp,
    linkedType: 'customer',
    linkedId: customer.id,
    audience: 'both',
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }
  await upsertRecord(client, 'notification', notification, actorProfileId)
}


function normalizeText(value: string | undefined) {
  return (value ?? '').trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ')
}

function sameVisitAddress(visit: AddressVisit, candidate: Pick<AddressVisit, 'weekId' | 'dayId' | 'street' | 'houseNumber'>) {
  return visit.weekId === candidate.weekId
    && visit.dayId === candidate.dayId
    && normalizeText(visit.street) === normalizeText(candidate.street)
    && normalizeText(visit.houseNumber) === normalizeText(candidate.houseNumber)
}

function appointmentMatchesVisit(appointment: Appointment, visit: AddressVisit, customerIds: Set<string>) {
  if (appointment.customerId && customerIds.has(appointment.customerId)) return true
  if (appointment.weekId !== visit.weekId || appointment.dayId !== visit.dayId) return false
  const address = normalizeText(appointment.address)
  const target = normalizeText(`${visit.street} ${visit.houseNumber}`)
  return address === target || address.startsWith(`${target},`)
}

async function collectVisitRelations(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  visit: AddressVisit,
) {
  const { data, error } = await client
    .from('app_records')
    .select('record_type,payload')
    .in('record_type', ['customer', 'appointment', 'notification'])
  if (error) throw error

  const rows = data ?? []
  const customers = rows
    .filter((row) => row.record_type === 'customer')
    .map((row) => row.payload as Customer)
    .filter((customer) => customer.id === visit.customerId || (
      customer.weekId === visit.weekId
      && customer.dayId === visit.dayId
      && normalizeText(customer.street) === normalizeText(visit.street)
      && normalizeText(customer.houseNumber) === normalizeText(visit.houseNumber)
    ))
  const customerIds = new Set(customers.map((item) => item.id))

  const appointments = rows
    .filter((row) => row.record_type === 'appointment')
    .map((row) => row.payload as Appointment)
    .filter((appointment) => appointmentMatchesVisit(appointment, visit, customerIds))
  const linkedIds = new Set([...customerIds, ...appointments.map((item) => item.id)])

  const notifications = rows
    .filter((row) => row.record_type === 'notification')
    .map((row) => row.payload as NotificationItem)
    .filter((item) => Boolean(item.linkedId && linkedIds.has(item.linkedId)))

  return { customers, appointments, notifications }
}

async function archiveRelatedRecord(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  recordType: 'customer' | 'appointment' | 'notification',
  original: Customer | Appointment | NotificationItem,
  trashId: string,
  actorProfileId: string,
) {
  return upsertRecord(client, 'archive', {
    id: original.id,
    kind: 'deleted_visit_related' as const,
    trashId,
    originalType: recordType,
    original,
    createdAt: original.createdAt,
    updatedAt: nowIso(),
  }, actorProfileId)
}

function parseDeletedVisit(value: unknown): DeletedVisit | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<DeletedVisit>
  return candidate.kind === 'deleted_visit' && candidate.visit?.id ? candidate as DeletedVisit : undefined
}

function parseDeletedCustomer(value: unknown): DeletedCustomer | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<DeletedCustomer>
  if (candidate.kind !== 'deleted_customer' || !candidate.customer?.id) return undefined
  return { ...candidate, related: { visits: candidate.related?.visits ?? [], appointments: candidate.related?.appointments ?? [], notifications: candidate.related?.notifications ?? [], documents: candidate.related?.documents ?? [] } } as DeletedCustomer
}

function dateKeyPlusDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function collectCustomerRelations(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  customer: Customer,
) {
  const { data, error } = await client.from('app_records').select('record_type,payload').in('record_type', ['visit', 'appointment', 'notification'])
  if (error) throw error
  const visits = (data ?? []).filter((row) => row.record_type === 'visit').map((row) => row.payload as AddressVisit).filter((item) => item.customerId === customer.id)
  const appointments = (data ?? []).filter((row) => row.record_type === 'appointment').map((row) => row.payload as Appointment).filter((item) => item.customerId === customer.id)
  const appointmentIds = new Set(appointments.map((item) => item.id))
  const notifications = (data ?? []).filter((row) => row.record_type === 'notification').map((row) => row.payload as NotificationItem).filter((item) => item.linkedId === customer.id || Boolean(item.linkedId && appointmentIds.has(item.linkedId)))
  const admin = createSupabaseAdminClient()
  const { data: docs, error: docsError } = await admin.from('customer_documents').select('id,customer_id,kind,file_name,mime_type,size_bytes,sha256,created_at').eq('customer_id', customer.id)
  if (docsError) throw docsError
  const documents: CustomerDocumentMeta[] = (docs ?? []).map((item) => ({
    id: item.id, customerId: item.customer_id, kind: item.kind, fileName: item.file_name, mimeType: item.mime_type, sizeBytes: Number(item.size_bytes), sha256: item.sha256, createdAt: item.created_at,
  }))
  return { visits, appointments, notifications, documents }
}

async function archiveCustomerRelatedRecord(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  recordType: 'visit' | 'appointment' | 'notification',
  original: AddressVisit | Appointment | NotificationItem,
  trashId: string,
  actorProfileId: string,
) {
  return upsertRecord(client, 'archive', {
    id: original.id, kind: 'deleted_customer_related' as const, trashId, originalType: recordType, original, createdAt: original.createdAt, updatedAt: nowIso(),
  }, actorProfileId)
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 3_000_000) return NextResponse.json({ ok: false, error: 'Anfrage ist zu groß.' }, { status: 413 })

  const parsed = base.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Ungültige Anfrage.' }, { status: 400 })

  try {
    const client = await createSupabaseServerClient()
    const actor = await requireTeamProfile(client)
    const input = parsed.data.payload
    let result: unknown

    switch (parsed.data.action) {
      case 'saveVisit': {
        const raw = visitInputSchema.parse(input)
        const existing = raw.id ? await getRecord<AddressVisit>(client, raw.id, 'visit') : undefined
        const visit: AddressVisit = {
          ...raw,
          id: raw.id ?? makeId('visit'),
          profileId: actor.profileId,
          createdAt: existing?.createdAt ?? raw.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        }
        result = await upsertRecord(client, 'visit', visit, actor.profileId)
        await audit(client, actor.profileId, existing ? 'visit.updated' : 'visit.created', 'visit', visit.id, { status: visit.status })
        break
      }
      case 'deleteVisit':
      case 'trashVisit': {
        const raw = idOnlySchema.parse(input)
        const existing = await getRecord<AddressVisit>(client, raw.id, 'visit')
        if (!existing) {
          const alreadyDeleted = parseDeletedVisit(await getRecord<unknown>(client, raw.id, 'archive'))
          if (alreadyDeleted) { result = alreadyDeleted; break }
          throw new Error('Adresse nicht gefunden.')
        }

        const related = await collectVisitRelations(client, existing)
        const timestamp = nowIso()
        const deletedVisit: DeletedVisit = {
          id: existing.id,
          kind: 'deleted_visit',
          visit: existing,
          related,
          deletedAt: timestamp,
          deletedBy: actor.profileId,
          createdAt: existing.createdAt,
          updatedAt: timestamp,
        }

        // Der aktive Besuch wird atomar in einen Papierkorb-Datensatz umgewandelt.
        // Dadurch kann er auch bei einem Neustart nicht erneut als aktiver Eintrag erscheinen.
        result = await upsertRecord(client, 'archive', deletedVisit, actor.profileId)
        for (const customer of related.customers) await archiveRelatedRecord(client, 'customer', customer, deletedVisit.id, actor.profileId)
        for (const appointment of related.appointments) await archiveRelatedRecord(client, 'appointment', appointment, deletedVisit.id, actor.profileId)
        for (const notification of related.notifications) await archiveRelatedRecord(client, 'notification', notification, deletedVisit.id, actor.profileId)
        await audit(client, actor.profileId, 'visit.trashed', 'visit', raw.id, {
          street: existing.street,
          houseNumber: existing.houseNumber,
          status: existing.status,
          relatedRecords: related.customers.length + related.appointments.length + related.notifications.length,
        })
        break
      }
      case 'restoreVisit': {
        const raw = idOnlySchema.parse(input)
        const deletedVisit = parseDeletedVisit(await getRecord<unknown>(client, raw.id, 'archive'))
        if (!deletedVisit) throw new Error('Papierkorb-Eintrag nicht gefunden.')

        const { data: visitRows, error: visitError } = await client.from('app_records').select('payload').eq('record_type', 'visit')
        if (visitError) throw visitError
        const duplicate = (visitRows ?? [])
          .map((row) => row.payload as AddressVisit)
          .find((visit) => visit.id !== deletedVisit.visit.id && sameVisitAddress(visit, deletedVisit.visit))
        if (duplicate) throw new Error('Diese Adresse wurde inzwischen erneut erfasst. Lösche den neuen Eintrag zuerst, bevor du den alten wiederherstellst.')

        for (const customer of deletedVisit.related.customers) await upsertRecord(client, 'customer', customer, actor.profileId)
        for (const appointment of deletedVisit.related.appointments) await upsertRecord(client, 'appointment', appointment, actor.profileId)
        for (const notification of deletedVisit.related.notifications) await upsertRecord(client, 'notification', notification, actor.profileId)
        result = await upsertRecord(client, 'visit', deletedVisit.visit, actor.profileId)
        await audit(client, actor.profileId, 'visit.restored', 'visit', deletedVisit.visit.id, {
          street: deletedVisit.visit.street,
          houseNumber: deletedVisit.visit.houseNumber,
        })
        break
      }
      case 'purgeVisit': {
        const raw = idOnlySchema.parse(input)
        const deletedVisit = parseDeletedVisit(await getRecord<unknown>(client, raw.id, 'archive'))
        if (!deletedVisit) throw new Error('Papierkorb-Eintrag nicht gefunden.')

        const admin = createSupabaseAdminClient()
        const { data: allRows, error: rowsError } = await admin.from('app_records').select('id,payload')
        if (rowsError) throw rowsError

        const ids = new Set<string>([
          deletedVisit.id,
          deletedVisit.visit.id,
          ...deletedVisit.related.customers.map((item) => item.id),
          ...deletedVisit.related.appointments.map((item) => item.id),
          ...deletedVisit.related.notifications.map((item) => item.id),
        ])

        let changed = true
        while (changed) {
          changed = false
          for (const row of allRows ?? []) {
            const payload = row.payload as { trashId?: string; linkedId?: string; customerId?: string }
            if (payload.trashId === deletedVisit.id || (payload.linkedId && ids.has(payload.linkedId)) || (payload.customerId && ids.has(payload.customerId))) {
              if (!ids.has(row.id)) { ids.add(row.id); changed = true }
            }
          }
        }

        const purgeIds = [...ids]
        if (purgeIds.length) {
          const { error: auditError } = await admin.from('audit_log').delete().in('entity_id', purgeIds)
          if (auditError) throw auditError
          const { error: deleteError } = await admin.from('app_records').delete().in('id', purgeIds)
          if (deleteError) throw deleteError
        }
        result = { id: deletedVisit.id, purged: purgeIds.length }
        break
      }
      case 'saveCustomerPrivacy': {
        const parsedPrivacy = customerPrivacyIntakeSchema.parse(input)
        const raw = parsedPrivacy.customer
        const existing = raw.id ? await getRecord<Customer>(client, raw.id, 'customer') : undefined
        if (existing?.privacyReceipt) throw new Error('Für diesen Kunden ist bereits ein Datenschutz-Nachweis gespeichert.')
        const timestamp = nowIso()
        const customer: Customer = {
          ...raw,
          id: raw.id ?? makeId('customer'),
          completedBy: existing?.completedBy ?? actor.profileId,
          salesOwner: raw.salesOwner ?? existing?.salesOwner ?? existing?.completedBy ?? actor.profileId,
          commissionAmountCents: raw.commissionAmountCents ?? existing?.commissionAmountCents,
          source: raw.source ?? (raw.dayId === 'online-register' ? 'online' : 'd2d'),
          recordState: raw.recordState ?? 'draft',
          status: 'active',
          cancellation: raw.cancellation ? { ...raw.cancellation, createdBy: raw.cancellation.createdBy ?? actor.profileId } : undefined,
          createdAt: existing?.createdAt ?? raw.createdAt ?? timestamp,
          updatedAt: timestamp,
          followUpGraceUntil: raw.followUpAt ? dateKeyPlusDays(raw.followUpAt, RETENTION_CONFIG.followUpGraceDays) : undefined,
        }

        // Die Kundenkartei und der optionale Datenschutz-Nachweis werden zuerst gespeichert.
        // PDF-Erzeugung und privater Dokumentenspeicher laufen danach weiter,
        // damit ein externer Dienst den eigentlichen Speichervorgang nie blockiert.
        const pendingReceipt = provisionalPrivacyReceipt(customer, parsedPrivacy.signatureDataUrl, actor.profileId)
        const pendingCustomer: Customer = { ...customer, privacyReceipt: pendingReceipt, updatedAt: nowIso() }
        let saved = await upsertRecord(client, 'customer', pendingCustomer, actor.profileId) as Customer
        if (!existing && saved.email) saved = await sendAndStoreWelcomeEmail(client, saved, actor.profileId)

        after(async () => {
          try {
            const privacy = await createAndStorePrivacyReceipt(customer, parsedPrivacy.signatureDataUrl, actor.profileId)
            const latest = await getRecord<Customer>(client, customer.id, 'customer') ?? saved
            const finalized = await upsertRecord(client, 'customer', {
              ...latest,
              privacyReceipt: privacy.receipt,
              updatedAt: nowIso(),
            }, actor.profileId) as Customer
            try {
              await audit(client, actor.profileId, 'customer.privacy_acknowledged', 'customer', customer.id, {
                version: privacy.receipt.version,
                emailStatus: privacy.receipt.emailStatus,
                storageStatus: privacy.receipt.storageStatus,
              })
            } catch { /* Audit-Ausfall blockiert nichts. */ }
            try { await updatePrivacyEmailTask(client, finalized, actor.profileId) } catch { /* Aufnahme bleibt erfolgreich. */ }
          } catch (privacyError) {
            const failedReceipt = {
              ...pendingReceipt,
              pdfStatus: 'failed' as const,
              storageStatus: 'pending' as const,
              emailStatus: 'not_requested' as const,
              pdfError: privacyError instanceof Error ? privacyError.message.slice(0, 1_000) : 'PDF-Erstellung wird später erneut versucht.',
            }
            try {
              const latest = await getRecord<Customer>(client, customer.id, 'customer') ?? saved
              await upsertRecord(client, 'customer', { ...latest, privacyReceipt: failedReceipt, updatedAt: nowIso() }, actor.profileId)
            } catch { /* Der bereits gespeicherte Nachweis bleibt erhalten. */ }
          }
        })

        result = saved
        break
      }
      case 'finalizeOnlineCustomerIntake': {
        const raw = idOnlySchema.parse(input)
        const { data: intakeRow, error: intakeError } = await client
          .from('online_customer_intakes')
          .select('*')
          .eq('id', raw.id)
          .maybeSingle()
        if (intakeError) throw intakeError
        if (!intakeRow) throw new Error('Online-Aufnahme nicht gefunden.')

        if (intakeRow.status === 'finalized' && intakeRow.final_customer_id) {
          const existingFinal = await getRecord<Customer>(client, intakeRow.final_customer_id, 'customer')
          if (existingFinal) {
            result = existingFinal
            break
          }
        }
        if (intakeRow.status !== 'completed') {
          throw new Error('Die Kundenkartei kann erst gespeichert werden, wenn der Kunde E-Mail-Code und Datenschutzinformation bestätigt hat.')
        }
        if (!intakeRow.privacy_receipt || !intakeRow.completed_at) {
          throw new Error('Der bestätigte Datenschutz-Nachweis ist noch nicht vollständig.')
        }

        const payload = intakeRow.customer_payload as OnlineCustomerIntakeCustomer
        const receipt = intakeRow.privacy_receipt as PrivacyReceipt
        const timestamp = nowIso()
        const customer: Customer = {
          id: intakeRow.reserved_customer_id,
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          street: payload.street,
          houseNumber: payload.houseNumber,
          postalCode: payload.postalCode,
          city: payload.city,
          district: payload.district,
          completedAt: intakeRow.completed_at,
          completedBy: intakeRow.created_by,
          salesOwner: payload.salesOwner ?? intakeRow.created_by,
          commissionAmountCents: payload.commissionAmountCents,
          weekId: payload.weekId,
          dayId: payload.dayId,
          source: 'online',
          serviceType: payload.serviceType,
          recordState: 'active',
          followUpAt: payload.followUpAt,
          followUpGraceUntil: dateKeyPlusDays(payload.followUpAt, RETENTION_CONFIG.followUpGraceDays),
          lastContactAt: intakeRow.completed_at,
          privacyReceipt: receipt,
          status: 'active',
          createdAt: intakeRow.created_at,
          updatedAt: timestamp,
        }

        let saved = await upsertRecord(client, 'customer', customer, actor.profileId) as Customer
        if (saved.email) saved = await sendAndStoreWelcomeEmail(client, saved, actor.profileId)
        const followUpDate = payload.followUpAt.slice(0, 10)
        const notification: NotificationItem = {
          id: `followup-planned-${customer.id}-${followUpDate}`,
          type: 'follow_up',
          title: 'Kunden-Wiedervorlage fällig',
          summary: 'Eine geschützte Kundenkartei wartet auf Bearbeitung.',
          scheduledAt: berlinDateTimeIso(followUpDate, '09:00'),
          linkedType: 'customer',
          linkedId: customer.id,
          audience: 'both',
          createdAt: timestamp,
          updatedAt: timestamp,
        }
        await upsertRecord(client, 'notification', notification, actor.profileId)

        const { error: finalizeError } = await client
          .from('online_customer_intakes')
          .update({
            status: 'finalized',
            finalized_at: timestamp,
            final_customer_id: customer.id,
          })
          .eq('id', raw.id)
        if (finalizeError) throw finalizeError

        try {
          await updatePrivacyEmailTask(client, saved, actor.profileId)
          await audit(client, actor.profileId, 'customer.online_intake_finalized', 'customer', customer.id, {
            onlineIntakeId: raw.id,
            privacyVersion: receipt.version,
            emailStatus: receipt.emailStatus,
          })
        } catch { /* Kundenkartei bleibt gespeichert. */ }

        result = saved
        break
      }
      case 'saveCustomer': {
        const raw = customerInputSchema.parse(input)
        const existing = raw.id ? await getRecord<Customer>(client, raw.id, 'customer') : undefined
        const customer: Customer = {
          ...raw,
          id: raw.id ?? makeId('customer'),
          completedBy: existing?.completedBy ?? actor.profileId,
          salesOwner: raw.salesOwner ?? existing?.salesOwner ?? existing?.completedBy ?? actor.profileId,
          commissionAmountCents: raw.commissionAmountCents ?? existing?.commissionAmountCents,
          status: existing?.status ?? 'active',
          cancellation: existing?.cancellation ?? (raw.cancellation ? { ...raw.cancellation, createdBy: raw.cancellation.createdBy ?? actor.profileId } : undefined),
          privacyReceipt: existing?.privacyReceipt ?? raw.privacyReceipt,
          welcomeEmail: existing?.welcomeEmail ?? raw.welcomeEmail,
          recordState: raw.recordState ?? existing?.recordState ?? 'active',
          source: raw.source ?? existing?.source ?? (raw.dayId === 'online-register' ? 'online' : 'd2d'),
          followUpGraceUntil: raw.followUpAt ? dateKeyPlusDays(raw.followUpAt, RETENTION_CONFIG.followUpGraceDays) : undefined,
          createdAt: existing?.createdAt ?? raw.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        }
        let saved = await upsertRecord(client, 'customer', customer, actor.profileId) as Customer
        const followUpChanged = existing?.followUpAt !== customer.followUpAt
        if (followUpChanged) {
          await resolveOpenCustomerFollowUps(client, customer.id, actor.profileId)
          if (customer.followUpAt) {
            const followUpDate = customer.followUpAt.slice(0, 10)
            const notification: NotificationItem = {
              id: `followup-planned-${customer.id}-${followUpDate}`, type: 'follow_up', title: 'Kunden-Wiedervorlage fällig',
              summary: 'Eine geschützte Kundenkartei wartet auf Bearbeitung.', scheduledAt: berlinDateTimeIso(followUpDate, '09:00'),
              linkedType: 'customer', linkedId: customer.id, audience: 'both', createdAt: nowIso(), updatedAt: nowIso(),
            }
            await upsertRecord(client, 'notification', notification, actor.profileId)
          }
        }
        const emailBecameAvailable = Boolean(customer.email && existing?.privacyReceipt && customer.email !== existing.privacyReceipt.emailAddress)
        if (emailBecameAvailable) {
          // Eine neu eingetragene E-Mail-Adresse löst keinen automatischen Versand aus.
          // Die Datenschutz-PDF kann anschließend bewusst in der Kundenkartei versendet werden.
          saved = await upsertRecord(client, 'customer', {
            ...saved,
            privacyReceipt: {
              ...existing!.privacyReceipt!,
              emailStatus: 'not_requested',
              emailAddress: customer.email,
              emailSentAt: undefined,
              emailError: undefined,
            },
          }, actor.profileId) as Customer
        }
        try { await updatePrivacyEmailTask(client, saved, actor.profileId) } catch { /* Speichern bleibt erfolgreich. */ }
        try { await audit(client, actor.profileId, existing ? 'customer.updated' : 'customer.created', 'customer', customer.id, { followUpChanged, recordState: customer.recordState, completedBy: customer.completedBy, salesOwnerBefore: existing?.salesOwner ?? existing?.completedBy, salesOwnerAfter: customer.salesOwner, commissionBeforeCents: existing?.commissionAmountCents, commissionAfterCents: customer.commissionAmountCents }) } catch { /* Audit-Ausfall blockiert die Kartei nicht. */ }

        // Die reine Dankes-E-Mail wird bei einer neu angelegten Kundenkartei genau einmal
        // serverseitig versendet. Der konkrete Versandstatus wird in der Kartei gespeichert,
        // damit ein Fehler sichtbar bleibt und bewusst erneut versucht werden kann.
        if (!existing && saved.email) saved = await sendAndStoreWelcomeEmail(client, saved, actor.profileId)
        result = saved
        break
      }
      case 'resendPrivacyEmail': {
        const raw = idOnlySchema.parse(input)
        const existing = await getRecord<Customer>(client, raw.id, 'customer')
        if (!existing) throw new Error('Kunde nicht gefunden.')
        const mail = await resendStoredPrivacyReceipt(existing)
        const updated: Customer = {
          ...existing,
          privacyReceipt: existing.privacyReceipt ? { ...existing.privacyReceipt, emailStatus: mail.status, emailAddress: existing.email, emailSentAt: mail.sentAt, emailError: mail.error } : undefined,
          updatedAt: nowIso(),
        }
        result = await upsertRecord(client, 'customer', updated, actor.profileId)
        await updatePrivacyEmailTask(client, updated, actor.profileId)
        await audit(client, actor.profileId, 'customer.privacy_resent', 'customer', existing.id, { emailStatus: mail.status })
        break
      }
      case 'renewCustomer': {
        const raw = z.object({ id: idOnlySchema.shape.id, followUpAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.string().min(10).max(48)]), serviceType: z.enum(['strom', 'gas', 'both']).optional() }).strict().parse(input)
        const existing = await getRecord<Customer>(client, raw.id, 'customer')
        if (!existing) throw new Error('Kunde nicht gefunden.')
        const updated: Customer = {
          ...existing, status: 'active', recordState: 'active', serviceType: raw.serviceType ?? existing.serviceType, followUpAt: raw.followUpAt,
          followUpGraceUntil: dateKeyPlusDays(raw.followUpAt, RETENTION_CONFIG.followUpGraceDays), lastContactAt: nowIso(), updatedAt: nowIso(),
        }
        await resolveOpenCustomerFollowUps(client, existing.id, actor.profileId)
        result = await upsertRecord(client, 'customer', updated, actor.profileId)
        const followUpDate = raw.followUpAt.slice(0, 10)
        await upsertRecord(client, 'notification', {
          id: `followup-planned-${existing.id}-${followUpDate}`, type: 'follow_up', title: 'Kunden-Wiedervorlage fällig',
          summary: 'Eine geschützte Kundenkartei wartet auf Bearbeitung.', scheduledAt: berlinDateTimeIso(followUpDate, '09:00'), linkedType: 'customer', linkedId: existing.id, audience: 'both', createdAt: nowIso(), updatedAt: nowIso(),
        } as NotificationItem, actor.profileId)
        await audit(client, actor.profileId, 'customer.renewed', 'customer', existing.id, { followUpAt: raw.followUpAt, serviceType: updated.serviceType })
        break
      }
      case 'trashCustomer': {
        const raw = customerActionSchema.parse(input)
        const existing = await getRecord<Customer>(client, raw.id, 'customer')
        if (!existing) {
          const already = parseDeletedCustomer(await getRecord<unknown>(client, raw.id, 'archive'))
          if (already) { result = already; break }
          throw new Error('Kunde nicht gefunden.')
        }
        const related = await collectCustomerRelations(client, existing)
        const timestamp = nowIso()
        const deleted: DeletedCustomer = {
          id: existing.id, kind: 'deleted_customer', customer: existing, related, deletedAt: timestamp, deletedBy: actor.profileId,
          purgeAfter: dateKeyPlusDays(timestamp, RETENTION_CONFIG.customerTrashDays), reason: raw.reason ?? 'manual', createdAt: existing.createdAt, updatedAt: timestamp,
        }
        result = await upsertRecord(client, 'archive', deleted, actor.profileId)
        for (const visit of related.visits) await archiveCustomerRelatedRecord(client, 'visit', visit, deleted.id, actor.profileId)
        for (const appointment of related.appointments) await archiveCustomerRelatedRecord(client, 'appointment', appointment, deleted.id, actor.profileId)
        for (const notification of related.notifications) await archiveCustomerRelatedRecord(client, 'notification', notification, deleted.id, actor.profileId)
        await audit(client, actor.profileId, 'customer.trashed', 'customer', existing.id, { reason: deleted.reason, documentCount: related.documents.length })
        break
      }
      case 'restoreCustomer': {
        const raw = idOnlySchema.parse(input)
        const deleted = parseDeletedCustomer(await getRecord<unknown>(client, raw.id, 'archive'))
        if (!deleted) throw new Error('Kunden-Papierkorb-Eintrag nicht gefunden.')
        for (const visit of deleted.related.visits) await upsertRecord(client, 'visit', visit, actor.profileId)
        for (const appointment of deleted.related.appointments) await upsertRecord(client, 'appointment', appointment, actor.profileId)
        for (const notification of deleted.related.notifications) await upsertRecord(client, 'notification', notification, actor.profileId)
        result = await upsertRecord(client, 'customer', { ...deleted.customer, recordState: 'active', updatedAt: nowIso() }, actor.profileId)
        await audit(client, actor.profileId, 'customer.restored', 'customer', deleted.customer.id)
        break
      }
      case 'purgeCustomer': {
        const raw = idOnlySchema.parse(input)
        const deleted = parseDeletedCustomer(await getRecord<unknown>(client, raw.id, 'archive'))
        if (!deleted) throw new Error('Kunden-Papierkorb-Eintrag nicht gefunden.')
        const admin = createSupabaseAdminClient()
        const ids = [deleted.id, ...deleted.related.visits.map((item) => item.id), ...deleted.related.appointments.map((item) => item.id), ...deleted.related.notifications.map((item) => item.id)]
        await deleteCustomerDocuments(deleted.customer.id)
        const { error: auditError } = await admin.from('audit_log').delete().in('entity_id', ids)
        if (auditError) throw auditError
        const { error: deleteError } = await admin.from('app_records').delete().in('id', ids)
        if (deleteError) throw deleteError
        result = { id: deleted.id, purged: ids.length, documents: deleted.related.documents.length }
        break
      }
      case 'cancelCustomer': {
        const raw = cancellationInputSchema.parse(input)
        const existing = await getRecord<Customer>(client, raw.id, 'customer')
        if (!existing || !raw.cancellation) throw new Error('Kunde nicht gefunden.')
        const customer: Customer = { ...existing, status: 'cancelled', followUpAt: undefined, cancellation: { ...raw.cancellation, reason: raw.cancellation.reason || 'Kein Grund angegeben', createdBy: actor.profileId }, updatedAt: nowIso() }
        await upsertRecord(client, 'customer', customer, actor.profileId)
        await resolveOpenCustomerFollowUps(client, customer.id, actor.profileId)
        const notification: NotificationItem = {
          id: makeId('notification'), type: 'cancellation', title: 'Storno erfasst', summary: 'Ein Abschluss wurde storniert.',
          scheduledAt: nowIso(), linkedType: 'customer', linkedId: customer.id, audience: 'both', createdAt: nowIso(), updatedAt: nowIso(),
        }
        await upsertRecord(client, 'notification', notification, actor.profileId)
        await audit(client, actor.profileId, 'customer.cancelled', 'customer', customer.id, { category: raw.cancellation.category })
        result = customer
        break
      }
      case 'saveAppointment': {
        const raw = appointmentInputSchema.parse(input)
        const existing = raw.id ? await getRecord<Appointment>(client, raw.id, 'appointment') : undefined
        const appointment: Appointment = {
          ...raw,
          id: raw.id ?? makeId('appointment'),
          createdBy: existing?.createdBy ?? actor.profileId,
          createdAt: existing?.createdAt ?? raw.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        }
        result = await upsertRecord(client, 'appointment', appointment, actor.profileId)
        const notification: NotificationItem = {
          id: makeId('notification'),
          type: 'appointment',
          title: existing ? (appointment.status === 'completed' ? 'Termin erledigt' : 'Termin geändert') : 'Neuer gemeinsamer Termin',
          summary: existing ? 'Ein gemeinsamer Termin wurde aktualisiert.' : 'Ein Termin wurde eingetragen.',
          scheduledAt: nowIso(),
          linkedType: 'appointment',
          linkedId: appointment.id,
          audience: appointment.assignedTo,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        await upsertRecord(client, 'notification', notification, actor.profileId)
        await audit(client, actor.profileId, existing ? 'appointment.updated' : 'appointment.created', 'appointment', appointment.id)
        break
      }
      case 'saveNotification': {
        const raw = notificationInputSchema.parse(input)
        const existing = raw.id ? await getRecord<NotificationItem>(client, raw.id, 'notification') : undefined
        const item: NotificationItem = {
          ...raw,
          id: raw.id ?? makeId('notification'),
          ackVossAt: existing?.ackVossAt,
          ackDickeAt: existing?.ackDickeAt,
          resolvedAt: existing?.resolvedAt,
          createdAt: existing?.createdAt ?? raw.createdAt ?? nowIso(),
          updatedAt: nowIso(),
        }
        result = await upsertRecord(client, 'notification', item, actor.profileId)
        break
      }
      case 'acknowledgeNotification': {
        const raw = idOnlySchema.parse(input)
        const item = await getRecord<NotificationItem>(client, raw.id, 'notification')
        if (!item) throw new Error('Benachrichtigung nicht gefunden.')
        const timestamp = nowIso()
        const updated: NotificationItem = { ...item, ...(actor.profileId === 'voss' ? { ackVossAt: timestamp } : { ackDickeAt: timestamp }), updatedAt: timestamp }
        if (updated.audience === 'voss' && updated.ackVossAt) updated.resolvedAt = timestamp
        if (updated.audience === 'dicke' && updated.ackDickeAt) updated.resolvedAt = timestamp
        if (updated.audience === 'both' && updated.ackVossAt && updated.ackDickeAt) updated.resolvedAt = timestamp
        result = await upsertRecord(client, 'notification', updated, actor.profileId)
        await audit(client, actor.profileId, 'notification.acknowledged', 'notification', updated.id)
        break
      }
      case 'startWork': {
        const date = toLocalDateKey()
        const { data, error } = await client.from('app_records').select('payload').eq('record_type', 'work_session')
        if (error) throw error
        const active = (data ?? []).map((row) => row.payload as WorkSession).find((item) => item.profileId === actor.profileId && item.date === date && !item.endedAt)
        if (active) { result = active; break }
        const session: WorkSession = { id: makeId('work'), profileId: actor.profileId, date, startedAt: nowIso(), pauses: [], updatedAt: nowIso() }
        result = await upsertRecord(client, 'work_session', session, actor.profileId)
        await audit(client, actor.profileId, 'work.started', 'work_session', session.id)
        break
      }
      case 'togglePause': {
        const raw = idOnlySchema.parse(input)
        const session = await getRecord<WorkSession>(client, raw.id, 'work_session')
        if (!session || session.profileId !== actor.profileId || session.endedAt) throw new Error('Aktive Arbeitszeit nicht gefunden.')
        const timestamp = nowIso()
        const pauses = [...session.pauses]
        const current = pauses.at(-1)
        if (current && !current.endedAt) current.endedAt = timestamp
        else pauses.push({ startedAt: timestamp })
        result = await upsertRecord(client, 'work_session', { ...session, pauses, updatedAt: timestamp }, actor.profileId)
        break
      }
      case 'endWork': {
        const raw = idOnlySchema.parse(input)
        const session = await getRecord<WorkSession>(client, raw.id, 'work_session')
        if (!session || session.profileId !== actor.profileId || session.endedAt) throw new Error('Aktive Arbeitszeit nicht gefunden.')
        const timestamp = nowIso()
        const pauses = session.pauses.map((pause) => pause.endedAt ? pause : { ...pause, endedAt: timestamp })
        result = await upsertRecord(client, 'work_session', { ...session, pauses, endedAt: timestamp, updatedAt: timestamp }, actor.profileId)
        await audit(client, actor.profileId, 'work.ended', 'work_session', session.id)
        break
      }
      case 'saveDayNote': {
        const note = dayNoteInputSchema.parse(input)
        result = await upsertRecord(client, 'day_note', { ...note, profileId: actor.profileId, updatedAt: nowIso() }, actor.profileId)
        break
      }
      case 'saveArchive': {
        const archive = archiveInputSchema.parse(input) as unknown as import('@/lib/types').WeekArchive
        result = await upsertRecord(client, 'archive', archive, actor.profileId)
        break
      }
      default:
        return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.issues[0]
      const path = first?.path?.length ? ` (${first.path.join('.')})` : ''
      return NextResponse.json({ ok: false, error: `${first?.message ?? 'Eingabe ist unvollständig, ungültig oder zu lang.'}${path}` }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Änderung konnte nicht gespeichert werden.'
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400
    return NextResponse.json({ ok: false, error: message }, { status })
  }
}
