'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import {
  Archive, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronLeft, Clock3, Coffee, Database, Delete, Home, LockKeyhole,
  Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings, ShieldCheck, Trash2, UsersRound, X,
} from 'lucide-react'
import { HomeSection } from '@/components/app/home-section'
import { TodaySection } from '@/components/app/today-section'
import { WeekSection } from '@/components/app/week-section'
import { CustomersSection } from '@/components/app/customers-section'
import { CalendarSection } from '@/components/app/calendar-section'
import { NotificationsSection } from '@/components/app/notifications-section'
import { ArchiveSection } from '@/components/app/archive-section'
import { TrashSection } from '@/components/app/trash-section'
import { AdminSection } from '@/components/app/admin-section'
import { PartnerActivitySection } from '@/components/app/partner-activity-section'
import { PwaTools } from '@/components/common/pwa-tools'
import { NotificationWatcher } from '@/components/app/notification-watcher'
import { useModalScrollLock } from '@/components/common/use-modal-scroll-lock'
import { useAppData } from '@/components/app/app-provider'
import { clearRuntimeAuthentication, markDeviceLocked, markManualLock, verifyDevicePin } from '@/lib/pin'
import type { AppSection, ProfileId } from '@/lib/types'
import { formatDateTime, formatMinutes, PROFILE_LABELS, toLocalDateKey, workMinutes } from '@/lib/utils'

function RegisterPinPad({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="pin-pad" aria-label="Schnell-PIN Eingabe">
      <div className="pin-dots" aria-live="polite">
        {Array.from({ length: 6 }, (_, index) => <span key={index} className={index < value.length ? 'filled' : ''} />)}
      </div>
      <div className="pin-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button key={digit} type="button" onClick={() => value.length < 6 && onChange(`${value}${digit}`)} disabled={disabled}>{digit}</button>
        ))}
        <span />
        <button type="button" onClick={() => value.length < 6 && onChange(`${value}0`)} disabled={disabled}>0</button>
        <button type="button" className="pin-delete" onClick={() => onChange(value.slice(0, -1))} disabled={disabled || !value} aria-label="Letzte Ziffer löschen"><Delete /></button>
      </div>
    </div>
  )
}

const nav = [
  { id: 'home', label: 'Startseite', icon: Home },
  { id: 'today', label: 'Arbeitstag', icon: BriefcaseBusiness },
  { id: 'week', label: 'Wochenplan', icon: Clock3 },
  { id: 'customers', label: 'Abgeschlossene Kunden', icon: UsersRound },
  { id: 'calendar', label: 'Termine', icon: CalendarDays },
  { id: 'notifications', label: 'Benachrichtigungen', icon: Bell },
  { id: 'archive', label: 'Wochenarchiv', icon: Archive },
  { id: 'trash', label: 'Papierkorb', icon: Trash2 },
  { id: 'admin', label: 'Verwaltung', icon: Settings },
] as const satisfies ReadonlyArray<{ id: AppSection; label: string; icon: typeof Home }>

