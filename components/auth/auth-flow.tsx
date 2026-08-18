'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, Check, CheckCircle2, Delete, KeyRound, LockKeyhole, ShieldCheck, Sparkles,
} from 'lucide-react'
import {
  clearRuntimeAuthentication,
  clearManualLock,
  createDevicePin,
  hasDevicePin,
  isManuallyLocked,
  markDeviceLocked,
  markRuntimeAuthenticated,
  runtimeAuthenticatedProfile,
  verifyDevicePin,
} from '@/lib/pin'
import type { ProfileId } from '@/lib/types'
import { PROFILE_LABELS } from '@/lib/utils'

type Stage = 'checking' | 'company' | 'profile' | 'otp' | 'pin-create' | 'pin-unlock' | 'welcome'

function PinPad({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const press = (digit: string) => {
    if (value.length >= 6 || disabled) return
    onChange(value + digit)
  }

  return (
    <div className="pin-pad" aria-label="Schnell-PIN Eingabe">
      <div className="pin-dots" aria-live="polite">
        {Array.from({ length: 6 }, (_, index) => <span key={index} className={index < value.length ? 'filled' : ''} />)}
      </div>
      <div className="pin-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button type="button" key={digit} onClick={() => press(String(digit))} disabled={disabled}>{digit}</button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} disabled={disabled}>0</button>
        <button type="button" className="pin-delete" onClick={() => onChange(value.slice(0, -1))} disabled={disabled || !value} aria-label="Letzte Ziffer löschen"><Delete /></button>
      </div>
    </div>
  )
}

function WelcomeExperience({ profile }: { profile: ProfileId }) {
  return (
    <motion.section
      key="welcome"
      className="welcome-stage"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.035 }}
      transition={{ duration: .45 }}
      aria-live="polite"
    >
      <motion.div
        className="welcome-aurora welcome-aurora-one"
        initial={{ opacity: 0, scale: .55, x: -80, y: -40 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        transition={{ duration: 1.25, ease: 'easeOut' }}
      />
      <motion.div
        className="welcome-aurora welcome-aurora-two"
        initial={{ opacity: 0, scale: .6, x: 90, y: 70 }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        transition={{ duration: 1.45, delay: .08, ease: 'easeOut' }}
      />

      <div className="welcome-stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <motion.i
            key={index}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, .85, .25], scale: [0, 1, .65], y: [8, -8, -20] }}
            transition={{ duration: 2.2, delay: .18 + index * .07, repeat: Infinity, repeatDelay: 1.4 }}
          />
        ))}
      </div>

      <div className="welcome-visual">
        <motion.div
          className="welcome-orbit welcome-orbit-outer"
          initial={{ opacity: 0, scale: .4, rotate: -80 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 75, damping: 14 }}
        />
        <motion.div
          className="welcome-orbit welcome-orbit-inner"
          initial={{ opacity: 0, scale: .55, rotate: 90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 90, damping: 15, delay: .12 }}
        />
        <motion.div
          className="welcome-logo-platform"
          initial={{ opacity: 0, scale: .35, rotateY: -28, filter: 'blur(18px)' }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 92, damping: 13, delay: .16 }}
        >
          <motion.div
            className="welcome-logo-shine"
            initial={{ x: '-170%', opacity: 0 }}
            animate={{ x: '170%', opacity: [0, .75, 0] }}
            transition={{ duration: 1.05, delay: .72, ease: 'easeInOut' }}
          />
          <Image src="/brand/vd-logo.png" width={250} height={250} alt="Voss & Dicke GbR" priority />
          <motion.span
            className="welcome-check"
            initial={{ opacity: 0, scale: .2, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 230, damping: 13, delay: .92 }}
          >
            <CheckCircle2 />
          </motion.span>
        </motion.div>
      </div>

      <motion.div
        className="welcome-copy"
        initial={{ opacity: 0, y: 34, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: .72, delay: .72, ease: 'easeOut' }}
      >
        <motion.span
          className="welcome-kicker"
          initial={{ opacity: 0, scale: .8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.02 }}
        >
          <Sparkles /> Persönlicher Arbeitsbereich bereit
        </motion.span>
        <h1><span>Willkommen,</span><strong>{PROFILE_LABELS[profile]}</strong></h1>
        <p>Schön, dass du da bist. Dein Arbeitstag, deine Termine und dein Live-Fortschritt stehen bereit.</p>
      </motion.div>

      <motion.div
        className="welcome-loading"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.32 }}
      >
        <span><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 2.8, delay: 1.35, ease: 'easeInOut' }} /></span>
        <small>Startseite wird geöffnet …</small>
      </motion.div>
    </motion.section>
  )
}

