'use client'

import { useRef, useState } from 'react'
import { Archive, Check, DatabaseBackup, Download, FileJson, FileText, LockKeyhole, Upload, Wifi, WifiOff } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { downloadWeeklyReport } from '@/lib/report-download'
import { weekPlan } from '@/lib/week'
import type { WeekPlan } from '@/lib/types'
import { nowIso, workMinutes } from '@/lib/utils'
import { commissionShares, salesOwnerOf } from '@/lib/commission'

export function AdminSection() {
  const data = useAppData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  async function downloadReport() {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      await downloadWeeklyReport(weekPlan, data)
      setMessage('Wochenbericht wurde erstellt.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'PDF konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function createArchive() {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const visits = data.visits.filter((item) => item.weekId === weekPlan.id && item.status !== 'open')
      const customers = data.customers.filter((item) => item.weekId === weekPlan.id)
      const commissions = customers.reduce((totals, customer) => {
        const shares = commissionShares(customer)
        totals.total += shares.total
        totals.voss += shares.voss
        totals.dicke += shares.dicke
        if (salesOwnerOf(customer) === 'both') totals.shared += 1
        return totals
      }, { total: 0, voss: 0, dicke: 0, shared: 0 })
      await data.saveArchive({
      id: `archive-${weekPlan.id}`, weekId: weekPlan.id, title: weekPlan.title, district: weekPlan.district,
      startsOn: weekPlan.startsOn, endsOn: weekPlan.endsOn, archivedAt: nowIso(),
      summary: {
        visits: visits.length,
        red: visits.filter((item) => item.status === 'red').length,
        yellow: visits.filter((item) => item.status === 'yellow').length,
        green: visits.filter((item) => item.status === 'green').length,
        cancelled: customers.filter((item) => item.status === 'cancelled').length,
        netContracts: customers.filter((item) => item.status === 'active').length,
        workMinutesVoss: data.workSessions.filter((item) => item.profileId === 'voss' && item.date >= weekPlan.startsOn && item.date <= weekPlan.endsOn).reduce((sum, item) => sum + workMinutes(item), 0),
        workMinutesDicke: data.workSessions.filter((item) => item.profileId === 'dicke' && item.date >= weekPlan.startsOn && item.date <= weekPlan.endsOn).reduce((sum, item) => sum + workMinutes(item), 0),
        commissionTotalCents: commissions.total,
        commissionVossCents: commissions.voss,
        commissionDickeCents: commissions.dicke,
        sharedCustomers: commissions.shared,
      },
      improvementNotes: { team: 'Nächste Woche: Rückkehrzeiten noch früher priorisieren.' },
        plan: weekPlan,
      })
      setMessage('Woche als Momentaufnahme archiviert.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Momentaufnahme konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ exportedAt: nowIso(), weekPlan, data: { visits: data.visits, customers: data.customers, appointments: data.appointments, notifications: data.notifications, workSessions: data.workSessions, dayNotes: data.dayNotes, archives: data.archives } }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `voss-dicke-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_500)
    setMessage('Backup wurde heruntergeladen.')
  }

  async function inspectWeekFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as WeekPlan
      if (!parsed.id || !Array.isArray(parsed.days) || parsed.days.length !== 5) throw new Error('Die Datei muss genau fünf Arbeitstage enthalten.')
      localStorage.setItem('vd_pending_week_plan', JSON.stringify(parsed))
      setMessage(`„${parsed.title}“ wurde geprüft. Für die produktive Version wird sie serverseitig aktiviert; im GitHub-Entwurf ersetzt du data/current-week.json.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Wochenplan konnte nicht gelesen werden.')
    }
  }

  return (
    <div className="page-shell admin-page">
      <header className="page-topbar"><div><span className="eyebrow">Verwaltung</span><h1>System & Wochenwechsel</h1><p>Große Verwaltungsansicht für PC und Notebook, ohne den mobilen D2D-Ablauf zu überladen.</p></div><span className={online ? 'system-online' : 'system-offline'} onClick={() => setOnline(navigator.onLine)}>{online ? <Wifi /> : <WifiOff />}{online ? 'Online' : 'Offline'}</span></header>
      {message && <p className="admin-message"><Check /> {message}</p>}
      <div className="admin-grid">
        <section className="admin-card"><FileText /><div><h2>Wochenabschluss als PDF</h2><p>Erstellt einen Bericht mit Straßen, Abschlüssen, Stornos, Arbeitszeiten sowie einem gesonderten Nachweis zu Kundenzuordnung, Provision und 50/50-Anteilen.</p></div><button type="button" className="primary-button" onClick={() => void downloadReport()} disabled={busy}><Download /> {busy ? 'Erstellt …' : 'PDF erstellen'}</button></section>
        <section className="admin-card"><Archive /><div><h2>Woche archivieren</h2><p>Speichert den aktuellen Stand als unveränderbare Vergleichsmomentaufnahme.</p></div><button type="button" className="secondary-button" onClick={() => void createArchive()} disabled={busy}>Momentaufnahme speichern</button></section>
        <section className="admin-card"><FileJson /><div><h2>Neuen Wochenplan prüfen</h2><p>Die App ist auf eine austauschbare current-week.json ausgelegt. Login, Kunden und Termine bleiben unverändert.</p></div><input ref={fileRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void inspectWeekFile(file) }} /><button type="button" className="secondary-button" onClick={() => fileRef.current?.click()} disabled={busy}><Upload /> JSON auswählen</button></section>
        <section className="admin-card"><DatabaseBackup /><div><h2>Geschütztes Daten-Backup</h2><p>Exportiert eine administrative JSON-Kopie der aktuell vom geschützten Server geladenen Daten. Für den laufenden Betrieb sind automatische Datenbank-Backups vorgesehen.</p></div><button type="button" className="secondary-button" onClick={exportBackup} disabled={busy}><Download /> Backup exportieren</button></section>
      </div>
      <section className="security-overview panel-card"><div className="section-heading compact"><div><span className="eyebrow">Sicherheitsstatus · Entwurf</span><h2>Was bereits vorbereitet ist</h2></div><LockKeyhole /></div><div className="security-checks"><span><Check /> Firmenlogin serverseitig</span><span><Check /> Profil → 2FA → PIN</span><span><Check /> PIN nur lokal verschlüsselt</span><span><Check /> Sicherheitsheader & CSP</span><span><Check /> Kundendetails nicht im Push-Text</span><span><Check /> Offline-Cache für App-Shell</span></div><p><strong>Wichtig:</strong> Kundendaten werden nicht in GitHub und nicht im Service-Worker-Cache gespeichert. Die App lädt sie nach erfolgreicher Anmeldung automatisch über serverseitig geprüfte API-Routen aus Supabase. Vor echtem Einsatz müssen Datenschutztexte, Löschfristen, Backups und Auftragsverarbeitungsverträge final festgelegt werden.</p></section>
      <section className="weekly-automation-card"><div><span className="eyebrow light">Geplanter Produktionsablauf</span><h2>Sonntag, 09:00 Uhr · Europe/Berlin</h2><p>Server erzeugt den Wochenbericht genau einmal, sendet ihn an die konfigurierte Firmenadresse und archiviert die Woche.</p></div><span>Server-Automatik mit Idempotenzschutz</span></section>
    </div>
  )
}