export function AppShell({ profileId, onLocked }: { profileId: ProfileId; onLocked: () => void }) {
  const { notifications, workSessions, deletedVisits, deletedCustomers, syncing, error, lastSyncAt, refresh } = useAppData()
  const [section, setSection] = useState<AppSection>(() => {
    if (typeof window === 'undefined') return 'home'
    const requested = new URLSearchParams(window.location.search).get('section') as AppSection | null
    return requested && [...nav.map((item) => item.id), 'partnerActivity'].includes(requested) ? requested : 'home'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [registerPinOpen, setRegisterPinOpen] = useState(false)
  const [registerPin, setRegisterPin] = useState('')
  const [registerPinError, setRegisterPinError] = useState<string>()
  const [registerPinBusy, setRegisterPinBusy] = useState(false)
  const [, setLiveTick] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setLiveTick((value) => value + 1), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  useModalScrollLock(sidebarOpen || registerPinOpen)

  useEffect(() => {
    if (!sidebarOpen && !registerPinOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (registerPinOpen) setRegisterPinOpen(false)
      else setSidebarOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [sidebarOpen, registerPinOpen])


  const openCount = useMemo(() => notifications.filter((item) => !item.resolvedAt && (
    item.audience === 'both' || item.audience === profileId
  )).length, [notifications, profileId])

  const activeWorkSession = useMemo(() => {
    const today = toLocalDateKey()
    return workSessions.find((item) => item.profileId === profileId && item.date === today && !item.endedAt)
  }, [workSessions, profileId])
  const workIsPaused = Boolean(activeWorkSession?.pauses.at(-1) && !activeWorkSession.pauses.at(-1)?.endedAt)
  const workIsRunning = Boolean(activeWorkSession && !workIsPaused)
  const partnerId: ProfileId = profileId === 'voss' ? 'dicke' : 'voss'
  const partnerSession = workSessions.find((item) => item.profileId === partnerId && item.date === toLocalDateKey() && !item.endedAt)
  const partnerLastPause = partnerSession?.pauses.at(-1)
  const partnerPaused = Boolean(partnerLastPause && !partnerLastPause.endedAt)
  const partnerState = partnerSession ? (partnerPaused ? 'Pause' : 'Aktiv') : 'Offline'
  const partnerMinutesToday = workSessions.filter((item) => item.profileId === partnerId && item.date === toLocalDateKey()).reduce((sum, item) => sum + workMinutes(item), 0)
  const partnerStateSince = partnerSession
    ? partnerPaused ? partnerLastPause?.startedAt : partnerLastPause?.endedAt ?? partnerSession.startedAt
    : undefined
  const partnerStatusLine = partnerStateSince
    ? `${formatMinutes(partnerMinutesToday)} · seit ${formatDateTime(partnerStateSince, { dateStyle: undefined, timeStyle: 'short' })}`
    : `${formatMinutes(partnerMinutesToday)} heute`
  const backTarget: AppSection = workIsRunning ? 'today' : 'home'
  const showBackButton = section !== 'home' && section !== backTarget

  async function lock() {
    markManualLock()
    onLocked()
  }

  async function fullLogout() {
    clearRuntimeAuthentication()
    markDeviceLocked()
    await fetch('/api/auth/company/logout', { method: 'POST' }).catch(() => undefined)
    onLocked()
  }

  function navigateDirect(next: AppSection) {
    setSection(next)
    setSidebarOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.set('section', next)
    window.history.replaceState({}, '', url)
  }

  function navigate(next: AppSection) {
    if (next === 'customers' && section !== 'customers') {
      setSidebarOpen(false)
      setRegisterPin('')
      setRegisterPinError(undefined)
      setRegisterPinOpen(true)
      return
    }
    navigateDirect(next)
  }

  async function unlockCustomerRegister() {
    if (registerPin.length !== 6 || registerPinBusy) return
    setRegisterPinBusy(true)
    setRegisterPinError(undefined)
    try {
      const result = await verifyDevicePin(profileId, registerPin)
      if (result.ok) {
        setRegisterPinOpen(false)
        setRegisterPin('')
        navigateDirect('customers')
      } else {
        setRegisterPin('')
        setRegisterPinError(result.lockedSeconds
          ? `Zu viele Versuche. PIN-Eingabe für ${Math.ceil(result.lockedSeconds / 60)} Minuten gesperrt.`
          : 'PIN ist nicht korrekt.')
      }
    } catch (error) {
      setRegisterPin('')
      setRegisterPinError(error instanceof Error ? error.message : 'PIN konnte nicht geprüft werden.')
    } finally {
      setRegisterPinBusy(false)
    }
  }

  if (error) {
    return (
      <main className="database-gate database-error">
        <Image src="/brand/vd-logo.png" width={96} height={96} alt="Voss & Dicke" priority />
        <Database />
        <h1>Datenbank nicht erreichbar</h1>
        <p>{error}</p>
        <button className="primary-button" type="button" onClick={() => void refresh()} disabled={syncing}>
          <RefreshCw className={syncing ? 'spin' : ''} /> {syncing ? 'Verbindung wird geprüft …' : 'Erneut verbinden'}
        </button>
        <button className="text-button" type="button" onClick={() => void lock()}>App sperren</button>
      </main>
    )
  }

  return (
    <div className={compact ? 'app-frame sidebar-compact' : 'app-frame'}>
      <button className="mobile-menu-button" type="button" aria-label="Menü öffnen" aria-expanded={sidebarOpen} aria-controls="fieldops-sidebar" onClick={() => setSidebarOpen(true)}><Menu /></button>
      {showBackButton && (
        <button className="global-back-button" type="button" aria-label={backTarget === 'today' ? 'Zurück zum Arbeitstag' : 'Zurück zur Startseite'} onClick={() => navigate(backTarget)}>
          <ChevronLeft /><span>Zurück</span>
        </button>
      )}
      {sidebarOpen && <button type="button" className="sidebar-scrim" aria-label="Menü schließen" onClick={() => setSidebarOpen(false)} />}
      <aside id="fieldops-sidebar" className={sidebarOpen ? 'app-sidebar open' : 'app-sidebar'}>
        <div className="sidebar-brand">
          <Image src="/brand/vd-logo.png" width={58} height={58} alt="Voss & Dicke" priority />
          <div><strong>FieldOps</strong><small>Voss & Dicke GbR</small></div>
          <button className="mobile-close" type="button" aria-label="Menü schließen" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSidebarOpen(false) }}><X /></button>
        </div>
        <nav className="sidebar-nav" aria-label="Hauptnavigation">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} type="button" className={section === item.id ? 'active' : ''} onClick={() => navigate(item.id)} title={item.label}>
                <Icon /><span>{item.label}</span>
                {item.id === 'notifications' && openCount > 0 && <b>{openCount}</b>}
                {item.id === 'trash' && (deletedVisits.length + deletedCustomers.length) > 0 && <b>{deletedVisits.length + deletedCustomers.length}</b>}
              </button>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <button className={`partner-live-card ${partnerState.toLowerCase()}`} type="button" onClick={() => navigate('partnerActivity')} title={`Live-Ticker von ${PROFILE_LABELS[partnerId]}`}>
            <span className="partner-live-card-dot" />
            <div><small>Partner live</small><strong>{PROFILE_LABELS[partnerId]} · {partnerState}</strong><em>{partnerStatusLine}</em></div>
            {partnerPaused ? <Coffee /> : <Clock3 />}
          </button>
          <div className="database-sync-state" title={lastSyncAt ? `Letzte Synchronisierung: ${formatDateTime(lastSyncAt)}` : 'Datenbank verbunden'}>
            {syncing ? <RefreshCw className="spin" /> : <CheckCircle2 />}
            <div><strong>{syncing ? 'Synchronisiert …' : 'Datenbank verbunden'}</strong><small>{lastSyncAt ? `Stand ${formatDateTime(lastSyncAt, { dateStyle: undefined, timeStyle: 'short' })}` : 'Geschützte Verbindung'}</small></div>
          </div>
          <PwaTools />
          <div className="sidebar-legal-links"><a href="/datenschutz" target="_blank" rel="noreferrer">Datenschutz</a><a href="/impressum" target="_blank" rel="noreferrer">Impressum</a></div>
          <div className="signed-profile"><span>{profileId === 'voss' ? 'V' : 'D'}</span><div><small>Angemeldet als</small><strong>{PROFILE_LABELS[profileId]}</strong></div></div>
          <div className="sidebar-actions">
            <button type="button" onClick={() => void lock()}><LockKeyhole /><span>App sperren</span></button>
            <button type="button" onClick={() => void fullLogout()}><ChevronLeft /><span>Abmelden</span></button>
          </div>
          <button className="compact-toggle" type="button" onClick={() => setCompact((value) => !value)}>{compact ? <PanelLeftOpen /> : <PanelLeftClose />}<span>Menü einklappen</span></button>
        </div>
      </aside>

      {registerPinOpen && (
        <div className="modal-backdrop register-pin-backdrop" role="dialog" aria-modal="true" aria-labelledby="register-pin-title">
          <section className="modal-card pin-card register-pin-card">
            <button className="icon-button register-pin-close" type="button" aria-label="Schließen" onClick={() => { setRegisterPinOpen(false); setRegisterPin(''); setRegisterPinError(undefined) }}><X /></button>
            <LockKeyhole className="register-pin-icon" />
            <span className="eyebrow">Geschützter Bereich</span>
            <h2 id="register-pin-title">Kundenregister öffnen</h2>
            <p className="muted">Gib deinen persönlichen 6-stelligen Schnell-PIN ein.</p>
            <RegisterPinPad value={registerPin} onChange={setRegisterPin} disabled={registerPinBusy} />
            {registerPinError && <p className="form-error">{registerPinError}</p>}
            <button className="primary-button" type="button" onClick={() => void unlockCustomerRegister()} disabled={registerPinBusy || registerPin.length !== 6}>
              <ShieldCheck /> {registerPinBusy ? 'Wird geprüft …' : 'Kundenregister öffnen'}
            </button>
          </section>
        </div>
      )}

      <NotificationWatcher profileId={profileId} onNavigate={navigate} />
      <main className="app-main">
        {section === 'home' && <HomeSection profileId={profileId} onNavigate={navigate} />}
        {section === 'today' && <TodaySection profileId={profileId} />}
        {section === 'week' && <WeekSection profileId={profileId} />}
        {section === 'customers' && <CustomersSection profileId={profileId} />}
        {section === 'calendar' && <CalendarSection profileId={profileId} />}
        {section === 'notifications' && <NotificationsSection profileId={profileId} onNavigate={navigate} />}
        {section === 'archive' && <ArchiveSection profileId={profileId} />}
        {section === 'trash' && <TrashSection />}
        {section === 'partnerActivity' && <PartnerActivitySection profileId={profileId} />}
        {section === 'admin' && <AdminSection />}
      </main>
    </div>
  )
}
