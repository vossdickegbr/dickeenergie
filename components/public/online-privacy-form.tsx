'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, MailCheck, Send, ShieldCheck } from 'lucide-react'
import { SignaturePad } from '@/components/common/signature-pad'
import { CUSTOMER_PRIVACY_SECTIONS, PRIVACY_NOTICE_META } from '@/lib/privacy-notice'

interface PublicIntakeState {
  status: 'email_pending' | 'email_sent' | 'opened' | 'completed' | 'finalized' | 'expired' | 'failed'
  name: string
  emailMasked: string
  expiresAt: string
  privacyNoticeVersion: string
  completedAt?: string | null
  finalizedAt?: string | null
  deliveryError?: string | null
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin',
  }).format(new Date(value))
}

export function OnlinePrivacyForm({ token }: { token: string }) {
  const [intake, setIntake] = useState<PublicIntakeState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [signature, setSignature] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string>()
  const [completed, setCompleted] = useState(false)
  const [warning, setWarning] = useState<string>()

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await fetch(`/api/public/online-intakes/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const result = await response.json() as { ok: boolean; intake?: PublicIntakeState; error?: string }
        if (!response.ok || !result.ok || !result.intake) throw new Error(result.error ?? 'Link konnte nicht geladen werden.')
        if (active) {
          setIntake(result.intake)
          setCompleted(result.intake.status === 'completed' || result.intake.status === 'finalized')
          setWarning(result.intake.deliveryError ?? undefined)
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Link konnte nicht geladen werden.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [token])

  async function completeIntake() {
    if (busy) return
    if (code.length !== 6) { setError('Bitte den sechsstelligen Code aus der E-Mail eingeben.'); return }
    if (!accepted) { setError('Bitte den Erhalt der Datenschutzinformation bestätigen.'); return }
    setBusy(true)
    setError(undefined)
    try {
      const response = await fetch(`/api/public/online-intakes/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, signatureDataUrl: signature || undefined, acknowledgementAccepted: true }),
      })
      const result = await response.json() as { ok: boolean; error?: string; warning?: string; completedAt?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'Bestätigung konnte nicht gespeichert werden.')
      setCompleted(true)
      setWarning(result.warning)
      setIntake((current) => current ? { ...current, status: 'completed', completedAt: result.completedAt ?? new Date().toISOString() } : current)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bestätigung konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <main className="public-privacy-shell"><section className="public-privacy-card public-loading"><ShieldCheck /><h1>Datenschutzinformation wird geladen</h1><p>Bitte einen Moment warten.</p></section></main>
  }

  if (error && !intake) {
    return <main className="public-privacy-shell"><section className="public-privacy-card public-result-card error"><AlertTriangle /><h1>Link nicht verfügbar</h1><p>{error}</p><small>Bitte wenden Sie sich an Voss & Dicke GbR und lassen Sie sich einen neuen Link senden.</small></section></main>
  }

  if (!intake) return null

  if (intake.status === 'expired') {
    return <main className="public-privacy-shell"><section className="public-privacy-card public-result-card error"><Clock3 /><h1>Der Link ist abgelaufen</h1><p>Bitte lassen Sie sich von Voss & Dicke GbR einen neuen persönlichen Link zusenden.</p></section></main>
  }

  if (completed) {
    return (
      <main className="public-privacy-shell">
        <section className="public-privacy-card public-result-card success">
          <CheckCircle2 />
          <span className="eyebrow">Bestätigung abgeschlossen</span>
          <h1>Vielen Dank, {intake.name}</h1>
          <p>Ihre E-Mail-Adresse und der Erhalt der Datenschutzinformation wurden bestätigt. Eine freiwillig geleistete elektronische Unterschrift wurde – sofern angegeben – in die Nachweis-PDF aufgenommen.</p>
          <div className="public-success-line"><MailCheck /><span>Die Nachweis-PDF wurde geschützt gespeichert. Sie wird nicht automatisch per E-Mail versendet.</span></div>
          {warning && <p className="public-warning"><AlertTriangle /> Die Bestätigung ist gespeichert: {warning}</p>}
          <small>Eine freiwillige Unterschrift dient nur als zusätzlicher Nachweis. Sie ist keine Vertragsunterschrift und keine pauschale Werbeeinwilligung.</small>
        </section>
      </main>
    )
  }

  return (
    <main className="public-privacy-shell">
      <section className="public-privacy-card">
        <header className="public-privacy-header">
          <div className="public-brand-mark">V&amp;D</div>
          <div><span className="eyebrow">Voss &amp; Dicke GbR</span><h1>Datenschutzinformation bestätigen</h1></div>
        </header>

        <div className="public-intake-summary">
          <ShieldCheck />
          <div><strong>Guten Tag {intake.name}</strong><span>Der persönliche Link gilt bis {formatDateTime(intake.expiresAt)}.</span><small>Versand an {intake.emailMasked} · Version {intake.privacyNoticeVersion}</small></div>
        </div>

        <div className="privacy-notice-panel public-notice" tabIndex={0} aria-label="Datenschutzinformation zum Durchlesen">
          <div className="privacy-notice-title"><ShieldCheck /><div><strong>{PRIVACY_NOTICE_META.title}</strong><small>Version {intake.privacyNoticeVersion}</small></div></div>
          {CUSTOMER_PRIVACY_SECTIONS.map((section) => (
            <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>
          ))}
        </div>

        {error && <p className="public-form-error"><AlertTriangle /> {error}</p>}

        <label className="public-code-field">
          <span>Sechsstelliger Bestätigungscode aus der E-Mail</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
          />
        </label>

        <div className="public-optional-signature">
          <div className="public-optional-signature-heading">
            <strong>Unterschrift (freiwillig)</strong>
            <span>Sie können zusätzlich unterschreiben. Für die Bestätigung der Datenschutzinformation ist dies nicht erforderlich.</span>
          </div>
          <SignaturePad value={signature} onChange={setSignature} disabled={busy} />
        </div>

        <label className="privacy-confirmation-check public-confirmation-check">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>{PRIVACY_NOTICE_META.acknowledgementText}</span>
        </label>

        <button
          type="button"
          className="primary-button public-submit-button"
          disabled={busy || code.length !== 6 || !accepted}
          onClick={() => void completeIntake()}
        >
          <Send /> {busy ? 'Bestätigung wird sicher gespeichert …' : signature ? 'Bestätigung mit freiwilliger Unterschrift speichern' : 'Bestätigung sicher speichern'}
        </button>
        <p className="public-legal-hint">Die Bestätigung betrifft nur die Datenschutzinformation. Strom- und Gasverträge werden ausschließlich im gesonderten TeleSon-Prozess abgeschlossen.</p>
      </section>
    </main>
  )
}
