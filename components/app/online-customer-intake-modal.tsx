'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock3, ExternalLink, LoaderCircle, Mail, MailCheck, RefreshCw, Save, Send, ShieldCheck, X,
} from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import type { Customer, OnlineCustomerIntake, ProfileId } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { centsFromEuroInput, euroInputFromCents, formatEuroFromCents } from '@/lib/commission'

function dateAfterYears(years: number) {
  const date = new Date()
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

interface OnlineSeed {
  weekId: string
  dayId: string
  postalCode?: string
  city?: string
  district?: string
}

function statusText(status: OnlineCustomerIntake['status']) {
  switch (status) {
    case 'email_pending': return 'E-Mail wird vorbereitet'
    case 'email_sent': return 'E-Mail gesendet – wartet auf den Kunden'
    case 'opened': return 'Kunde hat den Link geöffnet'
    case 'completed': return 'E-Mail und Datenschutz bestätigt'
    case 'finalized': return 'Kundenkartei gespeichert'
    case 'expired': return 'Link abgelaufen'
    case 'failed': return 'E-Mail-Versand fehlgeschlagen'
  }
}

function statusClass(status: OnlineCustomerIntake['status']) {
  if (status === 'completed' || status === 'finalized') return 'success'
  if (status === 'failed' || status === 'expired') return 'error'
  if (status === 'opened') return 'opened'
  return 'waiting'
}

export function OnlineCustomerIntakeModal({ profileId, seed, existing, onClose, onSaved }: {
  profileId: ProfileId
  seed: OnlineSeed
  existing?: OnlineCustomerIntake | null
  onClose: () => void
  onSaved?: (customer: Customer) => Promise<void> | void
}) {
  const { finalizeOnlineCustomerIntake, refresh, saveCustomer } = useAppData()
  const [intake, setIntake] = useState<OnlineCustomerIntake | null>(existing ?? null)
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string>()
  const [requestPrivacySignature, setRequestPrivacySignature] = useState(Boolean(existing))
  const [form, setForm] = useState(() => existing ? {
    name: existing.customer.name,
    phone: existing.customer.phone,
    email: existing.customer.email,
    street: existing.customer.street,
    houseNumber: existing.customer.houseNumber,
    postalCode: existing.customer.postalCode,
    city: existing.customer.city,
    district: existing.customer.district,
    serviceType: existing.customer.serviceType,
    salesOwner: existing.customer.salesOwner ?? existing.createdBy,
    commissionAmount: euroInputFromCents(existing.customer.commissionAmountCents),
    followUpAt: existing.customer.followUpAt,
  } : {
    name: '',
    phone: '',
    email: '',
    street: '',
    houseNumber: '',
    postalCode: seed.postalCode ?? '53121',
    city: seed.city ?? 'Bonn',
    district: seed.district ?? 'Online / Telefon',
    serviceType: 'both' as const,
    salesOwner: profileId as 'voss' | 'dicke' | 'both',
    commissionAmount: '',
    followUpAt: dateAfterYears(1),
  })

  const missingFields = useMemo(() => {
    const missing: string[] = []
    if (form.name.trim().length < 2) missing.push('Name')
    if (form.phone.trim().length < 3 || !/\d/.test(form.phone)) missing.push('Telefonnummer')
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) missing.push('gültige E-Mail-Adresse')
    if (!form.street.trim()) missing.push('Straße')
    if (!form.houseNumber.trim()) missing.push('Hausnummer')
    if (form.postalCode.trim().length < 4) missing.push('PLZ')
    if (!form.city.trim()) missing.push('Ort')
    if (!form.district.trim()) missing.push('Gebiet / Stadtteil')
    if (!form.followUpAt) missing.push('Wiedervorlage')
    const commission = centsFromEuroInput(form.commissionAmount)
    if (!commission || commission <= 0) missing.push('Provision')
    return missing
  }, [form])

  const canSend = missingFields.length === 0 && !busy && !intake
  const canFinalize = intake?.status === 'completed' && !busy

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, busy])

  const intakeId = intake?.id
  const intakeStatus = intake?.status

  useEffect(() => {
    if (!intakeId || !intakeStatus || ['completed', 'finalized'].includes(intakeStatus)) return
    const currentIntakeId = intakeId
    let active = true
    async function loadStatus() {
      setPolling(true)
      try {
        const response = await fetch(`/api/online-intakes/${encodeURIComponent(currentIntakeId)}`, { cache: 'no-store' })
        const result = await response.json() as { ok: boolean; intake?: OnlineCustomerIntake; error?: string }
        if (!response.ok || !result.ok || !result.intake) throw new Error(result.error ?? 'Status konnte nicht geladen werden.')
        if (active) {
          setIntake(result.intake)
          if (result.intake.status === 'completed') await refresh()
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Status konnte nicht geladen werden.')
      } finally {
        if (active) setPolling(false)
      }
    }
    void loadStatus()
    const interval = window.setInterval(() => void loadStatus(), 3_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [intakeId, intakeStatus, refresh])

  async function saveOrSendPrivacyLink() {
    if (!canSend) {
      setError(`Bitte vollständig ausfüllen: ${missingFields.join(', ')}.`)
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      if (requestPrivacySignature) {
        const response = await fetch('/api/online-intakes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim().toLowerCase(),
            street: form.street.trim(),
            houseNumber: form.houseNumber.trim(),
            postalCode: form.postalCode.trim(),
            city: form.city.trim(),
            district: form.district.trim(),
            salesOwner: form.salesOwner,
            commissionAmountCents: centsFromEuroInput(form.commissionAmount),
            commissionAmount: undefined,
            weekId: seed.weekId,
            dayId: seed.dayId,
          }),
        })
        const result = await response.json() as { ok: boolean; intake?: OnlineCustomerIntake; error?: string }
        if (!response.ok || !result.ok || !result.intake) throw new Error(result.error ?? 'Datenschutz-E-Mail konnte nicht vorbereitet werden.')
        setIntake(result.intake)
        await refresh()
        return
      }

      const now = new Date().toISOString()
      const saved = await saveCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        street: form.street.trim(),
        houseNumber: form.houseNumber.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        completedAt: now,
        completedBy: profileId,
        weekId: seed.weekId,
        dayId: seed.dayId,
        source: 'online',
        serviceType: form.serviceType,
        salesOwner: form.salesOwner,
        commissionAmountCents: centsFromEuroInput(form.commissionAmount),
        recordState: 'active',
        followUpAt: form.followUpAt,
        lastContactAt: now,
        status: 'active',
      })

      await onSaved?.(saved)
      if (saved.welcomeEmail?.status !== 'sent') {
        setError(`Die Kundenkartei wurde gespeichert, aber die Dankes-E-Mail konnte nicht gesendet werden: ${saved.welcomeEmail?.error ?? 'Der Versandstatus ist unbekannt. Bitte in der Kundenkartei erneut senden.'}`)
        return
      }
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kundenaufnahme konnte nicht abgeschlossen werden.')
    } finally {
      setBusy(false)
    }
  }

  async function resendLink() {
    if (!intake || busy) return
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/online-intakes/${encodeURIComponent(intake.id)}/resend`, { method: 'POST' })
      const result = await response.json() as { ok: boolean; intake?: OnlineCustomerIntake; error?: string }
      if (!response.ok || !result.ok || !result.intake) throw new Error(result.error ?? 'E-Mail konnte nicht erneut gesendet werden.')
      setIntake(result.intake)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'E-Mail konnte nicht erneut gesendet werden.')
    } finally {
      setBusy(false)
    }
  }

  async function finalize() {
    if (!intake || !canFinalize) return
    setBusy(true)
    setError(undefined)
    try {
      const saved = await finalizeOnlineCustomerIntake(intake.id)
      setIntake((current) => current ? { ...current, status: 'finalized', finalizedAt: new Date().toISOString(), finalCustomerId: saved.id } : current)
      await onSaved?.(saved)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kundenkartei konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="online-intake-title" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}>
      <section className="modal-card customer-modal online-intake-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Online- und Telefonvermittlung</span>
            <h2 id="online-intake-title">Kundenaufnahme</h2>
            <p>Standardmäßig wird der Kunde direkt gespeichert und erhält nur eine freundliche Dankes-E-Mail mit Link zu eurer Website. Der Datenschutz-Link mit Code wird ausschließlich auf ausdrückliche Auswahl verschickt.</p>
          </div>
          <button type="button" className="icon-button modal-close-button" aria-label="Online-Aufnahme schließen" disabled={busy} onClick={onClose}><X /></button>
        </div>

        {error && <p className="form-error sticky-form-error">{error}</p>}

        {!intake ? (
          <>
            <div className="online-intake-explanation"><Mail /><div><strong>Normale Kundenaufnahme ohne Bestätigungszwang</strong><span>Ohne zusätzliche Auswahl erhält der Kunde nur eine Dankes-E-Mail mit Link zu vossunddicke.de. Es werden kein Bestätigungscode und kein Datenschutz-Link versendet.</span></div></div>
            <div className="form-grid privacy-customer-identity">
              <label className="span-2">Vollständiger Name<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Telefonnummer<input type="tel" inputMode="tel" required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label>E-Mail-Adresse<input type="email" inputMode="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label className="span-2">Straße<input required value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} /></label>
              <label>Hausnummer<input required value={form.houseNumber} onChange={(event) => setForm({ ...form, houseNumber: event.target.value })} /></label>
              <label>PLZ<input inputMode="numeric" required value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} /></label>
              <label>Ort<input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
              <label>Gebiet / Stadtteil<input required value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} /></label>
              <label>Beratung<select required value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value as typeof form.serviceType })}><option value="strom">Strom</option><option value="gas">Gas</option><option value="both">Strom und Gas</option></select></label>
              <label>Wem gehört der Abschluss?<select required value={form.salesOwner} onChange={(event) => setForm({ ...form, salesOwner: event.target.value as typeof form.salesOwner })}><option value="voss">Herr Voss · 100 %</option><option value="dicke">Herr Dicke · 100 %</option><option value="both">Gemeinsam · 50/50</option></select></label>
              <label>Provision exakt (€)<input required inputMode="decimal" placeholder="z. B. 180,00" value={form.commissionAmount} onChange={(event) => setForm({ ...form, commissionAmount: event.target.value })} /></label>
              <label>Wiedervorlage<input type="date" required value={form.followUpAt} onChange={(event) => setForm({ ...form, followUpAt: event.target.value })} /></label>
              {centsFromEuroInput(form.commissionAmount) ? <div className="span-2 commission-preview"><strong>Verteilung:</strong><span>{form.salesOwner === 'voss' ? `Herr Voss ${formatEuroFromCents(centsFromEuroInput(form.commissionAmount) ?? 0)}` : form.salesOwner === 'dicke' ? `Herr Dicke ${formatEuroFromCents(centsFromEuroInput(form.commissionAmount) ?? 0)}` : `Herr Voss ${formatEuroFromCents(Math.floor((centsFromEuroInput(form.commissionAmount) ?? 0) / 2))} · Herr Dicke ${formatEuroFromCents((centsFromEuroInput(form.commissionAmount) ?? 0) - Math.floor((centsFromEuroInput(form.commissionAmount) ?? 0) / 2))}`}</span></div> : null}
            <label className="privacy-confirmation-check span-2">
              <input type="checkbox" checked={requestPrivacySignature} onChange={(event) => setRequestPrivacySignature(event.target.checked)} />
              <span><strong>Optional:</strong> Datenschutzinformation mit persönlichem Link, sechsstelliger E-Mail-Code und freiwilliger Unterschrift anfordern.</span>
            </label>
            </div>
            <p className="security-hint online-security-hint"><ShieldCheck /> Der Datenschutz-Link mit Bestätigungscode wird nur versendet, wenn du die optionale Auswahl aktivierst. Die normale Dankes-E-Mail enthält weder Code noch Bestätigungslink.</p>
            <div className="modal-actions intake-detail-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Abbrechen</button>
              <button type="button" className="primary-button" disabled={busy} aria-disabled={!canSend} onClick={() => void saveOrSendPrivacyLink()}><Send /> {busy ? 'Wird verarbeitet …' : requestPrivacySignature ? 'Datenschutz-Link mit Code senden' : 'Kunde speichern & Dankes-E-Mail senden'}</button>
            </div>
          </>
        ) : (
          <>
            <section className={`online-intake-status ${statusClass(intake.status)}`}>
              <div className="online-status-icon">
                {intake.status === 'completed' || intake.status === 'finalized' ? <CheckCircle2 /> : intake.status === 'failed' || intake.status === 'expired' ? <AlertTriangle /> : intake.status === 'opened' ? <ExternalLink /> : <Mail />}
              </div>
              <div>
                <span className="eyebrow">Live-Status {polling && <LoaderCircle className="status-spinner" />}</span>
                <h3>{statusText(intake.status)}</h3>
                <p>{intake.customer.name} · {intake.customer.email}</p>
              </div>
            </section>

            <div className="online-progress-list">
              <div className={intake.emailSentAt ? 'done' : ''}><span>{intake.emailSentAt ? <CheckCircle2 /> : <Clock3 />}</span><div><strong>E-Mail versendet</strong><small>{intake.emailSentAt ? formatDateTime(intake.emailSentAt) : 'noch offen'}</small></div></div>
              <div className={intake.openedAt ? 'done' : ''}><span>{intake.openedAt ? <CheckCircle2 /> : <Clock3 />}</span><div><strong>Persönlichen Link geöffnet</strong><small>{intake.openedAt ? formatDateTime(intake.openedAt) : 'wartet auf den Kunden'}</small></div></div>
              <div className={intake.emailVerifiedAt ? 'done' : ''}><span>{intake.emailVerifiedAt ? <CheckCircle2 /> : <Clock3 />}</span><div><strong>E-Mail-Code bestätigt</strong><small>{intake.emailVerifiedAt ? formatDateTime(intake.emailVerifiedAt) : 'noch offen'}</small></div></div>
              <div className={intake.privacyAcceptedAt ? 'done' : ''}><span>{intake.privacyAcceptedAt ? <CheckCircle2 /> : <Clock3 />}</span><div><strong>Datenschutzinformation bestätigt</strong><small>{intake.privacyAcceptedAt ? formatDateTime(intake.privacyAcceptedAt) : 'noch offen'}</small></div></div>
              <div className={intake.signedAt ? 'done' : 'optional'}><span>{intake.signedAt ? <CheckCircle2 /> : <ShieldCheck />}</span><div><strong>Freiwillige Unterschrift</strong><small>{intake.signedAt ? formatDateTime(intake.signedAt) : 'nicht abgegeben – kein Fehler'}</small></div></div>
              <div className={intake.privacyReceipt ? 'done' : ''}><span>{intake.privacyReceipt ? <MailCheck /> : <Clock3 />}</span><div><strong>Datenschutz-PDF gespeichert</strong><small>{intake.privacyReceipt ? 'sicher abgelegt; kein automatischer Versand' : 'noch offen'}</small></div></div>
            </div>

            {intake.status === 'completed' && <div className="online-ready-banner"><CheckCircle2 /><div><strong>Freigabe erteilt</strong><span>Der Kunde hat E-Mail-Adresse und Datenschutzinformation bestätigt; eine Unterschrift war freiwillig. Die Kundenkartei darf jetzt gespeichert werden.</span></div></div>}

            <div className="modal-actions online-status-actions">
              <button type="button" className="secondary-button" disabled={busy || intake.status === 'completed' || intake.status === 'finalized'} onClick={() => void resendLink()}><RefreshCw /> Neuen Link senden</button>
              <button type="button" className="primary-button" disabled={busy || !canFinalize} onClick={() => void finalize()}><Save /> {busy ? 'Kundenkartei wird gespeichert …' : 'Kundenkartei speichern'}</button>
            </div>
            {!canFinalize && intake.status !== 'finalized' && <p className="online-save-lock"><ShieldCheck /> Der Speicherbutton wird erst freigeschaltet, wenn E-Mail-Code und Datenschutzbestätigung vollständig zurückgekommen sind.</p>}
          </>
        )}
      </section>
    </div>
  )
}
