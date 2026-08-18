'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Save, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { SignaturePad } from '@/components/common/signature-pad'
import { useAppData } from '@/components/app/app-provider'
import type { Customer, ProfileId } from '@/lib/types'
import { CUSTOMER_PRIVACY_SECTIONS, PRIVACY_NOTICE_META } from '@/lib/privacy-notice'
import { PRIVACY_NOTICE_VERSION } from '@/lib/company-config'
import { centsFromEuroInput, formatEuroFromCents } from '@/lib/commission'

function dateAfterYears(years: number) {
  const date = new Date()
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().slice(0, 10)
}

interface IntakeSeed {
  street: string
  houseNumber: string
  postalCode?: string
  city: string
  district: string
  source: NonNullable<Customer['source']>
  weekId: string
  dayId: string
  addressLocked?: boolean
}

const acceptedFileTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])

export function CustomerIntakeModal({ profileId, seed, onClose, onSaved }: {
  profileId: ProfileId
  seed: IntakeSeed
  onClose: () => void
  onSaved?: (customer: Customer) => Promise<void> | void
}) {
  const { saveCustomer, saveCustomerPrivacy } = useAppData()
  const [signature, setSignature] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [savedCustomer, setSavedCustomer] = useState<Customer | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    street: seed.street,
    houseNumber: seed.houseNumber,
    postalCode: seed.postalCode ?? '',
    city: seed.city,
    district: seed.district,
    serviceType: 'both' as NonNullable<Customer['serviceType']>,
    salesOwner: profileId as NonNullable<Customer['salesOwner']>,
    commissionAmount: '',
    followUpAt: dateAfterYears(1),
    note: '',
  })

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, busy])

  const missingFields = useMemo(() => {
    const missing: string[] = []
    if (!form.name.trim()) missing.push('Name')
    if (!form.street.trim()) missing.push('Straße')
    if (!form.houseNumber.trim()) missing.push('Hausnummer')
    if (!form.city.trim()) missing.push('Ort')
    if (!form.district.trim()) missing.push('Gebiet / Stadtteil')
    const commission = centsFromEuroInput(form.commissionAmount)
    if (!commission || commission <= 0) missing.push('Provision')
    return missing
  }, [form])

  const canSave = missingFields.length === 0

  function addFiles(list: FileList | null) {
    if (!list) return
    const next = Array.from(list)
    const invalid = next.find((file) => !acceptedFileTypes.has(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024)
    if (invalid) {
      setError(`${invalid.name}: Erlaubt sind PDF, PNG, JPG und WebP bis 10 MB.`)
      return
    }
    setPendingFiles((current) => [...current, ...next].slice(0, 8))
    setError(undefined)
  }

  async function uploadFile(customerId: string, file: File) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 40_000)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch(`/api/customers/${customerId}/documents`, { method: 'POST', body, signal: controller.signal })
      const result = await response.json().catch(() => ({ ok: false, error: `Serverfehler (${response.status})` })) as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'Upload fehlgeschlagen.')
    } finally {
      window.clearTimeout(timeout)
    }
  }

  async function saveIntake() {
    if (busy || savedCustomer) return
    if (!canSave) {
      setError(`Bitte noch ausfüllen oder bestätigen: ${missingFields.join(', ')}.`)
      window.setTimeout(() => document.querySelector('.sticky-form-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }

    setBusy(true)
    setError(undefined)
    try {
      const hasCompletePhone = form.phone.trim().length >= 3 && /\d/.test(form.phone)
      const customerInput = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        street: form.street.trim(),
        houseNumber: form.houseNumber.trim(),
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim(),
        district: form.district.trim(),
        completedAt: new Date().toISOString(),
        completedBy: profileId,
        weekId: seed.weekId,
        dayId: seed.dayId,
        source: seed.source,
        serviceType: form.serviceType,
        salesOwner: form.salesOwner,
        commissionAmountCents: centsFromEuroInput(form.commissionAmount),
        followUpAt: form.followUpAt || undefined,
        note: form.note.trim() || undefined,
        recordState: hasCompletePhone ? 'active' as const : 'draft' as const,
        lastContactAt: hasCompletePhone ? new Date().toISOString() : undefined,
        status: 'active' as const,
      }
      const saved = accepted
        ? await saveCustomerPrivacy(customerInput, signature || undefined)
        : await saveCustomer(customerInput)

      setSavedCustomer(saved)
      await onSaved?.(saved)

      const warnings: string[] = []
      if (saved.email && saved.welcomeEmail?.status !== 'sent') {
        warnings.push(`Dankes-E-Mail nicht versendet: ${saved.welcomeEmail?.error ?? 'Versandstatus unbekannt. In der Kundenkartei kann der Versand erneut ausgelöst werden.'}`)
      }
      for (const file of pendingFiles) {
        try {
          await uploadFile(saved.id, file)
        } catch (uploadError) {
          warnings.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : 'Upload fehlgeschlagen.'}`)
        }
      }

      if (warnings.length) {
        setError(`Die Kundenkartei ist gespeichert. Hinweis: ${warnings.join(' | ')}`)
      } else {
        onClose()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Die Kundenaufnahme konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="customer-intake-title" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}>
      <section className="modal-card customer-modal privacy-intake-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Kundenaufnahme · Datenschutzinformation Version {PRIVACY_NOTICE_VERSION}</span>
            <h2 id="customer-intake-title">Kundenaufnahme</h2>
            <p>Die Kundenkartei kann ohne zusätzliche Unterschrift gespeichert werden. Ein Datenschutz-Nachweis und eine Unterschrift bleiben freiwillig möglich.</p>
          </div>
          <button type="button" className="icon-button modal-close-button" aria-label="Aufnahme schließen" disabled={busy} onClick={onClose}><X /></button>
        </div>

        {savedCustomer ? (
          <>
            <div className="privacy-saved-banner"><CheckCircle2 /><div><strong>Kundenkartei gespeichert</strong><span>Der Kunde wurde angelegt. Anhänge mit Fehlermeldung können anschließend direkt in der Kundenkartei erneut hochgeladen werden.</span></div></div>
            {error && <p className="form-error sticky-form-error">{error}</p>}
            <div className="modal-actions"><button type="button" className="primary-button" onClick={onClose}>Zur Kundenkartei</button></div>
          </>
        ) : (
          <>
            {error && <p className="form-error sticky-form-error">{error}</p>}
            <div className="privacy-notice-panel" tabIndex={0} aria-label="Datenschutzinformation zum Durchlesen">
              <div className="privacy-notice-title"><ShieldCheck /><div><strong>{PRIVACY_NOTICE_META.title}</strong><small>Version {PRIVACY_NOTICE_VERSION}</small></div></div>
              {CUSTOMER_PRIVACY_SECTIONS.map((section) => (
                <section key={section.title}><h3>{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>
              ))}
            </div>

            <div className="form-grid privacy-customer-identity">
              <label className="span-2">Name des Kunden<input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Telefon<input type="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Kann auch später ergänzt werden" /></label>
              <label>E-Mail optional<input type="email" inputMode="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label className="span-2">Straße<input required disabled={seed.addressLocked} value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} /></label>
              <label>Hausnummer<input required disabled={seed.addressLocked} value={form.houseNumber} onChange={(event) => setForm({ ...form, houseNumber: event.target.value })} /></label>
              <label>PLZ<input inputMode="numeric" value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} /></label>
              <label>Ort<input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
              <label>Gebiet / Stadtteil<input required value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} /></label>
              <label>Gewünschte Beratung<select value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value as typeof form.serviceType })}><option value="strom">Strom</option><option value="gas">Gas</option><option value="both">Strom und Gas</option></select></label>
              <label>Wem gehört der Abschluss?<select required value={form.salesOwner} onChange={(event) => setForm({ ...form, salesOwner: event.target.value as typeof form.salesOwner })}><option value="voss">Herr Voss · 100 %</option><option value="dicke">Herr Dicke · 100 %</option><option value="both">Gemeinsam · 50/50</option></select></label>
              <label>Provision exakt (€)<input required inputMode="decimal" placeholder="z. B. 180,00" value={form.commissionAmount} onChange={(event) => setForm({ ...form, commissionAmount: event.target.value })} /></label>
              <label>Wiedervorlage<input type="date" value={form.followUpAt} onChange={(event) => setForm({ ...form, followUpAt: event.target.value })} /></label>
              {centsFromEuroInput(form.commissionAmount) ? <div className="span-2 commission-preview"><strong>Verteilung:</strong><span>{form.salesOwner === 'voss' ? `Herr Voss ${formatEuroFromCents(centsFromEuroInput(form.commissionAmount) ?? 0)}` : form.salesOwner === 'dicke' ? `Herr Dicke ${formatEuroFromCents(centsFromEuroInput(form.commissionAmount) ?? 0)}` : `Herr Voss ${formatEuroFromCents(Math.floor((centsFromEuroInput(form.commissionAmount) ?? 0) / 2))} · Herr Dicke ${formatEuroFromCents((centsFromEuroInput(form.commissionAmount) ?? 0) - Math.floor((centsFromEuroInput(form.commissionAmount) ?? 0) / 2))}`}</span></div> : null}
              <label className="span-2">Sachliche Notiz optional<textarea rows={3} maxLength={2000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Keine Gesundheits-, Religions-, Herkunfts- oder sonstigen sensiblen Angaben eintragen." /></label>
            </div>

            <section className="intake-attachment-card">
              <div><strong>Optionale Bilder oder PDFs</strong><small>Die Dateien werden nach dem Speichern sicher mit der Kundenkartei verbunden.</small></div>
              <label className="document-upload-button"><Upload /> Datei auswählen<input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => { addFiles(event.currentTarget.files); event.currentTarget.value = '' }} /></label>
              {pendingFiles.length > 0 && <div className="pending-file-list">{pendingFiles.map((file, index) => <div key={`${file.name}-${file.size}-${index}`}><span>{file.name}</span><small>{Math.ceil(file.size / 1024)} KB</small><button type="button" aria-label={`${file.name} entfernen`} onClick={() => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></button></div>)}</div>}
            </section>

            <label className="privacy-confirmation-check">
              <input type="checkbox" checked={accepted} onChange={(event) => { setAccepted(event.target.checked); if (!event.target.checked) setSignature('') }} />
              <span><strong>Optionalen Datenschutz-Nachweis speichern:</strong> {PRIVACY_NOTICE_META.acknowledgementText} Eine zusätzliche Unterschrift ist freiwillig.</span>
            </label>
            {accepted && <SignaturePad value={signature} onChange={setSignature} disabled={busy} />}
            <p className="security-hint"><ShieldCheck /> Ohne aktivierte Bestätigung wird kein zusätzlicher Datenschutz-Nachweis erzeugt. Eine vorhandene E-Mail-Adresse erhält nur die Dankes-E-Mail; die Datenschutz-PDF wird niemals automatisch versendet.</p>
            <div className="modal-actions intake-detail-actions">
              <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Abbrechen</button>
              <button type="button" className="primary-button" disabled={busy} aria-disabled={!canSave || busy} onClick={() => void saveIntake()}><Save /> {busy ? 'Kunde wird gespeichert …' : form.phone.trim().length >= 3 ? 'Kundenkartei speichern' : 'Kundenkartei als Entwurf speichern'}</button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
