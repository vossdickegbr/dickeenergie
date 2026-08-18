'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Check, Clock3, MapPin, MessageCircle, Phone, Plus, X } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { useModalScrollLock } from '@/components/common/use-modal-scroll-lock'
import type { Appointment, ProfileId } from '@/lib/types'
import { formatDateTime, googleAddressUrl, telUrl, toLocalDateKey, whatsappUrl } from '@/lib/utils'

function dateValue(date: Date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

function linkedIdFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('open')
}

export function CalendarSection({ profileId }: { profileId: ProfileId }) {
  const { appointments, saveAppointment } = useAppData()
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(linkedIdFromUrl)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [form, setForm] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(17, 0, 0, 0)
    return { title: '', startsAt: dateValue(tomorrow), address: '', phone: '', note: '' }
  })

  useEffect(() => {
    const handleLinkedOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; id?: string }>).detail
      if (detail?.type === 'appointment' && detail.id) { setNotice(undefined); setSelectedId(detail.id) }
    }
    window.addEventListener('vd:open-linked', handleLinkedOpen)
    return () => window.removeEventListener('vd:open-linked', handleLinkedOpen)
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    appointments
      .filter((item) => item.status === 'scheduled')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .forEach((item) => {
        const key = item.startsAt.slice(0, 10)
        map.set(key, [...(map.get(key) ?? []), item])
      })
    return [...map.entries()]
  }, [appointments])

  const selected = appointments.find((item) => item.id === selectedId) ?? null
  const today = toLocalDateKey()

  useModalScrollLock(showForm || Boolean(selected))

  function closeSelected() {
    setNotice(undefined)
    setSelectedId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('open')
    window.history.replaceState({}, '', url)
  }

  useEffect(() => {
    if (!showForm && !selected) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return
      if (showForm) {
        setNotice(undefined)
        setShowForm(false)
      } else {
        setNotice(undefined)
        setSelectedId(null)
        const url = new URL(window.location.href)
        url.searchParams.delete('open')
        window.history.replaceState({}, '', url)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showForm, selected, busy])

  return (
    <div className="page-shell calendar-page">
      <header className="page-topbar">
        <div>
          <span className="eyebrow">Gemeinsam synchronisiert</span>
          <h1>Termine</h1>
          <p>Online-Abschlüsse, Rückkehrtermine und Kundentermine auf Handy, Tablet und Rechner.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => { setNotice(undefined); setShowForm(true) }}><Plus /> Termin eintragen</button>
      </header>

      <div className="calendar-layout">
        <section className="calendar-stream">
          {grouped.map(([date, entries]) => (
            <div className="calendar-day-group" key={date}>
              <div className={date === today ? 'date-marker today' : 'date-marker'}>
                <strong>{new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' }).format(new Date(`${date}T12:00:00`))}</strong>
                <span>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(`${date}T12:00:00`))}</span>
              </div>
              <div className="calendar-events">
                {entries.map((item) => (
                  <button type="button" key={item.id} onClick={() => { setNotice(undefined); setSelectedId(item.id) }}>
                    <time>{formatDateTime(item.startsAt, { timeStyle: 'short' })}</time>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.address || 'Ohne Adresse'}</span>
                      <small>{item.assignedTo === 'both' ? 'Beide Profile' : item.assignedTo === 'voss' ? 'Herr Voss' : 'Herr Dicke'}</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!grouped.length && <div className="large-empty"><CalendarPlus /><h2>Noch keine Termine</h2><p>Gelbe D2D-Einträge können automatisch gemeinsame Termine erzeugen.</p></div>}
        </section>

        <aside className="calendar-info panel-card">
          <Clock3 />
          <h2>Standard-Erinnerungen</h2>
          <p>Beide Profile erhalten Pop-ups 24 Stunden vorher, 1 Stunde vorher und zum Terminzeitpunkt.</p>
          <ul>
            <li><Check /> Termine bleiben intern gespeichert.</li>
            <li><Check /> Beide bestätigen separat „gesehen“.</li>
            <li><Check /> Gesehen und erledigt bleiben getrennt.</li>
            <li><Check /> Sperrbildschirm zeigt keine Kundendetails.</li>
          </ul>
        </aside>
      </div>

      {showForm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) { setNotice(undefined); setShowForm(false) } }}>
          <form className="modal-card" onMouseDown={(event) => event.stopPropagation()} onSubmit={async (event) => {
            event.preventDefault()
            if (busy) return
            setBusy(true); setNotice(undefined)
            try {
              await saveAppointment({
                title: form.title.trim(),
                startsAt: new Date(form.startsAt).toISOString(),
                address: form.address.trim() || undefined,
                phone: form.phone.trim() || undefined,
                assignedTo: 'both',
                createdBy: profileId,
                note: form.note.trim() || undefined,
                status: 'scheduled',
                reminderMinutes: [1440, 60, 0],
              })
              setShowForm(false)
              setForm((current) => ({ ...current, title: '', address: '', phone: '', note: '' }))
            } catch (error) {
              setNotice(error instanceof Error ? error.message : 'Termin konnte nicht gespeichert werden.')
            } finally {
              setBusy(false)
            }
          }}>
            <div className="modal-header">
              <div><span className="eyebrow">Gemeinsamer Kalender</span><h2>Neuen Termin eintragen</h2></div>
              <button type="button" className="icon-button" disabled={busy} onClick={() => { setNotice(undefined); setShowForm(false) }}><X /></button>
            </div>
            <div className="form-grid">
              <label className="span-2">Titel<input required autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <label>Datum & Uhrzeit<input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
              <label>Benachrichtigung<input value="Immer Herr Voss und Herr Dicke" readOnly /></label>
              <label className="span-2">Adresse<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
              <label>Telefon<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label className="span-2">Notiz<textarea rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
            </div>
            {notice && <p className="form-error">{notice}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={() => { setNotice(undefined); setShowForm(false) }}>Abbrechen</button>
              <button type="submit" className="primary-button" disabled={busy}><CalendarPlus /> {busy ? 'Wird gespeichert …' : 'Termin speichern'}</button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) closeSelected() }}>
          <section className="modal-card compact-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><span className="eyebrow">Termin</span><h2>{selected.title}</h2><p>{formatDateTime(selected.startsAt)}</p></div>
              <button type="button" className="icon-button" disabled={busy} onClick={closeSelected}><X /></button>
            </div>
            {selected.address && <p className="appointment-address"><MapPin /> {selected.address}</p>}
            {selected.note && <p className="appointment-note">{selected.note}</p>}
            <div className="quick-contact-row">
              {selected.phone && <a href={telUrl(selected.phone)}><Phone /> Anrufen</a>}
              {selected.phone && <a href={whatsappUrl(selected.phone)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>}
              {selected.address && <a href={googleAddressUrl(selected.address)} target="_blank" rel="noreferrer"><MapPin /> Navigation</a>}
            </div>
            {notice && <p className="form-error">{notice}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={closeSelected}>Schließen</button>
              <button type="button" className="primary-button" disabled={busy} onClick={async () => {
                setBusy(true); setNotice(undefined)
                try {
                  await saveAppointment({ ...selected, status: 'completed' })
                  closeSelected()
                } catch (error) {
                  setNotice(error instanceof Error ? error.message : 'Termin konnte nicht abgeschlossen werden.')
                } finally {
                  setBusy(false)
                }
              }}><Check /> {busy ? 'Wird gespeichert …' : 'Erledigt'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
