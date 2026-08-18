'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, ArrowUpRight, BarChart3, Clock3, Download, FileText, TrendingUp, X } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { useModalScrollLock } from '@/components/common/use-modal-scroll-lock'
import { downloadWeeklyReport } from '@/lib/report-download'
import type { ProfileId, WeekArchive } from '@/lib/types'
import { formatDate, formatMinutes, PROFILE_LABELS } from '@/lib/utils'
import { formatEuroFromCents } from '@/lib/commission'

export function ArchiveSection({ profileId }: { profileId: ProfileId }) {
  const data = useAppData()
  const [selected, setSelected] = useState<WeekArchive | null>(null)
  const archives = useMemo(() => [...data.archives].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)), [data.archives])

  return (
    <div className="page-shell archive-page">
      <header className="page-topbar"><div><span className="eyebrow">Rückblick & Verbesserung</span><h1>Wochenarchiv</h1><p>Abgeschlossene Wochen bleiben mit Plan, Farbmarkierungen, Arbeitszeiten und Vergleichswerten erhalten.</p></div></header>
      <section className="archive-list">
        {archives.map((archive, index) => {
          const previous = archives[index + 1]
          const delta = previous ? archive.summary.netContracts - previous.summary.netContracts : 0
          return <article key={archive.id}><div className="archive-icon"><Archive /></div><div className="archive-copy"><span>{formatDate(archive.startsOn)} – {formatDate(archive.endsOn)}</span><h2>{archive.title}</h2><p>{archive.district}</p><div className="archive-metrics"><span><BarChart3 /> {archive.summary.visits} Adressen</span><span><TrendingUp /> {archive.summary.netContracts} Nettoabschlüsse {delta ? `(${delta > 0 ? '+' : ''}${delta})` : ''}</span><span><Clock3 /> {formatMinutes(profileId === 'voss' ? archive.summary.workMinutesVoss : archive.summary.workMinutesDicke)}</span>{typeof archive.summary.commissionVossCents === 'number' && <span><TrendingUp /> {formatEuroFromCents(profileId === 'voss' ? archive.summary.commissionVossCents : (archive.summary.commissionDickeCents ?? 0))} Provision</span>}</div>{archive.improvementNotes[profileId] && <blockquote>{archive.improvementNotes[profileId]}</blockquote>}</div><button type="button" onClick={() => setSelected(archive)}><FileText /> Woche öffnen <ArrowUpRight /></button></article>
        })}
        {!archives.length && <div className="large-empty"><Archive /><h2>Noch keine abgeschlossene Woche</h2><p>Sonntags wird die Woche automatisch archiviert. Eine Momentaufnahme kann zusätzlich in der Verwaltung erzeugt werden.</p></div>}
      </section>

      {selected && <ArchiveDetail archive={selected} profileId={profileId} data={data} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ArchiveDetail({ archive, profileId, data, onClose }: {
  archive: WeekArchive
  profileId: ProfileId
  data: ReturnType<typeof useAppData>
  onClose: () => void
}) {
  useModalScrollLock(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const plan = archive.plan

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [busy, onClose])

  async function downloadReport() {
    if (!plan || busy) return
    setBusy(true); setNotice(undefined)
    try {
      await downloadWeeklyReport(plan, data)
      setNotice('PDF wurde erstellt.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  const visits = data.visits.filter((item) => item.weekId === archive.weekId && item.status !== 'open')
  const customers = data.customers.filter((item) => item.weekId === archive.weekId)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}>
      <section className="modal-card archive-detail-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><div><span className="eyebrow">Archivierte Woche</span><h2>{archive.title}</h2><p>{archive.district} · {formatDate(archive.startsOn)} bis {formatDate(archive.endsOn)}</p></div><button type="button" className="icon-button" disabled={busy} onClick={onClose}><X /></button></div>
        <div className="archive-detail-summary">
          <span><strong>{archive.summary.visits}</strong> Adressen</span>
          <span><strong>{archive.summary.green}</strong> Abschlüsse</span>
          <span><strong>{archive.summary.cancelled}</strong> Stornos</span>
          <span><strong>{archive.summary.netContracts}</strong> Netto</span>
          <span><strong>{formatMinutes(profileId === 'voss' ? archive.summary.workMinutesVoss : archive.summary.workMinutesDicke)}</strong> {PROFILE_LABELS[profileId]}</span>
          {typeof archive.summary.commissionTotalCents === 'number' && <span><strong>{formatEuroFromCents(archive.summary.commissionTotalCents)}</strong> Provision gesamt</span>}
          {typeof archive.summary.commissionVossCents === 'number' && <span><strong>{formatEuroFromCents(profileId === 'voss' ? archive.summary.commissionVossCents : (archive.summary.commissionDickeCents ?? 0))}</strong> Anspruch {PROFILE_LABELS[profileId]}</span>}
        </div>
        {plan ? <div className="archive-day-review">
          {plan.days.map((day) => {
            const dayVisits = visits.filter((item) => item.dayId === day.id)
            return <article key={day.id}><header><div><small>Tag {day.dayNumber} · {day.weekday}</small><strong>{day.title}</strong></div><span>{dayVisits.length} erfasst</span></header><div className="archive-street-review">{day.streets.map((street) => { const entries = dayVisits.filter((item) => item.street === street); return <div key={street}><b>{street}</b><span>{entries.map((entry) => <i key={entry.id} className={`archive-house ${entry.status}`} title={`${entry.houseNumber}: ${entry.status}`}>{entry.houseNumber}</i>)}</span></div> })}</div></article>
          })}
        </div> : <p className="inline-notice">Diese ältere Momentaufnahme enthält noch keinen eingebetteten Wochenplan. Die Kennzahlen bleiben erhalten.</p>}
        <div className="archive-customer-line"><strong>{customers.filter((item) => item.status === 'active').length}</strong> aktive Abschlüsse · <strong>{customers.filter((item) => item.status === 'cancelled').length}</strong> Stornos</div>
        {notice && <p className="inline-notice">{notice}</p>}
        <div className="modal-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>Schließen</button>{plan && <button className="primary-button" type="button" disabled={busy} onClick={() => void downloadReport()}><Download /> {busy ? 'Wird erstellt …' : 'PDF erneut erzeugen'}</button>}</div>
      </section>
    </div>
  )
}
