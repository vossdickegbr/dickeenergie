'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ArrowLeft, CalendarPlus, CheckCircle2, Clock3, Download, FileText, Mail, MailCheck, MapPin, MessageCircle, Pencil, Phone,
  Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, Upload, UserRound, UsersRound, X,
} from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import { OnlineCustomerIntakeModal } from '@/components/app/online-customer-intake-modal'
import { useModalScrollLock } from '@/components/common/use-modal-scroll-lock'
import currentWeekData from '@/data/current-week.json'
import type { Customer, CustomerAttribution, CustomerDocumentMeta, OnlineCustomerIntake, ProfileId } from '@/lib/types'
import { formatDateTime, googleAddressUrl, PROFILE_LABELS, telUrl, whatsappUrl } from '@/lib/utils'
import { centsFromEuroInput, commissionShares, currentWorkMonth, customerWorkMonth, euroInputFromCents, formatEuroFromCents, salesOwnerLabel, salesOwnerOf } from '@/lib/commission'

function linkedIdFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('open')
}

function dateAfterYears(years: number) {
  const date = new Date()
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

export function CustomersSection({ profileId }: { profileId: ProfileId }) {
  const {
    customers, onlineCustomerIntakes, cancelCustomer, refresh, renewCustomer, resendPrivacyEmail, saveAppointment, saveCustomer, trashCustomer,
  } = useAppData()
  const [query, setQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'all' | CustomerAttribution>('all')
  const [workMonthKey, setWorkMonthKey] = useState(() => currentWorkMonth().key)
  const [selectedId, setSelectedId] = useState<string | null>(linkedIdFromUrl)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedOnlineIntakeId, setSelectedOnlineIntakeId] = useState<string | null>(null)

  useEffect(() => {
    const handleLinkedOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: string; id?: string }>).detail
      if (detail?.type === 'customer' && detail.id) setSelectedId(detail.id)
    }
    window.addEventListener('vd:open-linked', handleLinkedOpen)
    return () => window.removeEventListener('vd:open-linked', handleLinkedOpen)
  }, [])

  const workMonths = useMemo(() => {
    const map = new Map<string, ReturnType<typeof currentWorkMonth>>()
    const current = currentWorkMonth()
    map.set(current.key, current)
    customers.forEach((customer) => {
      const period = customerWorkMonth(customer)
      map.set(period.key, period)
    })
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [customers])

  const selectedPeriod = workMonths.find((item) => item.key === workMonthKey) ?? currentWorkMonth()
  const periodCustomers = useMemo(() => customers.filter((item) => customerWorkMonth(item).key === selectedPeriod.key), [customers, selectedPeriod.key])
  const periodTotals = useMemo(() => periodCustomers.reduce((totals, customer) => {
    const shares = commissionShares(customer)
    totals.total += shares.total
    totals.voss += shares.voss
    totals.dicke += shares.dicke
    if (customer.recordState === 'draft') totals.drafts += 1
    if (customer.status === 'cancelled') totals.cancelled += 1
    if (!customer.commissionAmountCents) totals.missingCommission += 1
    return totals
  }, { total: 0, voss: 0, dicke: 0, drafts: 0, cancelled: 0, missingCommission: 0 }), [periodCustomers])

  const filtered = useMemo(() => periodCustomers
    .filter((item) => ownerFilter === 'all' || salesOwnerOf(item) === ownerFilter)
    .filter((item) => `${item.name} ${item.phone} ${item.email ?? ''} ${item.street} ${item.houseNumber}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [periodCustomers, ownerFilter, query])

  const selected = customers.find((item) => item.id === selectedId) ?? null
  const drafts = customers.filter((item) => item.recordState === 'draft').length
  const pendingOnlineIntakes = onlineCustomerIntakes.filter((item) => item.status !== 'finalized')
  const selectedOnlineIntake = pendingOnlineIntakes.find((item) => item.id === selectedOnlineIntakeId) ?? null

  useModalScrollLock(addOpen || Boolean(selectedOnlineIntake) || Boolean(selected))

  function closeSelected() {
    setSelectedId(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('open')
    window.history.replaceState({}, '', url)
  }

  return (
    <div className="page-shell customers-page">
      <header className="page-topbar">
        <div><span className="eyebrow">Geschütztes Kundenregister & Provisionsnachweis</span><h1>Kunden · Arbeitsmonat · Auszahlung</h1><p>Der Abschluss wird wirtschaftlich Herr Voss, Herr Dicke oder gemeinsam 50/50 zugeordnet. Die Provision wird centgenau gespeichert und für den Arbeitsmonat 16. bis 15. automatisch aufgeteilt.</p></div>
      </header>

      <section className="customer-workmonth-card">
        <div>
          <span className="eyebrow">Arbeitsmonat · immer 16. bis 15.</span>
          <h2>{selectedPeriod.label}</h2>
          <p>{periodCustomers.length} Kundenakten · {periodTotals.cancelled} Storno{periodTotals.cancelled === 1 ? '' : 's'} · aktive Provisionen zählen zum Anspruch.</p>
        </div>
        <label>Arbeitsmonat auswählen
          <select value={selectedPeriod.key} onChange={(event) => setWorkMonthKey(event.target.value)}>
            {workMonths.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}
          </select>
        </label>
      </section>

      <section className="summary-strip commission-summary-strip">
        <article><CheckCircle2 /><strong>{formatEuroFromCents(periodTotals.total)}</strong><span>Provision gesamt</span></article>
        <article><UserRound /><strong>{formatEuroFromCents(periodTotals.voss)}</strong><span>{PROFILE_LABELS.voss} zustehen</span></article>
        <article><UserRound /><strong>{formatEuroFromCents(periodTotals.dicke)}</strong><span>{PROFILE_LABELS.dicke} zustehen</span></article>
        <article><UsersRound /><strong>{periodCustomers.length}</strong><span>Kunden im Arbeitsmonat</span></article>
      </section>

      {(drafts > 0 || pendingOnlineIntakes.length > 0 || periodTotals.missingCommission > 0) && (
        <div className="customer-register-note">
          <Pencil />
          <span>{drafts} unvollständige Kundenkartei{drafts === 1 ? '' : 'en'} · {pendingOnlineIntakes.length} offene Online-Aufnahme{pendingOnlineIntakes.length === 1 ? '' : 'n'}{periodTotals.missingCommission ? ` · ${periodTotals.missingCommission} Altbestand ohne Provision` : ''}</span>
        </div>
      )}

      {pendingOnlineIntakes.length > 0 && (
        <section className="online-intake-queue">
          <div className="section-heading compact">
            <div><span className="eyebrow">Live-Rückmeldungen</span><h2>Offene Online-Aufnahmen</h2></div>
            <MailCheck />
          </div>
          <div className="online-intake-queue-grid">
            {pendingOnlineIntakes.map((item) => (
              <button type="button" key={item.id} className={`online-intake-queue-card ${item.status}`} onClick={() => setSelectedOnlineIntakeId(item.id)}>
                <span className="online-queue-icon">{item.status === 'completed' ? <CheckCircle2 /> : item.status === 'failed' || item.status === 'expired' ? <AlertTriangle /> : <Clock3 />}</span>
                <span><strong>{item.customer.name}</strong><small>{salesOwnerLabel(item.customer.salesOwner ?? item.createdBy)} · {item.customer.commissionAmountCents ? formatEuroFromCents(item.customer.commissionAmountCents) : 'Provision offen'}</small></span>
                <b>{onlineIntakeLabel(item)}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="customer-owner-filter" role="group" aria-label="Kunden nach wirtschaftlicher Zuordnung filtern">
        <button type="button" className={ownerFilter === 'all' ? 'active' : ''} onClick={() => setOwnerFilter('all')}><UsersRound /> Alle · {periodCustomers.length}</button>
        <button type="button" className={ownerFilter === 'voss' ? 'active' : ''} onClick={() => setOwnerFilter('voss')}><UserRound /> {PROFILE_LABELS.voss} · {periodCustomers.filter((item) => salesOwnerOf(item) === 'voss').length}</button>
        <button type="button" className={ownerFilter === 'dicke' ? 'active' : ''} onClick={() => setOwnerFilter('dicke')}><UserRound /> {PROFILE_LABELS.dicke} · {periodCustomers.filter((item) => salesOwnerOf(item) === 'dicke').length}</button>
        <button type="button" className={ownerFilter === 'both' ? 'active' : ''} onClick={() => setOwnerFilter('both')}><UsersRound /> 50/50 · {periodCustomers.filter((item) => salesOwnerOf(item) === 'both').length}</button>
      </div>

      <div className="search-bar"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, Telefon, E-Mail oder Adresse suchen" /></div>

      <section className="customer-list">
        {filtered.map((customer) => {
          const shares = commissionShares(customer)
          const owner = salesOwnerOf(customer)
          return (
            <article key={customer.id} className={`${customer.status === 'cancelled' ? 'cancelled' : ''} ${customer.recordState === 'draft' ? 'draft' : ''}`} onClick={() => setSelectedId(customer.id)}>
              <span className="customer-avatar"><UserRound /></span>
              <div className="customer-main">
                <strong>{customer.name}</strong>
                <span>{customer.street} {customer.houseNumber}, {customer.city}</span>
                <small>{customer.recordState === 'draft' ? 'Kundendaten noch unvollständig' : `Abschluss ${formatDateTime(customer.completedAt)}`} · {salesOwnerLabel(owner)}</small>
              </div>
              <div className="customer-status commission-customer-status">
                <b>{customer.commissionAmountCents ? formatEuroFromCents(customer.commissionAmountCents) : 'Provision fehlt'}</b>
                {owner === 'both' && customer.status === 'active' && customer.recordState !== 'draft' && <small>Voss {formatEuroFromCents(shares.voss)} · Dicke {formatEuroFromCents(shares.dicke)}</small>}
                {owner !== 'both' && customer.status === 'active' && customer.recordState !== 'draft' && <small>Anspruch {formatEuroFromCents(shares.total)}</small>}
                {customer.status === 'cancelled' && <small>Storniert · Anspruch 0,00 €</small>}
              </div>
            </article>
          )
        })}
        {!filtered.length && <div className="large-empty"><UserRound /><h2>Keine passenden Kunden</h2><p>Für diesen Arbeitsmonat und Filter wurden keine Kunden gefunden.</p></div>}
      </section>

      <button className="customer-add-button" type="button" aria-label="Kunden aufnehmen" onClick={() => setAddOpen(true)}>
        <Plus /><span>Kunde aufnehmen</span>
      </button>

      {(addOpen || selectedOnlineIntake) && (
        <OnlineCustomerIntakeModal
          profileId={profileId}
          seed={{ postalCode: '53121', city: 'Bonn', district: 'Online / Telefon', weekId: currentWeekData.id, dayId: 'online-register' }}
          existing={selectedOnlineIntake}
          onClose={() => { setAddOpen(false); setSelectedOnlineIntakeId(null) }}
          onSaved={(saved) => { setSelectedId(saved.id); setWorkMonthKey(customerWorkMonth(saved).key) }}
        />
      )}

      {selected && (
        <CustomerDetail
          key={selected.id}
          customer={selected}
          profileId={profileId}
          onClose={closeSelected}
          onSave={saveCustomer}
          onResendPrivacy={() => resendPrivacyEmail(selected.id)}
          onResendWelcome={async () => {
            const response = await fetch(`/api/customers/${encodeURIComponent(selected.id)}/welcome-email`, { method: 'POST' })
            const result = await response.json().catch(() => ({ ok: false, error: `Serverfehler (${response.status})` })) as { ok: boolean; error?: string }
            await refresh()
            if (!response.ok || !result.ok) throw new Error(result.error ?? 'Dankes-E-Mail konnte nicht gesendet werden.')
          }}
          onRenew={(date, serviceType) => renewCustomer(selected.id, date, serviceType)}
          onTrash={async () => { await trashCustomer(selected.id, 'service_ended'); closeSelected() }}
          onCancel={async (cancellation) => { await cancelCustomer(selected.id, cancellation); closeSelected() }}
          onCreateAppointment={async () => {
            await saveAppointment({
              title: `Kundentermin · ${selected.name}`,
              startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              address: `${selected.street} ${selected.houseNumber}, ${selected.city}`,
              phone: selected.phone,
              customerId: selected.id,
              assignedTo: 'both',
              createdBy: profileId,
              status: 'scheduled',
              reminderMinutes: [1440, 60, 0],
            })
          }}
        />
      )}
    </div>
  )
}

function onlineIntakeLabel(item: OnlineCustomerIntake) {
  if (item.status === 'completed') return 'Bereit zum Speichern'
  if (item.status === 'opened') return 'Link geöffnet'
  if (item.status === 'email_sent') return 'E-Mail gesendet'
  if (item.status === 'failed') return 'Versand fehlgeschlagen'
  if (item.status === 'expired') return 'Link abgelaufen'
  return 'Wartet'
}

function serviceLabel(value?: Customer['serviceType']) {
  if (value === 'strom') return 'Strom'
  if (value === 'gas') return 'Gas'
  if (value === 'both') return 'Strom und Gas'
  return 'Noch nicht festgelegt'
}

function emailStatusLabel(customer: Customer) {
  if (customer.privacyReceipt?.pdfStatus === 'pending') return 'PDF wird im Hintergrund erstellt'
  if (customer.privacyReceipt?.pdfStatus === 'failed') return 'PDF wird beim Download erneut erstellt'
  const status = customer.privacyReceipt?.emailStatus
  if (!customer.email) return 'Keine E-Mail hinterlegt'
  if (status === 'sent') return `Versendet ${customer.privacyReceipt?.emailSentAt ? formatDateTime(customer.privacyReceipt.emailSentAt) : ''}`
  if (status === 'configuration_required') return 'Versand noch nicht konfiguriert'
  if (status === 'failed') return 'Versand fehlgeschlagen'
  if (status === 'not_requested') return 'Nicht automatisch versendet'
  return 'Versand offen'
}

function welcomeEmailStatusLabel(customer: Customer) {
  if (!customer.email) return 'Keine E-Mail hinterlegt'
  const status = customer.welcomeEmail?.status
  if (status === 'sent') return `An Versanddienst übergeben${customer.welcomeEmail?.sentAt ? ` ${formatDateTime(customer.welcomeEmail.sentAt)}` : ''}`
  if (status === 'configuration_required') return 'Versand nicht konfiguriert'
  if (status === 'failed') return 'Versand fehlgeschlagen'
  if (status === 'not_requested') return 'Nicht angefordert'
  return 'Für ältere Kunden noch kein Status gespeichert'
}

function CustomerDetail({ customer, profileId, onClose, onSave, onResendPrivacy, onResendWelcome, onRenew, onTrash, onCancel, onCreateAppointment }: {
  customer: Customer
  profileId: ProfileId
  onClose: () => void
  onSave: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Customer>
  onResendPrivacy: () => Promise<void>
  onResendWelcome: () => Promise<void>
  onRenew: (date: string, serviceType?: Customer['serviceType']) => Promise<void>
  onTrash: () => Promise<void>
  onCancel: (cancellation: NonNullable<Customer['cancellation']>) => Promise<void>
  onCreateAppointment: () => Promise<void>
}) {
  const [editing, setEditing] = useState(customer.recordState === 'draft')
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? '',
    street: customer.street,
    houseNumber: customer.houseNumber,
    postalCode: customer.postalCode ?? '',
    city: customer.city,
    district: customer.district,
    serviceType: customer.serviceType ?? 'both' as NonNullable<Customer['serviceType']>,
    salesOwner: salesOwnerOf(customer),
    commissionAmount: euroInputFromCents(customer.commissionAmountCents),
    followUpAt: customer.followUpAt?.slice(0, 10) ?? dateAfterYears(1),
    note: customer.note ?? '',
  })
  const [renewDate, setRenewDate] = useState(customer.followUpAt?.slice(0, 10) ?? dateAfterYears(1))
  const [renewType, setRenewType] = useState<NonNullable<Customer['serviceType']>>(customer.serviceType ?? 'both')
  const [documents, setDocuments] = useState<CustomerDocumentMeta[]>([])
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelCategory, setCancelCategory] = useState<NonNullable<Customer['cancellation']>['category']>('withdrawal')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, busy])

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/customers/${customer.id}/documents`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((result: { ok: boolean; documents?: Array<Record<string, unknown>> }) => {
        if (cancelled || !result.ok) return
        setDocuments((result.documents ?? []).map((item) => ({
          id: String(item.id), customerId: String(item.customer_id), kind: item.kind as CustomerDocumentMeta['kind'], fileName: String(item.file_name), mimeType: String(item.mime_type), sizeBytes: Number(item.size_bytes), sha256: String(item.sha256), createdAt: String(item.created_at),
        })))
        setDocumentsLoaded(true)
      })
      .catch(() => setDocumentsLoaded(true))
    return () => { cancelled = true }
  }, [customer.id])

  async function downloadProtectedFile(url: string, fallbackName: string) {
    setBusy(true)
    setNotice(undefined)
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 30_000)
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) {
          const result = await response.json().catch(() => ({ error: `Download fehlgeschlagen (${response.status}).` })) as { error?: string }
          throw new Error(result.error ?? `Download fehlgeschlagen (${response.status}).`)
        }
        const blob = await response.blob()
        const disposition = response.headers.get('content-disposition') ?? ''
        const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
        const plainName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        const fileName = encodedName ? decodeURIComponent(encodedName) : plainName || fallbackName
        const objectUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000)
        setNotice(`${fileName} wurde heruntergeladen.`)
      } finally {
        window.clearTimeout(timeout)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Download fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdits() {
    if (form.phone.trim().length < 3) { setNotice('Bitte eine gültige Telefonnummer eintragen.'); return }
    const commission = centsFromEuroInput(form.commissionAmount)
    if (!commission || commission <= 0) { setNotice('Bitte die genaue Provision als Betrag größer 0,00 € eintragen.'); return }
    setBusy(true); setNotice(undefined)
    try {
      await onSave({
        ...customer,
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || undefined,
        street: form.street.trim(), houseNumber: form.houseNumber.trim(), postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim(), district: form.district.trim(), serviceType: form.serviceType,
        salesOwner: form.salesOwner, commissionAmountCents: commission,
        followUpAt: form.followUpAt || undefined, note: form.note.trim() || undefined, recordState: 'active', lastContactAt: new Date().toISOString(),
      })
      setEditing(false)
      setNotice(form.email.trim() && customer.privacyReceipt?.emailAddress !== form.email.trim() ? 'Gespeichert. Die E-Mail-Adresse wurde aktualisiert; es wurde keine Nachricht automatisch versendet.' : 'Kundendaten gespeichert.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  async function uploadDocument(file?: File) {
    if (!file) return
    setBusy(true); setNotice(undefined)
    try {
      const body = new FormData(); body.set('file', file)
      const response = await fetch(`/api/customers/${customer.id}/documents`, { method: 'POST', body })
      const result = await response.json() as { ok: boolean; document?: Record<string, unknown>; error?: string }
      if (!response.ok || !result.ok || !result.document) throw new Error(result.error ?? 'Upload fehlgeschlagen.')
      const item = result.document
      setDocuments((current) => [{ id: String(item.id), customerId: customer.id, kind: 'customer_attachment', fileName: String(item.file_name), mimeType: String(item.mime_type), sizeBytes: Number(item.size_bytes), sha256: String(item.sha256), createdAt: String(item.created_at) }, ...current])
      setNotice('Dokument sicher gespeichert.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Upload fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  async function deleteDocument(document: CustomerDocumentMeta) {
    if (!window.confirm(`${document.fileName} endgültig löschen?`)) return
    setBusy(true)
    try {
      const response = await fetch(`/api/customers/${customer.id}/documents/${document.id}`, { method: 'DELETE' })
      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'Löschen fehlgeschlagen.')
      setDocuments((current) => current.filter((item) => item.id !== document.id))
      setNotice('Dokument endgültig gelöscht.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.') }
    finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}>
      <section className="modal-card customer-detail privacy-customer-detail" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header customer-detail-header">
          <button type="button" className="customer-detail-back-button" disabled={busy} onClick={onClose}><ArrowLeft /> Zurück</button>
          <div className="customer-detail-title"><span className="eyebrow">Kundenkartei · Datenschutz geschützt</span><h2>{customer.name}</h2><p>{customer.street} {customer.houseNumber}, {customer.postalCode} {customer.city}</p></div>
          <button type="button" className="icon-button modal-close-button" aria-label="Kundenkartei schließen" disabled={busy} onClick={onClose}><X /></button>
        </div>

        {customer.recordState === 'draft' && <div className="privacy-warning"><AlertTriangle /><div><strong>Datensatz noch nicht vollständig</strong><span>Bitte Telefonnummer und Betreuungsdatum ergänzen. Ein Datenschutz-Nachweis ist optional.</span></div></div>}
        {notice && <p className="inline-notice">{notice}</p>}

        <div className="quick-contact-row">
          {customer.phone && <a href={telUrl(customer.phone)}><Phone /> Anrufen</a>}
          {customer.phone && <a href={whatsappUrl(customer.phone)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>}
          <a href={googleAddressUrl(`${customer.street} ${customer.houseNumber}, ${customer.city}`)} target="_blank" rel="noreferrer"><MapPin /> Navigation</a>
        </div>

        {editing ? (
          <div className="form-grid customer-edit-grid">
            <label className="span-2">Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Telefon<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
            <label>E-Mail optional<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="span-2">Straße<input value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} /></label>
            <label>Hausnummer<input value={form.houseNumber} onChange={(event) => setForm({ ...form, houseNumber: event.target.value })} /></label>
            <label>PLZ<input value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} /></label>
            <label>Ort<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            <label>Gebiet<input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} /></label>
            <label>Beratung<select value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value as typeof form.serviceType })}><option value="strom">Strom</option><option value="gas">Gas</option><option value="both">Strom und Gas</option></select></label>
            <label>Wirtschaftliche Zuordnung<select value={form.salesOwner} onChange={(event) => setForm({ ...form, salesOwner: event.target.value as typeof form.salesOwner })}><option value="voss">Herr Voss · 100 %</option><option value="dicke">Herr Dicke · 100 %</option><option value="both">Gemeinsam · 50/50</option></select></label>
            <label>Provision exakt (€)<input inputMode="decimal" value={form.commissionAmount} onChange={(event) => setForm({ ...form, commissionAmount: event.target.value })} placeholder="z. B. 180,00" /></label>
            <label>Wiedervorlage<input type="date" value={form.followUpAt} onChange={(event) => setForm({ ...form, followUpAt: event.target.value })} /></label>
            {centsFromEuroInput(form.commissionAmount) ? <div className="span-2 commission-preview"><strong>Neue Verteilung:</strong><span>{form.salesOwner === 'voss' ? `Herr Voss ${formatEuroFromCents(centsFromEuroInput(form.commissionAmount) ?? 0)}` : form.salesOwner === 'dicke' ? `Herr Dicke ${formatEuroFromCents(centsFromEuroInput(form.commissionAmount) ?? 0)}` : `Herr Voss ${formatEuroFromCents(Math.floor((centsFromEuroInput(form.commissionAmount) ?? 0) / 2))} · Herr Dicke ${formatEuroFromCents((centsFromEuroInput(form.commissionAmount) ?? 0) - Math.floor((centsFromEuroInput(form.commissionAmount) ?? 0) / 2))}`}</span></div> : null}
            <label className="span-2">Sachliche Notiz<textarea rows={3} maxLength={2000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Keine sensiblen Angaben wie Gesundheit, Religion oder Herkunft eintragen." /></label>
            <div className="modal-actions span-2"><button type="button" className="secondary-button" disabled={busy} onClick={() => setEditing(false)}>Abbrechen</button><button type="button" className="primary-button" disabled={busy} onClick={() => void saveEdits()}><Save /> {busy ? 'Wird gespeichert …' : 'Speichern'}</button></div>
          </div>
        ) : (
          <>
            <dl className="detail-list">
              <div><dt>Telefon</dt><dd>{customer.phone || 'Noch offen'}</dd></div>
              <div><dt>E-Mail</dt><dd>{customer.email || 'Freiwillig nicht angegeben'}</dd></div>
              <div><dt>Beratung</dt><dd>{serviceLabel(customer.serviceType)}</dd></div>
              <div><dt>Wirtschaftliche Zuordnung</dt><dd>{salesOwnerLabel(salesOwnerOf(customer))}</dd></div>
              <div><dt>Provision</dt><dd>{customer.commissionAmountCents ? formatEuroFromCents(customer.commissionAmountCents) : 'Noch nicht eingetragen'}</dd></div>
              <div><dt>Arbeitsmonat</dt><dd>{customerWorkMonth(customer).label}</dd></div>
              <div><dt>Anspruch Herr Voss</dt><dd>{formatEuroFromCents(commissionShares(customer).voss)}</dd></div>
              <div><dt>Anspruch Herr Dicke</dt><dd>{formatEuroFromCents(commissionShares(customer).dicke)}</dd></div>
              <div><dt>Technisch erfasst von</dt><dd>{PROFILE_LABELS[customer.completedBy]}</dd></div>
              <div><dt>Quelle</dt><dd>{customer.source === 'd2d' ? 'Persönliche Haustürberatung' : customer.source === 'online' ? 'Online / Telefon' : customer.source ?? 'Nicht angegeben'}</dd></div>
              <div><dt>Wiedervorlage</dt><dd>{customer.followUpAt ? formatDateTime(customer.followUpAt, { dateStyle: 'medium' }) : 'Keine'}</dd></div>
              {customer.note && <div className="span-2"><dt>Notiz</dt><dd>{customer.note}</dd></div>}
            </dl>
            <p className="customer-attribution-lock"><ShieldCheck /> Erfasst von bleibt als technischer Nachweis erhalten. Wirtschaftliche Zuordnung und Provision können nur bewusst in der Kundenkartei geändert werden; Änderungen werden serverseitig protokolliert.</p>
            <button type="button" className="secondary-button edit-customer-button" disabled={busy} onClick={() => setEditing(true)}><Pencil /> Kundendaten bearbeiten</button>
          </>
        )}

        <section className="privacy-record-card">
          <div className="section-heading compact"><div><span className="eyebrow">Kundenkommunikation</span><h3>Dankes-E-Mail</h3></div><Mail /></div>
          <dl className="detail-list compact-details">
            <div><dt>Empfänger</dt><dd>{customer.email || 'Keine E-Mail hinterlegt'}</dd></div>
            <div><dt>Status</dt><dd>{welcomeEmailStatusLabel(customer)}</dd></div>
            {customer.welcomeEmail?.resendId && <div><dt>Versand-ID</dt><dd title={customer.welcomeEmail.resendId}>{customer.welcomeEmail.resendId.slice(0, 18)}…</dd></div>}
          </dl>
          {customer.welcomeEmail?.error && <p className="form-error">{customer.welcomeEmail.error}</p>}
          <div className="privacy-document-actions">
            <button type="button" className="secondary-button" disabled={busy || !customer.email} onClick={async () => { setBusy(true); setNotice(undefined); try { await onResendWelcome(); setNotice('Dankes-E-Mail wurde an den Versanddienst übergeben.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Versand fehlgeschlagen.'); } finally { setBusy(false) } }}><Mail /> Dankes-E-Mail senden</button>
          </div>
        </section>

        <section className="privacy-record-card">
          <div className="section-heading compact"><div><span className="eyebrow">Datenschutz & Nachweise</span><h3>Optionaler Datenschutz-Nachweis</h3></div><ShieldCheck /></div>
          {customer.privacyReceipt ? (
            <>
              <dl className="detail-list compact-details">
                <div><dt>Version</dt><dd>{customer.privacyReceipt.version}</dd></div>
                <div><dt>Bestätigt</dt><dd>{formatDateTime(customer.privacyReceipt.acknowledgedAt)}</dd></div>
                <div><dt>PDF-Prüfsumme</dt><dd title={customer.privacyReceipt.sha256}>{customer.privacyReceipt.sha256.slice(0, 16)}…</dd></div>
                <div><dt>E-Mail</dt><dd>{emailStatusLabel(customer)}</dd></div>
              </dl>
              {customer.privacyReceipt.pdfStatus === 'pending' && <p className="inline-notice">Die Kundenkartei ist gespeichert. Die PDF wird im Hintergrund fertiggestellt; ein E-Mail-Versand erfolgt nur manuell.</p>}
              {customer.privacyReceipt.pdfError && <p className="form-error">{customer.privacyReceipt.pdfError}</p>}
              {customer.privacyReceipt.emailError && <p className="form-error">{customer.privacyReceipt.emailError}</p>}
              <div className="privacy-document-actions">
                <button type="button" className="primary-button" disabled={busy} onClick={() => void downloadProtectedFile(`/api/customers/${customer.id}/privacy-pdf`, customer.privacyReceipt?.fileName ?? 'Datenschutzinformation.pdf')}><Download /> Datenschutz-PDF</button>
                <button type="button" className="secondary-button" disabled={busy || !customer.email} onClick={async () => { setBusy(true); try { await onResendPrivacy(); setNotice('Datenschutz-PDF wurde manuell versendet.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Versand fehlgeschlagen.'); } finally { setBusy(false) } }}><Mail /> PDF per E-Mail senden</button>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => void downloadProtectedFile(`/api/customers/${customer.id}/export?format=pdf`, `Datenauskunft_${customer.name}.pdf`)}><Download /> Datenauskunft PDF</button>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => void downloadProtectedFile(`/api/customers/${customer.id}/export?format=json`, `Datenauskunft_${customer.name}.json`)}><Download /> Datenauskunft JSON</button>
              </div>
            </>
          ) : <p className="inline-notice">Für diesen Kunden wurde in der App kein zusätzlicher Datenschutz-Nachweis angefordert. Das ist kein Fehler; die optionale Bestätigung kann bei Bedarf separat eingeholt werden.</p>}
        </section>

        <section className="customer-documents-card">
          <div className="section-heading compact"><div><span className="eyebrow">Private Ablage</span><h3>Optionale Dokumente</h3></div><FileText /></div>
          <p className="muted">Nur hochladen, wenn die Datei für die konkrete Beratung notwendig oder vom Kunden gewünscht ist. Keine Ausweise speichern.</p>
          <label className="document-upload-button"><Upload /> Dokument hinzufügen<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadDocument(file) }} disabled={busy} /></label>
          {!documentsLoaded ? <p><RefreshCw className="spin" /> Dokumente werden geladen …</p> : (
            <div className="customer-document-list">
              {documents.filter((item) => item.kind === 'customer_attachment').map((document) => (
                <article key={document.id}><FileText /><div><strong>{document.fileName}</strong><small>{Math.ceil(document.sizeBytes / 1024)} KB · {formatDateTime(document.createdAt)}</small></div><button type="button" disabled={busy} onClick={() => void downloadProtectedFile(`/api/customers/${customer.id}/documents/${document.id}`, document.fileName)} title="Herunterladen"><Download /></button><button type="button" disabled={busy} onClick={() => void deleteDocument(document)} title="Endgültig löschen"><Trash2 /></button></article>
              ))}
              {!documents.some((item) => item.kind === 'customer_attachment') && <p className="empty-state">Keine zusätzlichen Dokumente gespeichert.</p>}
            </div>
          )}
        </section>

        {customer.status === 'active' && (
          <section className="followup-controls privacy-followup-controls">
            <div><strong>Betreuung verlängern / neuer Abschluss</strong><small>Das Datum wird nur verlängert, wenn der Kunde eure Dienstleistung erneut nutzt. Es verlängert keinen Energievertrag automatisch.</small></div>
            <select value={renewType} onChange={(event) => setRenewType(event.target.value as typeof renewType)}><option value="strom">Strom</option><option value="gas">Gas</option><option value="both">Strom und Gas</option></select>
            <input type="date" value={renewDate} onChange={(event) => setRenewDate(event.target.value)} />
            <div className="quick-times"><button type="button" onClick={() => setRenewDate(dateAfterYears(1))}>In 1 Jahr</button><button type="button" onClick={() => setRenewDate(dateAfterYears(2))}>In 2 Jahren</button></div>
            <button type="button" className="primary-button" disabled={busy || !renewDate} onClick={async () => { setBusy(true); try { await onRenew(renewDate, renewType); setNotice('Betreuung und Wiedervorlage wurden verlängert.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Verlängerung fehlgeschlagen.'); } finally { setBusy(false) } }}><CheckCircle2 /> Verlängerung speichern</button>
          </section>
        )}

        {customer.status === 'cancelled' && customer.cancellation && <div className="cancellation-box"><AlertTriangle /><div><strong>Storniert am {formatDateTime(customer.cancellation.date, { dateStyle: 'medium' })}</strong><p>{customer.cancellation.reason || 'Kein Grund angegeben'}</p></div></div>}

        {!cancelOpen ? (
          <div className="modal-actions customer-sensitive-actions">
            {customer.status === 'active' && <button type="button" className="secondary-button" disabled={busy} onClick={() => setCancelOpen(true)}><AlertTriangle /> Storno erfassen</button>}
            <button type="button" className="secondary-button" disabled={busy} onClick={async () => {
              setBusy(true); setNotice(undefined)
              try {
                await onCreateAppointment()
                setNotice('Termin für morgen angelegt.')
              } catch (error) {
                setNotice(error instanceof Error ? error.message : 'Termin konnte nicht angelegt werden.')
              } finally {
                setBusy(false)
              }
            }}><CalendarPlus /> Termin für morgen</button>
            <button type="button" className="danger-button" disabled={busy} onClick={async () => {
              if (!window.confirm('Betreuung wirklich beenden? Die Kundenkartei, Termine und Nachweise wandern in den Papierkorb und werden nach der Frist endgültig gelöscht.')) return
              setBusy(true); setNotice(undefined)
              try {
                await onTrash()
              } catch (error) {
                setNotice(error instanceof Error ? error.message : 'Betreuung konnte nicht beendet werden.')
              } finally {
                setBusy(false)
              }
            }}><Trash2 /> Betreuung beenden</button>
          </div>
        ) : (
          <form className="cancel-form" onSubmit={async (event) => {
            event.preventDefault(); setBusy(true); setNotice(undefined)
            try {
              await onCancel({ date: new Date().toISOString().slice(0, 10), reason: cancelReason, category: cancelCategory, createdBy: profileId })
            } catch (error) {
              setNotice(error instanceof Error ? error.message : 'Storno konnte nicht gespeichert werden.')
            } finally {
              setBusy(false)
            }
          }}>
            <label>Kategorie<select value={cancelCategory} onChange={(event) => setCancelCategory(event.target.value as typeof cancelCategory)}><option value="withdrawal">Widerruf durch Kunden</option><option value="provider_rejected">Anbieter abgelehnt</option><option value="data_error">Daten fehlerhaft</option><option value="other">Sonstiges</option></select></label>
            <label>Grund / sachliche Notiz<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} /></label>
            <div className="modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setCancelOpen(false)}>Abbrechen</button><button type="submit" className="danger-button" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Storno speichern'}</button></div>
          </form>
        )}
      </section>
    </div>
  )
}
