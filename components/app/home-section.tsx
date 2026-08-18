'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Bell, CalendarDays, CheckCircle2, Flame, MapPin, Rocket, Sparkles, Target, Trophy, Users } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { weekPlan, getTodayDay } from '@/lib/week'
import type { AppSection, ProfileId } from '@/lib/types'
import { formatDateTime, PROFILE_LABELS, toLocalDateKey } from '@/lib/utils'

const impulses = [
  ['Die nächste Tür kann alles ändern.', 'Konzentriert bleiben. Sauber beraten. Stark abschließen.'],
  ['Heute wird nicht gehofft. Heute wird gemacht.', 'Jede Straße vollständig, jeder Kontakt sauber dokumentiert.'],
  ['Energie folgt Klarheit.', 'Ein klarer Einstieg schafft Vertrauen und öffnet Gespräche.'],
  ['Du brauchst keinen perfekten Tag.', 'Du brauchst den nächsten guten Kontakt.'],
  ['Konstanz schlägt Stimmung.', 'Auch ein ruhiger Start kann ein starker Abschluss werden.'],
  ['Beratung vor Abschluss.', 'Vertrauen vor Tempo – genau daraus entstehen Empfehlungen.'],
  ['Ein Nein ist nur eine Information.', 'Lernen, abhaken, zur nächsten Tür gehen.'],
  ['Fokus auf den Prozess.', 'Straßenseite, Dokumentation, Nachfassen, Abschluss.'],
  ['Heute entsteht die Pipeline von morgen.', 'Gelbe Kontakte sauber terminieren und dranbleiben.'],
  ['Zwei Personen. Ein System. Ein Ziel.', 'Gemeinsam schnell arbeiten, gemeinsam besser werden.'],
  ['Qualität ist euer Tempo-Vorteil.', 'Klare Abläufe lassen mehr Raum für gute Gespräche.'],
  ['Jede Zahl erzählt eine Geschichte.', 'Dokumentiert sauber, damit ihr gezielt besser werdet.'],
  ['Der Tag beginnt mit dem ersten klaren Schritt.', 'Arbeitstag starten und direkt die erste Straße öffnen.'],
  ['Nicht springen. Strecke schließen.', 'Vollständige Straßen schaffen Überblick und Momentum.'],
  ['Aus Rückläufern werden Abschlüsse.', 'Heiß vor warm vor neu.'],
  ['Einfach. Schnell. Verlässlich.', 'Das System arbeitet für euch, nicht umgekehrt.'],
  ['Gute Energie ist ansteckend.', 'Ruhig auftreten, ehrlich beraten, positiv bleiben.'],
  ['Der beste Einwand ist der, aus dem ihr lernt.', 'Kurz notieren und beim nächsten Gespräch besser antworten.'],
  ['Heute zählt der nächste saubere Kontakt.', 'Nicht die letzte Tür und nicht die letzte Woche.'],
  ['Starke Wochen entstehen aus klaren Tagen.', 'Ziele sehen, Route öffnen, Schritt für Schritt arbeiten.'],
  ['Abschluss ist kein Zufall.', 'Er ist das Ergebnis aus Bedarf, Vertrauen und sauberem Nachfassen.'],
  ['Tempo ohne Hektik.', 'Große Buttons, wenige Eingaben, volle Konzentration auf Menschen.'],
  ['Ihr seid ein Team – auch auf zwei Straßenseiten.', 'Live markieren, Konflikte vermeiden, Fortschritt teilen.'],
  ['Heute Abend soll die Statistik ehrlich sein.', 'Dann zeigt sie morgen genau, wo ihr wachsen könnt.'],
  ['Der Unterschied liegt im Dranbleiben.', 'Vereinbarte Rückkehrzeiten sind Versprechen.'],
  ['Nicht jede Tür wird grün.', 'Aber jede sauber markierte Tür macht die Route besser.'],
  ['Mut beginnt mit Klingeln.', 'Professionalität beginnt mit Zuhören.'],
  ['Ein klarer Plan schafft einen freien Kopf.', 'Die App hält fest – ihr konzentriert euch auf das Gespräch.'],
]

