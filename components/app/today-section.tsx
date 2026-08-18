'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, BellRing, CalendarClock, CheckCircle2, ChevronRight, Map, MapPin, PhoneCall, Route, TimerReset } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { StreetMode } from '@/components/app/street-mode'
import { WorkTimer } from '@/components/app/work-timer'
import { getTodayDay, weekPlan } from '@/lib/week'
import type { ProfileId } from '@/lib/types'
import { formatDateTime, googleDirectionsUrl, toLocalDateKey } from '@/lib/utils'

export function TodaySection({ profileId }: { profileId: ProfileId }) {
  const { appointments, visits, notifications } = useAppData()
  const day = getTodayDay()
  const today = toLocalDateKey()
  const [streetMode, setStreetMode] = useState<string | null>(null)

  const todayAppointments = useMemo(() => appointments
    .filter((item) => item.status === 'scheduled' && item.startsAt.slice(0, 10) === today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [appointments, today])
  const dayVisits = visits.filter((item) => item.dayId === day.id && item.status !== 'open')
  const callbacks = dayVisits.filter((item) => item.status === 'yellow')
  const openNotices = notifications.filter((item) => !item.resolvedAt && (item.audience === 'both' || item.audience === profileId))

  if (streetMode) return <StreetMode plan={weekPlan} day={day} profileId={profileId} initialStreet={streetMode} />

  return (
    <div className="page-shell today-page">
      <header className="page-topbar">
        <div><span className="eyebrow">Arbeitstag · {day.weekday}</span><h1>{day.title}</h1><p>{weekPlan.district} · {weekPlan.workingHours}</p></div>
        <WorkTimer profileId={profileId} />
      </header>

      <section className="today-command-card">
        <div className="command-main">
          <span className="eyebrow light">Heute alles auf einen Blick</span>
          <h2>{weekPlan.district}</h2>
          <p>{day.goalText}</p>
          <div className="command-stats">
            {day.goals.map((goal) => <div key={goal.label}><strong>{goal.value}</strong><span>{goal.label}</span><small>{goal.caption}</small></div>)}
          </div>
        </div>
        <div className="command-actions">
          <button className="big-start-button" type="button" onClick={() => setStreetMode(day.streets[0])}><Route /> Erste Straße starten <ArrowRight /></button>
          <a href={googleDirectionsUrl(day.mapRoutes[0])} target="_blank" rel="noreferrer"><Map /> Gesamtroute öffnen</a>
        </div>
      </section>

      <div className="today-grid">
        <section className="panel-card today-agenda">
          <div className="section-heading compact"><div><span className="eyebrow">Termine & Rückkehr</span><h2>Was heute ansteht</h2></div><CalendarClock /></div>
          <div className="agenda-list">
            {todayAppointments.map((appointment) => (
              <article key={appointment.id}>
                <time>{formatDateTime(appointment.startsAt, { timeStyle: 'short' })}</time>
                <div><strong>{appointment.title}</strong><span>{appointment.address ?? 'Keine Adresse hinterlegt'}</span></div>
                {appointment.phone && <a href={`tel:${appointment.phone}`} aria-label="Anrufen"><PhoneCall /></a>}
              </article>
            ))}
            {!todayAppointments.length && <div className="empty-agenda"><CheckCircle2 /><p><strong>Keine festen Termine.</strong><span>Volle Konzentration auf die geplante Route.</span></p></div>}
          </div>
          <div className="mini-summary"><span><TimerReset /> {callbacks.length} gelbe Rückkehrkontakte</span><span><BellRing /> {openNotices.length} offene Benachrichtigungen</span></div>
        </section>

        <section className="panel-card route-order">
          <div className="section-heading compact"><div><span className="eyebrow">Vorgegebene Reihenfolge</span><h2>Straßenroute</h2></div><MapPin /></div>
          <p className="route-note">{day.routeNote}</p>
          <div className="street-order-list">
            {day.streets.map((street, index) => {
              const count = dayVisits.filter((visit) => visit.street === street).length
              return (
                <button type="button" key={street} onClick={() => setStreetMode(street)}>
                  <span>{index + 1}</span><div><strong>{street}</strong><small>{count ? `${count} Häuser markiert` : 'Noch offen'}</small></div><ChevronRight />
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <section className="schedule-strip">
        {day.schedule.map((item) => <article key={`${item.time}-${item.label}`}><time>{item.time}</time><strong>{item.label}</strong><p>{item.detail}</p></article>)}
      </section>
    </div>
  )
}
