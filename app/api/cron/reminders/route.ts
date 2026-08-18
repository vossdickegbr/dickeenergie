import { NextResponse } from 'next/server'
import type { Appointment, Customer, NotificationItem, WorkSession } from '@/lib/types'
import { berlinParts, cronAuthorized } from '@/lib/timezone'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { pushToAudience } from '@/lib/push'
import { nowIso } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isDueWindow(target: number, now: number) {
  return target <= now + 60_000 && target > now - 16 * 60_000
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return NextResponse.json({ ok: false }, { status: 401 })
  try {
    const client = createSupabaseAdminClient()
    const { data, error } = await client.from('app_records').select('id,record_type,payload')
    if (error) throw error
    const rows = data ?? []
    const ids = new Set(rows.map((row) => row.id as string))
    const now = Date.now()
    const parts = berlinParts(new Date(now))
    const created: NotificationItem[] = []
    const existingNotifications = rows.filter((row) => row.record_type === 'notification').map((row) => row.payload as NotificationItem)

    const add = (item: NotificationItem) => {
      if (ids.has(item.id)) return
      ids.add(item.id)
      created.push(item)
    }

    for (const row of rows) {
      if (row.record_type === 'appointment') {
        const appointment = row.payload as Appointment
        if (appointment.status !== 'scheduled') continue
        for (const minutes of appointment.reminderMinutes ?? [1440, 60, 0]) {
          const due = new Date(appointment.startsAt).getTime() - minutes * 60_000
          if (!isDueWindow(due, now)) continue
          const label = minutes === 1440 ? 'Termin morgen' : minutes === 60 ? 'Termin in einer Stunde' : 'Termin jetzt'
          add({
            id: `appointment-reminder-${appointment.id}-${minutes}`,
            type: 'appointment',
            title: label,
            summary: 'Ein gemeinsamer Termin steht an.',
            scheduledAt: new Date(due).toISOString(),
            linkedType: 'appointment',
            linkedId: appointment.id,
            audience: appointment.assignedTo,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          })
        }
      }

      if (row.record_type === 'customer') {
        const customer = row.payload as Customer
        if (customer.status !== 'active' || !customer.followUpAt || customer.followUpAt.slice(0, 10) > parts.dateKey || parts.hour < 9) continue
        const alreadyScheduledToday = existingNotifications.some((item) => (
          item.type === 'follow_up'
          && item.linkedType === 'customer'
          && item.linkedId === customer.id
          && item.scheduledAt.slice(0, 10) === parts.dateKey
        ))
        if (alreadyScheduledToday) continue
        add({
          id: `followup-${customer.id}-${parts.dateKey}`,
          type: 'follow_up',
          title: 'Kunden-Wiedervorlage weiterhin offen',
          summary: 'Ein abgeschlossener Kunde soll kontaktiert werden.',
          scheduledAt: nowIso(),
          linkedType: 'customer',
          linkedId: customer.id,
          audience: 'both',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })
      }
    }

    if (parts.hour >= 20) {
      const isAllowedSlot = parts.hour === 20 || parts.minute < 15 || (parts.minute >= 30 && parts.minute < 45)
      if (isAllowedSlot) {
        const slotMinute = parts.minute < 15 ? '00' : parts.minute < 30 ? '15' : parts.minute < 45 ? '30' : '45'
        for (const row of rows) {
          if (row.record_type !== 'work_session') continue
          const session = row.payload as WorkSession
          if (session.date !== parts.dateKey || session.endedAt) continue
          add({
            id: `worktime-${session.profileId}-${parts.dateKey}-${parts.hour}${slotMinute}`,
            type: 'worktime',
            title: 'Arbeitszeit läuft noch',
            summary: 'Bitte Arbeitszeit beenden oder bewusst weiterlaufen lassen.',
            scheduledAt: nowIso(),
            linkedType: 'day',
            linkedId: session.date,
            audience: session.profileId,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          })
        }
      }
    }

    if (created.length) {
      const { error: insertError } = await client.from('app_records').upsert(created.map((item) => ({
        id: item.id,
        record_type: 'notification',
        payload: item,
        created_by: null,
        updated_at: nowIso(),
      })), { onConflict: 'id', ignoreDuplicates: true })
      if (insertError) throw insertError
      for (const item of created) {
        await pushToAudience(item.audience, { title: item.title, body: item.summary, tag: item.id, url: '/?section=notifications' })
      }
    }

    // Unconfirmed due notifications are pushed again every 30 minutes.
    if (parts.minute < 15 || (parts.minute >= 30 && parts.minute < 45)) {
      for (const item of existingNotifications) {
        if (item.resolvedAt || new Date(item.scheduledAt).getTime() > now) continue
        const generic = { title: item.title, body: item.summary, tag: `${item.id}-repeat`, url: '/?section=notifications' }
        if (item.audience === 'both') {
          if (!item.ackVossAt) await pushToAudience('voss', generic)
          if (!item.ackDickeAt) await pushToAudience('dicke', generic)
        } else if (item.audience === 'voss' && !item.ackVossAt) await pushToAudience('voss', generic)
        else if (item.audience === 'dicke' && !item.ackDickeAt) await pushToAudience('dicke', generic)
      }
    }

    return NextResponse.json({ ok: true, created: created.length })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Reminder-Lauf fehlgeschlagen.' }, { status: 500 })
  }
}