const successSteps = [
  {
    title: 'Positive Einstellung',
    points: ['Dein Erfolg hängt zu 90 % von Deiner Einstellung ab, nicht umgekehrt.'],
  },
  {
    title: 'Pünktlichkeit',
    points: ['Ist selbstverständlich.', 'Das richtige Zeitmanagement erleichtert den Tagesablauf.'],
  },
  {
    title: 'Gute Vorbereitung',
    points: ['Auf Dein Äußeres, Dein Gebiet und Deine Kunden.', 'Auf negative und positive Reaktionen.', 'Dein Mindset.'],
  },
  {
    title: 'Voller Arbeitseinsatz',
    points: ['Echter Einsatz zahlt sich aus.', 'Arbeite wie in einem Vollzeitjob (8 Stunden).'],
  },
  {
    title: 'Effektive Gebietsbearbeitung',
    points: ['Keine Vorurteile: Jeder Mensch und jedes Geschäft ist ein potenzieller Kunde.', 'Gebietswechsel kostet Zeit und Geld.'],
  },
  {
    title: 'Behalte Deine positive Einstellung',
    points: ['Jedes Nein bringt Dich einem Abschluss näher.', 'Schnelle Körbe sind gute Körbe.', 'Der Kunde hat das Recht, Nein zu sagen.', 'Bleibe stets souverän und freundlich.'],
  },
  {
    title: 'Werde Dir bewusst, warum Du hier bist',
    points: ['Wo auf unserem Erfolgsweg stehst Du?', 'Setze Dir Ziele: kurzfristige, mittelfristige und langfristige Ziele.', 'Was ist Dein Warum?'],
  },
  {
    title: 'Übe Kontrolle aus',
    points: ['Über Situationen und Deinen Erfolgsweg.', 'Zeige Lernbereitschaft und Eigeninitiative.'],
  },
]

const closingSteps = [
  {
    title: 'Vorstellung (Ziel = Sympathie)',
    points: ['Für den ersten Eindruck gibt es keine zweite Chance.', 'Sell yourself: Lächeln, Begeisterung, Blickkontakt.'],
  },
  {
    title: 'Kurzinfo (Ziel: Unterlagen erhalten)',
    points: ['Fasse Dich kurz.', 'Qualifizierung, Vertragspartner/-entscheider, RLZ.'],
  },
  {
    title: 'Präsentation (Ziel = keine offenen Fragen)',
    points: ['Stelle Dein Produkt freundlich, seriös und kompetent vor.', 'Ehrlichkeit siegt!', 'Stelle Vorteile, Preisgarantie und persönliche Betreuung klar heraus.'],
  },
  {
    title: 'Abschluss (Ziel = Unterschrift)',
    points: ['Der richtige Zeitpunkt ist entscheidend: weder überrumpeln noch unnötig ausschweifen.', 'Bleibe beim Ausfüllen im Gespräch und vermeide Schweige-Sekunden, indem Du weitere Vorteile hervorhebst.'],
  },
  {
    title: 'Kunden-Sicherung',
    points: ['Sei sicher, dass der Kunde sicher ist.', 'Investiere einige Minuten und fasse das Wichtigste zusammen.', 'Sende Deine Kontaktdaten per WhatsApp.', 'Du hast nun einen zufriedenen Kunden – frage anschließend nach Empfehlungen.'],
  },
]

const threePhaseRule = [
  ['Sympathie', 'Vertrauen schaffen: freundlich auftreten, zuhören und echtes Interesse zeigen.'],
  ['Erklären', 'Den Nutzen klar, ehrlich und verständlich auf den Punkt bringen.'],
  ['Auffordern', 'Den nächsten Schritt eindeutig ansprechen und aktiv um die Entscheidung bitten.'],
] as const


