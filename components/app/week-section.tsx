'use client'

import { useMemo, useState } from 'react'
import { BarChart3, ChevronRight, ExternalLink, Map, MapPin, Route, ShieldCheck, Target } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { StreetMode } from '@/components/app/street-mode'
import { HandwritingPad } from '@/components/common/handwriting-pad'
import { weekPlan } from '@/lib/week'
import type { ProfileId } from '@/lib/types'
import { formatDate, googleDirectionsUrl, googleStreetViewSearchUrl, makeId, nowIso } from '@/lib/utils'
import { commissionShares, formatEuroFromCents, salesOwnerOf } from '@/lib/commission'

export function WeekSection({ profileId }: { profileId: ProfileId }) {
  const { visits, customers, dayNotes, saveDayNote } = useAppData()
  const [selectedDayId, setSelectedDayId] = useState(weekPlan.days[0].id)
  const [streetMode, setStreetMode] = useState<string | null>(null)
  const day = weekPlan.days.find((item) => item.id === selectedDayId) ?? weekPlan.days[0]
  const dayVisits = visits.filter((visit) => visit.dayId === day.id && visit.status !== 'open')
  const note = dayNotes.find((item) => item.weekId === weekPlan.id && item.dayId === day.id && item.profileId === profileId)
  const counts = useMemo(() => ({
    all: dayVisits.length,
    red: dayVisits.filter((item) => item.status === 'red').length,
    yellow: dayVisits.filter((item) => item.status === 'yellow').length,
    green: dayVisits.filter((item) => item.status === 'green').length,
    absent: dayVisits.filter((item) => item.status === 'absent').length,
  }), [dayVisits])
  const weekCommission = useMemo(() => customers
    .filter((item) => item.weekId === weekPlan.id)
    .reduce((totals, customer) => {
      const shares = commissionShares(customer)
      totals.total += shares.total
      totals.voss += shares.voss
      totals.dicke += shares.dicke
      if (salesOwnerOf(customer) === 'both') totals.shared += 1
      if (customer.status === 'active' && customer.recordState !== 'draft') totals.customers += 1
      return totals
    }, { total: 0, voss: 0, dicke: 0, shared: 0, customers: 0 }), [customers])

  if (streetMode) return <StreetMode plan={weekPlan} day={day} profileId={profileId} initialStreet={streetMode} />

  return (
    <div className="page-shell week-page">
      <header className="page-topbar">
        <div><span className="eyebrow">{weekPlan.title}</span><h1>Wochenplan · {weekPlan.district}</h1><p>{formatDate(weekPlan.startsOn)} – {formatDate(weekPlan.endsOn)} · {weekPlan.workingHours}</p></div>
        <a className="secondary-button" href={weekPlan.sourcePdf} target="_blank" rel="noreferrer"><ExternalLink /> Original-PDF</a>
      </header>

      <section className="week-day-tabs">
        {weekPlan.days.map((item) => {
          const entries = visits.filter((visit) => visit.dayId === item.id && visit.status !== 'open').length
          return <button key={item.id} className={item.id === day.id ? 'active' : ''} type="button" onClick={() => setSelectedDayId(item.id)}><small>Tag {item.dayNumber}</small><strong>{item.weekday}</strong><span>{entries} Einträge</span></button>
        })}
      </section>

      <section className="day-hero-card">
        <div><span className="eyebrow light">Tag {day.dayNumber} · {formatDate(day.date)}</span><h2>{day.title}</h2><p>{day.subtitle}</p><blockquote>{day.goalText}</blockquote></div>
        <button type="button" onClick={() => setStreetMode(day.streets[0])}><Route /> D2D-Schnellmodus <ChevronRight /></button>
      </section>

      <section className="metric-row">
        {day.goals.map((goal) => <article key={goal.label}><Target /><div><strong>{goal.value}</strong><span>{goal.label}</span><small>{goal.caption}</small></div></article>)}
        <article><BarChart3 /><div><strong>{counts.all}</strong><span>Erfasst</span><small>{counts.green} grün · {counts.yellow} gelb</small></div></article>
      </section>

      <section className="panel-card weekly-commission-panel">
        <div className="section-heading compact"><div><span className="eyebrow">Wochenbericht · Provision</span><h2>Wöchentlicher Verdienst-Nachweis</h2><p>Aktive Abschlüsse dieser Woche; gemeinsame Kunden werden automatisch 50/50 geteilt.</p></div><BarChart3 /></div>
        <div className="weekly-commission-grid">
          <article><span>Herr Voss</span><strong>{formatEuroFromCents(weekCommission.voss)}</strong></article>
          <article><span>Herr Dicke</span><strong>{formatEuroFromCents(weekCommission.dicke)}</strong></article>
          <article><span>Provision gesamt</span><strong>{formatEuroFromCents(weekCommission.total)}</strong></article>
          <article><span>Abschlüsse / 50/50</span><strong>{weekCommission.customers} / {weekCommission.shared}</strong></article>
        </div>
        <p className="field-rule"><ShieldCheck /> Derselbe Nachweis wird als gesonderter Abschnitt in den PDF-Wochenbericht übernommen; Stornos zählen mit 0,00 € Anspruch.</p>
      </section>

      <div className="week-detail-grid">
        <section className="panel-card">
          <div className="section-heading compact"><div><span className="eyebrow">Tagesablauf</span><h2>{weekPlan.workingHours}</h2></div></div>
          <div className="timeline-list">{day.schedule.map((item) => <article key={`${item.time}-${item.label}`}><time>{item.time}</time><div><strong>{item.label}</strong><p>{item.detail}</p></div></article>)}</div>
        </section>
        <section className="panel-card analysis-panel">
          <div className="section-heading compact"><div><span className="eyebrow">Gebietsanalyse</span><h2>Chance, Risiko, Taktik</h2></div></div>
          <article className="chance"><strong>Chance</strong><p>{day.analysis.chance}</p></article>
          <article className="risk"><strong>Risiko</strong><p>{day.analysis.risk}</p></article>
          <article className="tactic"><strong>Taktik</strong><p>{day.analysis.tactic}</p></article>
        </section>
      </div>

      <section className="panel-card street-plan-card">
        <div className="section-heading"><div><span className="eyebrow">Straßenliste · {day.housePointEstimate}</span><h2>{day.start} → {day.end}</h2><p>{day.routeNote}</p></div><MapPin /></div>
        <div className="planned-streets">
          {day.streets.map((street, index) => {
            const streetVisits = dayVisits.filter((visit) => visit.street === street)
            return <button key={street} type="button" onClick={() => setStreetMode(street)}><span>{index + 1}</span><div><strong>{street}</strong><small>{streetVisits.length} Häuser · {streetVisits.filter((v) => v.status === 'green').length} Abschlüsse</small></div><ChevronRight /></button>
          })}
        </div>
        {day.reserveStreets?.length ? <div className="reserve-box"><strong>Reserve – nur wenn Rückläufer gesichert sind</strong><p>{day.reserveStreets.join(' · ')}</p></div> : null}
        <div className="route-buttons">
          {day.mapRoutes.map((route) => <a key={route.label} href={googleDirectionsUrl(route)} target="_blank" rel="noreferrer"><Map /> {route.label} in Google Maps</a>)}
          <a href={googleStreetViewSearchUrl(`${day.streets[0]}, Bonn`)} target="_blank" rel="noreferrer"><ExternalLink /> Street View öffnen</a>
        </div>
        <p className="field-rule"><ShieldCheck /> {day.fieldRule}</p>
      </section>

      <HandwritingPad initialDataUrl={note?.drawingDataUrl} onSave={async (drawingDataUrl) => {
        await saveDayNote({ id: note?.id ?? makeId('daynote'), weekId: weekPlan.id, dayId: day.id, profileId, drawingDataUrl, text: note?.text, reflection: note?.reflection, updatedAt: nowIso() })
      }} />
    </div>
  )
}
