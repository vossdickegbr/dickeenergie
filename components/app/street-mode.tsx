'use client'

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarPlus, Check, ExternalLink, House, MapPin, RotateCcw, Trash2, X } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { CustomerIntakeModal } from '@/components/app/customer-intake-modal'
import { useModalScrollLock } from '@/components/common/use-modal-scroll-lock'
import type { AddressStatus, AddressVisit, ProfileId, WeekDay, WeekPlan } from '@/lib/types'
import { googleAddressUrl } from '@/lib/utils'

const statusOptions: Array<{ id: AddressStatus; label: string; description: string; className: string }> = [
  { id: 'red', label: 'Rot', description: 'Nicht wiederkommen', className: 'status-red' },
  { id: 'yellow', label: 'Gelb', description: 'Wiederkommen', className: 'status-yellow' },
  { id: 'green', label: 'Grün', description: 'Geschrieben', className: 'status-green' },
  { id: 'absent', label: 'Grau', description: 'Niemand da', className: 'status-gray' },
]

interface StreetModeProps {
  plan: WeekPlan
  day: WeekDay
  profileId: ProfileId
  initialStreet?: string
}

export function StreetMode({ plan, day, profileId, initialStreet }: StreetModeProps) {
  const { visits, saveVisit, deleteVisit, saveAppointment } = useAppData()
  const [street, setStreet] = useState(initialStreet ?? day.streets[0])
  const [houseNumber, setHouseNumber] = useState('')
  const [pendingVisit, setPendingVisit] = useState<AddressVisit | null>(null)
  const [modal, setModal] = useState<'customer' | 'callback' | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useModalScrollLock(Boolean(modal))

  const streetVisits = useMemo(() => visits
    .filter((visit) => visit.weekId === plan.id && visit.dayId === day.id && visit.street === street)
    .sort((a, b) => a.houseNumber.localeCompare(b.houseNumber, 'de', { numeric: true })), [visits, plan.id, day.id, street])

  async function mark(status: AddressStatus) {
    if (busy) return
    if (!houseNumber.trim()) {
      inputRef.current?.focus()
      setNotice('Bitte zuerst eine Hausnummer eingeben.')
      return
    }
    setBusy(true)
    setNotice('')
    const duplicate = visits.find((visit) => visit.weekId === plan.id && visit.dayId === day.id && visit.street === street && visit.houseNumber.toLowerCase() === houseNumber.trim().toLowerCase())
    try {
      const saved = await saveVisit({
        id: duplicate?.id,
        weekId: plan.id,
        dayId: day.id,
        street,
        houseNumber: houseNumber.trim(),
        status,
        profileId,
        callbackAt: duplicate?.callbackAt,
        note: duplicate?.note,
        customerId: duplicate?.customerId,
      })
      if (status === 'green') {
        setPendingVisit(saved)
        setModal('customer')
        return
      }
      if (status === 'yellow') {
        setPendingVisit(saved)
        setModal('callback')
        return
      }
      setHouseNumber('')
      setNotice(status === 'red' ? 'Adresse rot gespeichert.' : 'Adresse als „niemand da“ gespeichert.')
      inputRef.current?.focus()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Adresse konnte nicht gespeichert werden. Verbindung prüfen.')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  async function undoLast() {
    if (busy) return
    const last = streetVisits.at(-1)
    if (!last) return
    setBusy(true); setNotice('')
    try {
      await saveVisit({ ...last, status: 'open' })
      setHouseNumber(last.houseNumber)
      setNotice('Letzte Markierung zurückgesetzt.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Markierung konnte nicht zurückgesetzt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function removeVisit(visit: AddressVisit) {
    if (busy) return
    const confirmed = window.confirm(`Adresse ${visit.street} ${visit.houseNumber} wirklich in den Papierkorb verschieben?`)
    if (!confirmed) return
    setBusy(true); setNotice('')
    try {
      await deleteVisit(visit.id)
      if (pendingVisit?.id === visit.id) {
        setPendingVisit(null)
        setModal(null)
      }
      if (houseNumber === visit.houseNumber) setHouseNumber('')
      setNotice(`Hausnummer ${visit.houseNumber} wurde in den Papierkorb verschoben.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Adresse konnte nicht gelöscht werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="street-mode">
      <header className="street-header">
        <div><span className="eyebrow">D2D Schnellmodus · {day.weekday}</span><h2>{street}</h2></div>
        <a className="icon-button" href={googleAddressUrl(`${street}, ${plan.district}`)} target="_blank" rel="noreferrer" title="Karte öffnen"><MapPin /></a>
      </header>

      <div className="street-picker" role="list">
        {day.streets.map((item, index) => (
          <button type="button" key={item} disabled={busy} onClick={() => { setStreet(item); setHouseNumber(''); setNotice('') }} className={street === item ? 'active' : ''}>
            <small>{index + 1}</small><span>{item}</span>
          </button>
        ))}
      </div>

      <main className="street-workspace">
        <section className="fast-entry-card">
          <div className="fast-title"><House /><div><small>Adresse markieren</small><strong>{street}</strong></div></div>
          <label className="house-input-label">Hausnummer
            <input ref={inputRef} inputMode="text" autoCapitalize="characters" value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} placeholder="z. B. 42a" disabled={busy} autoFocus onKeyDown={(event) => {
              if (event.key === 'Enter' && houseNumber) void mark('absent')
            }} />
          </label>
          <div className="status-grid">
            {statusOptions.map((status) => (
              <button type="button" key={status.id} className={status.className} disabled={busy} onClick={() => void mark(status.id)}>
                <span className="status-dot" /><strong>{status.label}</strong><small>{status.description}</small>
              </button>
            ))}
          </div>
          <div className="fast-footer">
            <button type="button" className="ghost-button" onClick={() => void undoLast()} disabled={busy || !streetVisits.length}><RotateCcw /> Letzte zurück</button>
            <span>{streetVisits.length} Häuser erfasst</span>
          </div>
          {notice && <p className="inline-notice">{notice}</p>}
        </section>

        <section className="street-progress-card">
          <div className="section-heading compact"><div><span className="eyebrow">Live-Fortschritt</span><h3>{street}</h3></div><span className="counter-badge">{streetVisits.filter((visit) => visit.status !== 'open').length}</span></div>
          <div className="house-chips">
            {streetVisits.filter((visit) => visit.status !== 'open').map((visit) => (
              <div className={`house-chip-group ${visit.status}`} key={visit.id}>
                <button type="button" className="house-chip" disabled={busy} onClick={() => { setHouseNumber(visit.houseNumber); setPendingVisit(visit); if (visit.status === 'green') setModal('customer'); if (visit.status === 'yellow') setModal('callback') }}>
                  {visit.houseNumber}
                </button>
                <button type="button" className="house-chip-delete" disabled={busy} onClick={() => void removeVisit(visit)} aria-label={`Hausnummer ${visit.houseNumber} löschen`} title="In den Papierkorb verschieben">
                  <Trash2 />
                </button>
              </div>
            ))}
            {!streetVisits.some((visit) => visit.status !== 'open') && <p className="empty-state">Noch keine Hausnummer markiert. Die Eingabe wird nach jedem Tipp sofort gespeichert.</p>}
          </div>
          <div className="street-stats">
            {statusOptions.map((status) => <span key={status.id}><i className={status.className} />{streetVisits.filter((visit) => visit.status === status.id).length} {status.description}</span>)}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {modal === 'customer' && pendingVisit && (
          <CustomerIntakeModal
            profileId={profileId}
            seed={{
              street: pendingVisit.street,
              houseNumber: pendingVisit.houseNumber,
              postalCode: '53121',
              city: 'Bonn',
              district: plan.district,
              source: 'd2d',
              weekId: plan.id,
              dayId: day.id,
              addressLocked: true,
            }}
            onClose={() => { setModal(null); setHouseNumber(''); setPendingVisit(null); inputRef.current?.focus() }}
            onSaved={async (customer) => {
              await saveVisit({ ...pendingVisit, customerId: customer.id })
              setNotice(customer.recordState === 'draft' ? 'Kundenkartei als Entwurf gespeichert. Kontaktdaten können später im Kundenregister ergänzt werden.' : 'Abschluss und Kunde gespeichert.')
            }}
          />
        )}

        {modal === 'callback' && pendingVisit && (
          <CallbackModal
            visit={pendingVisit}
            plan={plan}
            onClose={() => { setModal(null); setHouseNumber(''); setPendingVisit(null); inputRef.current?.focus() }}
            onSave={async (startsAt, note) => {
              await saveVisit({ ...pendingVisit, callbackAt: startsAt || undefined, note: note || undefined })
              if (startsAt) {
                await saveAppointment({
                  title: 'Rückkehrtermin',
                  startsAt,
                  address: `${pendingVisit.street} ${pendingVisit.houseNumber}, Bonn`,
                  weekId: plan.id,
                  dayId: day.id,
                  assignedTo: 'both',
                  createdBy: profileId,
                  note: note || undefined,
                  status: 'scheduled',
                  reminderMinutes: [1440, 60, 0],
                })
                setNotice('Gelb gespeichert und gemeinsamer Termin erstellt.')
              } else {
                setNotice('Gelb gespeichert. Termin kann später geplant werden.')
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function CallbackModal({ visit, plan, onClose, onSave }: {
  visit: AddressVisit
  plan: WeekPlan
  onClose: () => void
  onSave: (startsAt: string, note: string) => Promise<void>
}) {
  const [startsAt, setStartsAt] = useState(() => {
    const initial = new Date()
    initial.setHours(initial.getHours() + 1)
    initial.setMinutes(Math.ceil(initial.getMinutes() / 15) * 15, 0, 0)
    return initial.toISOString().slice(0, 16)
  })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="modal-card compact-modal" initial={{ scale: .96, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: .96, y: 20 }}>
        <div className="modal-header"><div><span className="eyebrow">Gelb · Wiederkommen</span><h2>Rückkehr planen</h2><p>{visit.street} {visit.houseNumber}, {plan.district}</p></div><button type="button" className="icon-button" onClick={onClose}><X /></button></div>
        <label>Datum und Uhrzeit<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>Notiz optional<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="quick-times"><button type="button" onClick={() => setStartsAt('')}>Später planen</button><a href={googleAddressUrl(`${visit.street} ${visit.houseNumber}, Bonn`)} target="_blank" rel="noreferrer"><ExternalLink /> Adresse prüfen</a></div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Abbrechen</button><button type="button" className="primary-button" disabled={busy} onClick={async () => {
          setBusy(true); setError('')
          try {
            await onSave(startsAt ? new Date(startsAt).toISOString() : '', note)
            onClose()
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Termin konnte nicht gespeichert werden.')
          } finally {
            setBusy(false)
          }
        }}><CalendarPlus /> {busy ? 'Wird gespeichert …' : startsAt ? 'Termin speichern' : 'Gelb speichern'}</button></div>
        <p className="security-hint"><Check /> Der Termin wird für beide Profile angelegt und als Benachrichtigung gespeichert.</p>
      </motion.section>
    </motion.div>
  )
}
