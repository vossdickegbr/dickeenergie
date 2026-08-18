'use client'

import { useMemo, useState } from 'react'
import { CalendarCheck2, Clock3, Coffee, LogIn, LogOut, UserPlus, UsersRound } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import type { ProfileId } from '@/lib/types'
import { formatDate, formatDateTime, formatMinutes, PROFILE_LABELS, toLocalDateKey, workMinutes } from '@/lib/utils'

function partnerOf(profileId: ProfileId): ProfileId {
  return profileId === 'voss' ? 'dicke' : 'voss'
}

export function PartnerActivitySection({ profileId }: { profileId: ProfileId }) {
  const data = useAppData()
  const partnerId = partnerOf(profileId)
  const today = toLocalDateKey()
  const availableDates = useMemo(() => {
    const dates = new Set<string>([today])
    data.workSessions.filter((item) => item.profileId === partnerId).forEach((item) => dates.add(item.date))
    data.customers.filter((item) => item.completedBy === partnerId).forEach((item) => dates.add(toLocalDateKey(new Date(item.createdAt))))
    data.appointments.filter((item) => item.createdBy === partnerId).forEach((item) => dates.add(toLocalDateKey(new Date(item.createdAt))))
    return [...dates].sort((a, b) => b.localeCompare(a))
  }, [data.workSessions, data.customers, data.appointments, partnerId, today])
  const [selectedDate, setSelectedDate] = useState(today)

  const sessions = useMemo(() => data.workSessions
    .filter((item) => item.profileId === partnerId && item.date === selectedDate)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt)), [data.workSessions, partnerId, selectedDate])
  const customers = useMemo(() => data.customers
    .filter((item) => item.completedBy === partnerId && toLocalDateKey(new Date(item.createdAt)) === selectedDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [data.customers, partnerId, selectedDate])
  const appointments = useMemo(() => data.appointments
    .filter((item) => item.createdBy === partnerId && toLocalDateKey(new Date(item.createdAt)) === selectedDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [data.appointments, partnerId, selectedDate])

  const todaySession = data.workSessions.find((item) => item.profileId === partnerId && item.date === today && !item.endedAt)
  const paused = Boolean(todaySession?.pauses.at(-1) && !todaySession.pauses.at(-1)?.endedAt)
  const state = todaySession ? (paused ? 'Pause' : 'Aktiv') : 'Offline'
  const minutes = sessions.reduce((sum, item) => sum + workMinutes(item), 0)

  const events = useMemo(() => {
    const rows: Array<{ at: string; title: string; detail: string; kind: 'start' | 'pause' | 'end' | 'customer' | 'appointment' }> = []
    sessions.forEach((session) => {
      rows.push({ at: session.startedAt, title: 'Schicht gestartet', detail: `Beginn um ${formatDateTime(session.startedAt, { dateStyle: undefined, timeStyle: 'short' })}`, kind: 'start' })
      session.pauses.forEach((pause) => {
        rows.push({ at: pause.startedAt, title: 'Pause gestartet', detail: pause.endedAt ? `Pause bis ${formatDateTime(pause.endedAt, { dateStyle: undefined, timeStyle: 'short' })}` : 'Pause läuft', kind: 'pause' })
        if (pause.endedAt) rows.push({ at: pause.endedAt, title: 'Arbeit fortgesetzt', detail: 'Pause beendet', kind: 'start' })
      })
      if (session.endedAt) rows.push({ at: session.endedAt, title: 'Schicht beendet', detail: `Nettoarbeitszeit ${formatMinutes(workMinutes(session))}`, kind: 'end' })
    })
    customers.forEach((customer) => rows.push({ at: customer.createdAt, title: 'Kunde aufgenommen', detail: `${customer.name} · ${customer.street} ${customer.houseNumber}, ${customer.city}`, kind: 'customer' }))
    appointments.forEach((appointment) => rows.push({ at: appointment.createdAt, title: 'Termin eingetragen', detail: `${appointment.title} · Termin ${formatDateTime(appointment.startsAt)}`, kind: 'appointment' }))
    return rows.sort((a, b) => b.at.localeCompare(a.at))
  }, [sessions, customers, appointments])

  const iconFor = (kind: typeof events[number]['kind']) => {
    if (kind === 'start') return <LogIn />
    if (kind === 'pause') return <Coffee />
    if (kind === 'end') return <LogOut />
    if (kind === 'customer') return <UserPlus />
    return <CalendarCheck2 />
  }

  return (
    <div className="page-shell partner-activity-page">
      <header className="page-topbar"><div><span className="eyebrow">Live & nachvollziehbar</span><h1>Partner-Ticker</h1><p>Aktueller Arbeitsstatus und täglicher Verlauf von {PROFILE_LABELS[partnerId]}.</p></div></header>

      <section className={`partner-live-hero ${state.toLowerCase()}`}>
        <div className="partner-live-dot" />
        <div><small>Aktueller Status</small><h2>{state}</h2><p>{todaySession ? `Seit ${formatDateTime(paused ? todaySession.pauses.at(-1)?.startedAt : todaySession.startedAt, { dateStyle: undefined, timeStyle: 'short' })}` : 'Heute keine laufende Schicht'}</p></div>
        <div className="partner-live-time"><Clock3 /><span>Netto heute</span><strong>{formatMinutes(data.workSessions.filter((item) => item.profileId === partnerId && item.date === today).reduce((sum, item) => sum + workMinutes(item), 0))}</strong></div>
      </section>

      <section className="partner-day-toolbar">
        <label>Tag ansehen<select value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>{availableDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}</select></label>
        <div><span><Clock3 /> {formatMinutes(minutes)}</span><span><UsersRound /> {customers.length} Kunden</span><span><CalendarCheck2 /> {appointments.length} Termine</span></div>
      </section>

      <section className="partner-timeline">
        <h2>Verlauf am {formatDate(selectedDate)}</h2>
        {events.map((event) => <article key={`${event.kind}-${event.at}-${event.title}`}><div className={`partner-event-icon ${event.kind}`}>{iconFor(event.kind)}</div><div><time>{formatDateTime(event.at, { dateStyle: undefined, timeStyle: 'short' })}</time><strong>{event.title}</strong><p>{event.detail}</p></div></article>)}
        {!events.length && <div className="large-empty"><Clock3 /><h2>Keine Aktivitäten gespeichert</h2><p>Für diesen Tag gibt es noch keine Schicht, Termine oder aufgenommenen Kunden.</p></div>}
      </section>
    </div>
  )
}