export function HomeSection({ profileId, onNavigate }: { profileId: ProfileId; onNavigate: (section: AppSection) => void }) {
  const { appointments, visits, customers, notifications } = useAppData()
  const day = getTodayDay()
  const today = toLocalDateKey()
  const [impulse] = useState(() => {
    if (typeof window === 'undefined') return impulses[0]
    const previous = Number(sessionStorage.getItem('vd_last_impulse') ?? -1)
    const next = (previous + 1) % impulses.length
    sessionStorage.setItem('vd_last_impulse', String(next))
    return impulses[next]
  })

  const todayAppointments = appointments
    .filter((item) => item.status === 'scheduled' && item.startsAt.slice(0, 10) === today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const todayVisits = visits.filter((item) => item.dayId === day.id && item.status !== 'open')
  const openNotifications = notifications.filter((item) => !item.resolvedAt && (item.audience === 'both' || item.audience === profileId))
  const activeCustomers = customers.filter((item) => item.status === 'active')

  return (
    <div className="page-shell home-page">
      <header className="page-topbar">
        <div><span className="eyebrow">Guten Tag, {PROFILE_LABELS[profileId]}</span><h1>Bereit für einen starken Tag?</h1></div>
      </header>

      <motion.section className="motivation-hero" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="hero-orbit"><Sparkles /><span /><span /><span /></div>
        <div className="hero-copy">
          <span className="eyebrow light">D2D-Impuls des Tages</span>
          <h2>{impulse[0]}</h2>
          <p>{impulse[1]}</p>
          <button type="button" onClick={() => onNavigate('today')}><Rocket /> Arbeitstag starten <ArrowRight /></button>
        </div>
        <div className="hero-today">
          <small>Heute</small>
          <strong>{day.weekday}</strong>
          <span>{weekPlan.district}</span>
          <p><MapPin /> {day.title}</p>
        </div>
      </motion.section>

      <section className="home-stat-grid">
        <button type="button" onClick={() => onNavigate('calendar')}><CalendarDays /><div><strong>{todayAppointments.length}</strong><span>Termine heute</span></div><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate('today')}><Target /><div><strong>{todayVisits.length}</strong><span>Adressen erfasst</span></div><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate('customers')}><Trophy /><div><strong>{activeCustomers.length}</strong><span>Aktive Abschlüsse</span></div><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Bell /><div><strong>{openNotifications.length}</strong><span>Offene Hinweise</span></div><ArrowRight /></button>
      </section>

      <section className="today-brief-card">
        <div className="section-heading"><div><span className="eyebrow">Heute in Kurzfassung</span><h2>{day.title}</h2><p>{day.subtitle}</p></div><button type="button" className="secondary-button" onClick={() => onNavigate('today')}>Alles öffnen <ArrowRight /></button></div>
        <div className="brief-columns">
          <div><span className="brief-icon"><MapPin /></span><div><small>Stadtteil & erste Straße</small><strong>{weekPlan.district}</strong><p>{day.streets[0]}</p></div></div>
          <div><span className="brief-icon"><CalendarDays /></span><div><small>Nächster Termin</small><strong>{todayAppointments[0] ? formatDateTime(todayAppointments[0].startsAt, { timeStyle: 'short' }) : 'Keine Termine'}</strong><p>{todayAppointments[0]?.title ?? 'Freier Fokus auf die Route'}</p></div></div>
          <div><span className="brief-icon"><Flame /></span><div><small>Tagesziel</small><strong>{day.goals.find((goal) => goal.label === 'Tarifchecks')?.value ?? '–'} Tarifchecks</strong><p>{day.goals.find((goal) => goal.label === 'Verträge')?.value ?? '–'} Verträge als Teamziel</p></div></div>
        </div>
      </section>

      <div className="guide-grid">
        <section className="guide-card success-guide">
          <div className="section-heading compact"><div><span className="eyebrow">Leitfaden</span><h2>8 Schritte zum Erfolg</h2></div><Target /></div>
          <ol>{successSteps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><ul>{step.points.map((point) => <li key={point}>{point}</li>)}</ul></div></li>)}</ol>
        </section>
        <section className="guide-card closing-guide">
          <div className="section-heading compact"><div><span className="eyebrow">Sauber abschließen</span><h2>5 Schritte zum Abschluss</h2></div><CheckCircle2 /></div>
          <ol>{closingSteps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><ul>{step.points.map((point) => <li key={point}>{point}</li>)}</ul></div></li>)}</ol>
        </section>
      </div>

      <section className="guide-card phase-guide">
        <div className="section-heading compact"><div><span className="eyebrow">Gesprächsregel</span><h2>3-Phasen-Regel</h2></div><Users /></div>
        <div className="phase-rule-grid">
          {threePhaseRule.map(([title, text], index) => (
            <article key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></article>
          ))}
        </div>
      </section>
    </div>
  )
}