export function AuthFlow({ onAuthenticated }: { onAuthenticated: (profileId: ProfileId) => void }) {
  const [stage, setStage] = useState<Stage>('checking')
  const [company, setCompany] = useState({ username: '', password: '' })
  const [profile, setProfile] = useState<ProfileId>('voss')
  const [sessionProfile, setSessionProfile] = useState<ProfileId | null>(null)
  const [companyGateAvailable, setCompanyGateAvailable] = useState(false)
  const [quickProfileMode, setQuickProfileMode] = useState(false)
  const [otp, setOtp] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinStep, setPinStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const openHome = useCallback((targetProfile: ProfileId) => {
    const url = new URL(window.location.href)
    url.searchParams.delete('section')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    onAuthenticated(targetProfile)
  }, [onAuthenticated])

  const enterAfterPin = useCallback((targetProfile: ProfileId) => {
    clearManualLock()
    markRuntimeAuthenticated(targetProfile)
    setProfile(targetProfile)
    setStage('welcome')
    window.setTimeout(() => openHome(targetProfile), 4500)
  }, [openHome])

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result: { authenticated: boolean; companyGate: boolean; profileId?: ProfileId; activeWork?: boolean }) => {
        if (cancelled) return
        setCompanyGateAvailable(result.companyGate)
        if (result.authenticated && result.profileId) {
          setProfile(result.profileId)
          setSessionProfile(result.profileId)

          // A running work session always reopens directly on the home screen.
          if (result.activeWork && !isManuallyLocked()) {
            markRuntimeAuthenticated(result.profileId)
            openHome(result.profileId)
            return
          }

          // A short app switch/reload remains unlocked only for this live app instance.
          if (runtimeAuthenticatedProfile() === result.profileId) {
            openHome(result.profileId)
            return
          }

          // A genuinely new app session outside working hours starts with profile + PIN.
          markDeviceLocked()
          setQuickProfileMode(true)
          setStage('profile')
          return
        }

        clearRuntimeAuthentication()
        clearManualLock()
        markDeviceLocked()
        setSessionProfile(null)
        setQuickProfileMode(false)
        setStage(result.companyGate ? 'profile' : 'company')
      })
      .catch(() => {
        clearRuntimeAuthentication()
        setStage('company')
      })
    return () => { cancelled = true }
  }, [openHome])

  async function submitCompany(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      })
      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'Anmeldung fehlgeschlagen.')
      setCompanyGateAvailable(true)
      setQuickProfileMode(false)
      setSessionProfile(null)
      setStage('profile')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  async function sendOtp(targetProfile: ProfileId = profile) {
    setError('')
    setBusy(true)
    setProfile(targetProfile)
    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: targetProfile }),
      })
      const result = await response.json() as { ok: boolean; error?: string }
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'Code konnte nicht gesendet werden.')
      setOtp('')
      setStage('otp')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code konnte nicht gesendet werden.')
    } finally {
      setBusy(false)
    }
  }

  async function chooseProfile(targetProfile: ProfileId) {
    setProfile(targetProfile)
    setError('')
    if (quickProfileMode && sessionProfile === targetProfile) {
      setPin('')
      if (hasDevicePin(targetProfile)) {
        setStage('pin-unlock')
      } else {
        setPinConfirm('')
        setPinStep(1)
        setStage('pin-create')
      }
      return
    }
    if (quickProfileMode && sessionProfile !== targetProfile && !companyGateAvailable) {
      setQuickProfileMode(false)
      setError('Für den Profilwechsel muss zuerst der Firmenzugang bestätigt werden.')
      setStage('company')
      return
    }
    await sendOtp(targetProfile)
  }

  async function verifyOtpCode() {
    setError('')
    setBusy(true)
    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile, token: otp }),
      })
      const result = await response.json() as { ok: boolean; profileId?: ProfileId; error?: string }
      if (!response.ok || !result.ok || result.profileId !== profile) throw new Error(result.error ?? 'Code konnte nicht bestätigt werden.')

      setSessionProfile(profile)
      if (hasDevicePin(profile)) {
        setPin('')
        setStage('pin-unlock')
      } else {
        setPin('')
        setPinConfirm('')
        setPinStep(1)
        setStage('pin-create')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Code konnte nicht bestätigt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePinCreationSubmit() {
    setError('')
    if (pinStep === 1) {
      if (pin.length !== 6) return
      setPinStep(2)
      setPinConfirm('')
      return
    }
    if (pinConfirm.length !== 6) return
    if (pin !== pinConfirm) {
      setError('Die beiden PINs stimmen nicht überein. Bitte erneut eingeben.')
      setPin('')
      setPinConfirm('')
      setPinStep(1)
      return
    }
    setBusy(true)
    try {
      await createDevicePin(profile, pin)
      enterAfterPin(profile)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'PIN konnte nicht gespeichert werden.')
    } finally {
      setBusy(false)
    }
  }

  async function unlockWithPin() {
    if (pin.length !== 6 || busy) return
    setError('')
    setBusy(true)
    try {
      const result = await verifyDevicePin(profile, pin)
      if (result.ok) {
        enterAfterPin(profile)
      } else {
        setPin('')
        setError(result.lockedSeconds ? `Zu viele Versuche. Schnellzugang für ${Math.ceil(result.lockedSeconds / 60)} Minuten gesperrt.` : 'PIN ist nicht korrekt.')
      }
    } catch (caught) {
      setPin('')
      setError(caught instanceof Error ? caught.message : 'PIN konnte nicht geprüft werden.')
    } finally {
      setBusy(false)
    }
  }

  const otpLength = 8
  const currentPin = pinStep === 1 ? pin : pinConfirm
  const setCurrentPin = pinStep === 1 ? setPin : setPinConfirm

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <AnimatePresence mode="wait">
        {stage === 'checking' && (
          <motion.div key="checking" className="auth-card auth-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Image src="/brand/vd-logo.png" width={124} height={124} alt="Voss & Dicke GbR" priority />
            <div className="loading-line" />
          </motion.div>
        )}

        {stage === 'company' && (
          <motion.form key="company" className="auth-card" onSubmit={submitCompany} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }}>
            <Image className="auth-logo" src="/brand/vd-logo.png" width={144} height={144} alt="Voss & Dicke GbR" priority />
            <span className="eyebrow">Interne FieldOps App</span>
            <h1>Sicher anmelden</h1>
            <p className="muted">Firmenzugang öffnen. Danach Profil antippen, E-Mail-Code bestätigen und den persönlichen Schnell-PIN eingeben.</p>
            <label>Benutzername<input autoComplete="username" value={company.username} onChange={(event) => setCompany({ ...company, username: event.target.value })} required /></label>
            <label>Passwort<input type="password" autoComplete="current-password" value={company.password} onChange={(event) => setCompany({ ...company, password: event.target.value })} required /></label>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Prüfe …' : <><LockKeyhole /> Firmenzugang öffnen</>}</button>
            <p className="security-hint"><ShieldCheck /> Benutzername und Passwort werden ausschließlich serverseitig geprüft.</p>
          </motion.form>
        )}

        {stage === 'profile' && (
          <motion.section key="profile" className="auth-card auth-wide profile-choice-card" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -22 }}>
            <span className="eyebrow">Profil wählen</span>
            <h1>Wer arbeitet?</h1>
            <div className="profile-grid profile-grid-simple">
              {(['voss', 'dicke'] as ProfileId[]).map((id) => {
                const quickPin = quickProfileMode && sessionProfile === id
                return (
                  <button key={id} type="button" className={profile === id ? 'profile-card selected' : 'profile-card'} onClick={() => void chooseProfile(id)} disabled={busy}>
                    <span className="profile-avatar">{id === 'voss' ? 'V' : 'D'}</span>
                    <strong>{PROFILE_LABELS[id]}</strong>
                    <small>{busy && profile === id ? 'Bitte warten …' : quickPin ? 'Schnell-PIN' : 'E-Mail-Code'}</small>
                    {profile === id && <Check />}
                  </button>
                )
              })}
            </div>
            {error && <p className="form-error">{error}</p>}
          </motion.section>
        )}

        {stage === 'otp' && (
          <motion.section key="otp" className="auth-card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <button type="button" className="back-button" onClick={() => setStage('profile')}><ArrowLeft /> Zurück</button>
            <span className="eyebrow">2FA · E-Mail</span>
            <h1>Code bestätigen</h1>
            <p className="muted">Gib den {otpLength}-stelligen Einmalcode für {PROFILE_LABELS[profile]} ein. Anschließend bestätigst du mit deinem persönlichen Schnell-PIN.</p>
            <input className="otp-input" inputMode="numeric" pattern="[0-9]*" maxLength={otpLength} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, otpLength))} autoFocus />
            {error && <p className="form-error">{error}</p>}
            <button type="button" className="primary-button" onClick={() => void verifyOtpCode()} disabled={busy || otp.length !== otpLength}><ShieldCheck /> Code bestätigen</button>
            <button type="button" className="text-button" onClick={() => void sendOtp(profile)} disabled={busy}>Neuen Code senden</button>
          </motion.section>
        )}

        {stage === 'pin-create' && (
          <motion.section key={`pin-${pinStep}`} className="auth-card pin-card" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
            <span className="eyebrow">Vertrauenswürdiges Gerät</span>
            <KeyRound className="hero-icon" />
            <h1>{pinStep === 1 ? 'Schnell-PIN erstellen' : 'PIN wiederholen'}</h1>
            <p className="muted">{pinStep === 1 ? 'Sechs Ziffern für den schnellen App-Zugang auf diesem Gerät.' : 'Gib dieselben sechs Ziffern noch einmal ein.'}</p>
            <PinPad value={currentPin} onChange={setCurrentPin} disabled={busy} />
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" type="button" onClick={() => void handlePinCreationSubmit()} disabled={busy || currentPin.length !== 6}>{pinStep === 1 ? 'Weiter' : 'PIN speichern'}</button>
            <p className="security-hint"><ShieldCheck /> Der PIN entsperrt nur dieses vertraute Gerät. Die Datenbank bleibt durch die Serveranmeldung und 2FA geschützt.</p>
          </motion.section>
        )}

        {stage === 'pin-unlock' && (
          <motion.section key="pin-unlock" className="auth-card pin-card" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.03 }}>
            <Image className="small-logo" src="/brand/vd-logo.png" width={104} height={104} alt="Voss & Dicke GbR" priority />
            <span className="eyebrow">Willkommen zurück, {PROFILE_LABELS[profile]}</span>
            <h1>Persönlichen PIN eingeben</h1>
            <PinPad value={pin} onChange={setPin} disabled={busy} />
            {error && <p className="form-error">{error}</p>}
            <button className="primary-button" type="button" onClick={() => void unlockWithPin()} disabled={busy || pin.length !== 6}>Mit PIN starten</button>
            <button type="button" className="text-button" onClick={async () => {
              await fetch('/api/auth/company/logout', { method: 'POST' }).catch(() => undefined)
              clearRuntimeAuthentication()
              markDeviceLocked()
              setSessionProfile(null)
              setQuickProfileMode(false)
              setPin('')
              setStage('company')
            }}>Vollständig neu anmelden</button>
          </motion.section>
        )}

        {stage === 'welcome' && <WelcomeExperience profile={profile} />}
      </AnimatePresence>
    </main>
  )
}
