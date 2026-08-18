'use client'

import { useMemo, useState } from 'react'
import { ArchiveRestore, Clock3, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { formatDateTime, PROFILE_LABELS } from '@/lib/utils'

const statusLabels = { open: 'Offen', absent: 'Niemand da', red: 'Rot', yellow: 'Gelb', green: 'Grün' } as const

export function TrashSection() {
  const {
    deletedVisits, deletedCustomers, restoreDeletedVisit, purgeDeletedVisit, restoreDeletedCustomer, purgeDeletedCustomer,
  } = useAppData()
  const [busyId, setBusyId] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const visits = useMemo(() => [...deletedVisits].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)), [deletedVisits])
  const customers = useMemo(() => [...deletedCustomers].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)), [deletedCustomers])

  async function run(id: string, action: () => Promise<void>, success: string) {
    if (busyId) return
    setBusyId(id); setNotice(undefined)
    try { await action(); setNotice(success) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.') }
    finally { setBusyId(undefined) }
  }

  function confirmPurge(label: string) {
    return window.confirm(`${label} wirklich endgültig löschen?`) && window.confirm('Letzte Sicherheitsabfrage: Alle verknüpften Daten und Dateien werden unwiderruflich entfernt.')
  }

  return (
    <section className="page-shell trash-section">
      <div className="section-heading"><div><span className="eyebrow">Geschützte Löschstufe</span><h1>Papierkorb</h1><p>Gelöschte Kunden und Live-Einträge bleiben bis zur endgültigen Löschung getrennt von allen aktiven Ansichten.</p></div><Trash2 /></div>
      {notice && <p className="inline-notice trash-notice">{notice}</p>}

      {!customers.length && !visits.length ? (
        <div className="empty-state-card"><Trash2 /><h2>Der Papierkorb ist leer</h2><p>Gelöschte Kunden, Adressen und zugehörige Daten erscheinen automatisch hier.</p></div>
      ) : (
        <div className="trash-groups">
          {customers.length > 0 && <section><div className="section-heading compact"><div><span className="eyebrow">Kundenkartei</span><h2>Gelöschte Kunden</h2></div><UserRound /></div><div className="trash-list">
            {customers.map((item) => {
              const label = item.customer.name
              const busy = busyId === item.id
              return <article className="trash-card" key={`customer-${item.id}`}>
                <div className="trash-card-main"><span className="trash-status customer"><ShieldCheck /></span><div><h2>{label}</h2><p>{item.customer.street} {item.customer.houseNumber}, {item.customer.city}</p><small>Gelöscht am {formatDateTime(item.deletedAt)} · endgültig vorgesehen ab {formatDateTime(item.purgeAfter, { dateStyle: 'medium' })} · {item.related.visits.length} Live-Einträge · {item.related.documents.length} Dokumente</small></div></div>
                <div className="trash-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void run(item.id, () => restoreDeletedCustomer(item.id), `${label} wurde wiederhergestellt.`)}><ArchiveRestore /> Wiederherstellen</button><button type="button" className="danger-button" disabled={busy} onClick={() => { if (confirmPurge(label)) void run(item.id, () => purgeDeletedCustomer(item.id), `${label} wurde vollständig gelöscht.`) }}><Trash2 /> Endgültig löschen</button></div>
              </article>
            })}
          </div></section>}

          {visits.length > 0 && <section><div className="section-heading compact"><div><span className="eyebrow">Live-Fortschritt</span><h2>Gelöschte Adressen</h2></div><Clock3 /></div><div className="trash-list">
            {visits.map((item) => {
              const relatedCount = item.related.customers.length + item.related.appointments.length + item.related.notifications.length
              const label = `${item.visit.street} ${item.visit.houseNumber}`
              const busy = busyId === item.id
              return <article className="trash-card" key={`visit-${item.id}`}><div className="trash-card-main"><span className={`trash-status ${item.visit.status}`}>{statusLabels[item.visit.status]}</span><div><h2>{label}</h2><p>{item.visit.dayId} · gelöscht am {formatDateTime(item.deletedAt)} von {PROFILE_LABELS[item.deletedBy]}</p><small>{relatedCount ? `${relatedCount} verknüpfte Datensätze werden mitverwaltet.` : 'Keine weiteren Datensätze verknüpft.'}</small></div></div><div className="trash-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => void run(item.id, () => restoreDeletedVisit(item.id), `${label} wurde wiederhergestellt.`)}><ArchiveRestore /> Wiederherstellen</button><button type="button" className="danger-button" disabled={busy} onClick={() => { if (confirmPurge(label)) void run(item.id, () => purgeDeletedVisit(item.id), `${label} wurde endgültig gelöscht.`) }}><Trash2 /> Endgültig löschen</button></div></article>
            })}
          </div></section>}
        </div>
      )}
    </section>
  )
}
