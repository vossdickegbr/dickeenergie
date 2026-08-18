'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AddressVisit,
  AppSnapshot,
  Appointment,
  Customer,
  DayNote,
  NotificationItem,
  ProfileId,
  WeekArchive,
  WorkSession,
} from '@/lib/types'
import { emptySnapshot } from '@/lib/records'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { makeId, nowIso, toLocalDateKey } from '@/lib/utils'

interface AppDataContextValue extends AppSnapshot {
  ready: boolean
  syncing: boolean
  lastSyncAt?: string
  error?: string
  refresh: () => Promise<void>
  saveVisit: (visit: Omit<AddressVisit, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<AddressVisit>
  deleteVisit: (id: string) => Promise<void>
  restoreDeletedVisit: (id: string) => Promise<void>
  purgeDeletedVisit: (id: string) => Promise<void>
  saveCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Customer>
  saveCustomerPrivacy: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'privacyReceipt'> & { id?: string }, signatureDataUrl?: string) => Promise<Customer>
  finalizeOnlineCustomerIntake: (id: string) => Promise<Customer>
  resendPrivacyEmail: (id: string) => Promise<void>
  renewCustomer: (id: string, followUpAt: string, serviceType?: Customer['serviceType']) => Promise<void>
  trashCustomer: (id: string, reason?: 'manual' | 'service_ended' | 'follow_up_expired' | 'incomplete_intake') => Promise<void>
  restoreDeletedCustomer: (id: string) => Promise<void>
  purgeDeletedCustomer: (id: string) => Promise<void>
  cancelCustomer: (id: string, cancellation: NonNullable<Customer['cancellation']>) => Promise<void>
  saveAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Appointment>
  saveNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<NotificationItem>
  acknowledgeNotification: (id: string, profileId: ProfileId) => Promise<void>
  startWork: (profileId: ProfileId) => Promise<WorkSession>
  togglePause: (sessionId: string) => Promise<void>
  endWork: (sessionId: string) => Promise<void>
  saveDayNote: (note: DayNote) => Promise<void>
  saveArchive: (archive: WeekArchive) => Promise<void>
}

const AppDataContext = createContext<AppDataContextValue | null>(null)


type SnapshotUpdater = AppSnapshot | ((current: AppSnapshot) => AppSnapshot)

type PendingHiddenRecords = {
  visits: Set<string>
  customers: Set<string>
  deletedVisits: Set<string>
  deletedCustomers: Set<string>
}

function applyPendingVisibility(snapshot: AppSnapshot, pending: PendingHiddenRecords): AppSnapshot {
  const reconcile = <T extends { id: string }>(items: T[], ids: Set<string>) => {
    for (const id of [...ids]) {
      if (!items.some((item) => item.id === id)) ids.delete(id)
    }
    return items.filter((item) => !ids.has(item.id))
  }

  return {
    ...snapshot,
    visits: reconcile(snapshot.visits, pending.visits),
    customers: reconcile(snapshot.customers, pending.customers),
    deletedVisits: reconcile(snapshot.deletedVisits, pending.deletedVisits),
    deletedCustomers: reconcile(snapshot.deletedCustomers, pending.deletedCustomers),
  }
}

/**
 * Vergleicht nur IDs und Änderungszeitpunkte. Dadurch müssen große Zeichnungen
 * und PDF-Metadaten nicht bei jeder Hintergrund-Synchronisierung serialisiert werden.
 */
function snapshotRevision(snapshot: AppSnapshot) {
  const versioned = <T extends { id: string; updatedAt: string }>(items: T[]) => items.map((item) => `${item.id}:${item.updatedAt}`).join(',')
  return [
    versioned(snapshot.visits),
    versioned(snapshot.customers),
    versioned(snapshot.appointments),
    versioned(snapshot.notifications),
    versioned(snapshot.workSessions),
    versioned(snapshot.dayNotes),
    snapshot.archives.map((item) => `${item.id}:${item.archivedAt}:${item.report?.sentAt ?? ''}`).join(','),
    versioned(snapshot.deletedVisits),
    versioned(snapshot.deletedCustomers),
    versioned(snapshot.onlineCustomerIntakes),
  ].join('|')
}

async function postAction<T>(action: string, payload?: unknown): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = action === 'saveCustomerPrivacy' ? 90_000 : 30_000
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch('/api/data/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({ ok: false, error: `Serverfehler (${response.status})` })) as { ok: boolean; result?: T; error?: string }
    if (!response.ok || !result.ok) throw new Error(result.error ?? 'Speichern fehlgeschlagen.')
    return result.result as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Der Speichervorgang dauert zu lange. Bitte die Kundenliste kurz aktualisieren; die Aufnahme kann bereits gespeichert worden sein.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const initialSnapshot = useMemo(() => emptySnapshot(), [])
  const [snapshot, setSnapshot] = useState<AppSnapshot>(initialSnapshot)
  const [ready, setReady] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string>()
  const [error, setError] = useState<string>()
  const mounted = useRef(true)
  const readyRef = useRef(false)
  const snapshotRef = useRef<AppSnapshot>(initialSnapshot)
  const snapshotRevisionRef = useRef(snapshotRevision(initialSnapshot))
  const refreshPromiseRef = useRef<Promise<void> | null>(null)
  const refreshQueuedRef = useRef(false)
  const pendingHiddenRef = useRef<PendingHiddenRecords>({
    visits: new Set(),
    customers: new Set(),
    deletedVisits: new Set(),
    deletedCustomers: new Set(),
  })

  const updateSnapshot = useCallback((updater: SnapshotUpdater) => {
    setSnapshot((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      snapshotRef.current = next
      snapshotRevisionRef.current = snapshotRevision(next)
      return next
    })
  }, [])

  useEffect(() => {
    readyRef.current = ready
  }, [ready])

  useEffect(() => () => { mounted.current = false }, [])

  const performRefresh = useCallback(async function runRefresh(silent: boolean): Promise<void> {
    if (refreshPromiseRef.current) {
      refreshQueuedRef.current = true
      await refreshPromiseRef.current
      return
    }

    const request = (async () => {
      if (!silent && mounted.current) setSyncing(true)
      try {
        const response = await fetch('/api/data/snapshot', { cache: 'no-store' })
        const result = await response.json() as { ok: boolean; snapshot?: AppSnapshot; error?: string }
        if (!response.ok || !result.ok || !result.snapshot) throw new Error(result.error ?? 'Datenbank konnte nicht geladen werden.')
        if (!mounted.current) return

        const next = applyPendingVisibility(result.snapshot, pendingHiddenRef.current)
        const changed = snapshotRevision(next) !== snapshotRevisionRef.current
        if (changed) updateSnapshot(next)
        if (changed || !readyRef.current) setLastSyncAt(nowIso())
        setError(undefined)
        if (!readyRef.current) {
          readyRef.current = true
          setReady(true)
        }
      } catch (caught) {
        if (!mounted.current) return
        // Nach dem ersten erfolgreichen Laden bleibt der letzte sichere Stand sichtbar.
        // Ein kurzer Netz-Aussetzer darf die laufende App nicht auf eine Fehlerseite werfen.
        if (!readyRef.current) {
          setError(caught instanceof Error ? caught.message : 'Datenbank konnte nicht geladen werden.')
          readyRef.current = true
          setReady(true)
        }
      } finally {
        if (!silent && mounted.current) setSyncing(false)
      }
    })()

    refreshPromiseRef.current = request
    try {
      await request
    } finally {
      refreshPromiseRef.current = null
      if (refreshQueuedRef.current && mounted.current) {
        refreshQueuedRef.current = false
        await runRefresh(true)
      }
    }
  }, [updateSnapshot])

  const refresh = useCallback(() => performRefresh(false), [performRefresh])
  const refreshSilently = useCallback(() => performRefresh(true), [performRefresh])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshSilently()
    }, 60_000)
    const onFocus = () => void refreshSilently()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshSilently()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh, refreshSilently])

  useEffect(() => {
    const client = createSupabaseBrowserClient()
    if (!client) return
    let realtimeTimer: number | undefined
    const channel = client
      .channel('fieldops-shared-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_records' }, () => {
        window.clearTimeout(realtimeTimer)
        realtimeTimer = window.setTimeout(() => void refreshSilently(), 180)
      })
      .subscribe()
    return () => {
      window.clearTimeout(realtimeTimer)
      void client.removeChannel(channel)
    }
  }, [refreshSilently])

  const saveVisit = useCallback<AppDataContextValue['saveVisit']>(async (input) => {
    const timestamp = nowIso()
    const existing = snapshotRef.current.visits.find((item) => item.id === input.id)
    const optimistic: AddressVisit = {
      ...input,
      id: input.id ?? makeId('visit'),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }
    updateSnapshot((current) => ({ ...current, visits: [...current.visits.filter((item) => item.id !== optimistic.id), optimistic] }))
    try {
      const saved = await postAction<AddressVisit>('saveVisit', optimistic)
      updateSnapshot((current) => ({ ...current, visits: [...current.visits.filter((item) => item.id !== saved.id), saved] }))
      return saved
    } catch (caught) {
      await refreshSilently()
      throw caught
    }
  }, [refreshSilently, updateSnapshot])

  const deleteVisit = useCallback<AppDataContextValue['deleteVisit']>(async (id) => {
    pendingHiddenRef.current.visits.add(id)
    updateSnapshot((current) => ({ ...current, visits: current.visits.filter((item) => item.id !== id) }))
    try {
      await postAction('trashVisit', { id })
      await refreshSilently()
    } catch (caught) {
      pendingHiddenRef.current.visits.delete(id)
      await refreshSilently()
      throw caught
    }
  }, [refreshSilently, updateSnapshot])

  const restoreDeletedVisit = useCallback<AppDataContextValue['restoreDeletedVisit']>(async (id) => {
    pendingHiddenRef.current.deletedVisits.add(id)
    updateSnapshot((current) => ({ ...current, deletedVisits: current.deletedVisits.filter((item) => item.id !== id) }))
    try {
      await postAction('restoreVisit', { id })
      await refreshSilently()
    } catch (caught) {
      pendingHiddenRef.current.deletedVisits.delete(id)
      await refreshSilently()
      throw caught
    }
  }, [refreshSilently, updateSnapshot])

  const purgeDeletedVisit = useCallback<AppDataContextValue['purgeDeletedVisit']>(async (id) => {
    pendingHiddenRef.current.deletedVisits.add(id)
    updateSnapshot((current) => ({ ...current, deletedVisits: current.deletedVisits.filter((item) => item.id !== id) }))
    try {
      await postAction('purgeVisit', { id })
      await refreshSilently()
    } catch (caught) {
      pendingHiddenRef.current.deletedVisits.delete(id)
      await refreshSilently()
      throw caught
    }
  }, [refreshSilently, updateSnapshot])

  const saveCustomer = useCallback<AppDataContextValue['saveCustomer']>(async (input) => {
    const timestamp = nowIso()
    const existing = snapshotRef.current.customers.find((item) => item.id === input.id)
    const saved = await postAction<Customer>('saveCustomer', {
      ...input,
      id: input.id ?? makeId('customer'),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    })
    updateSnapshot((current) => ({ ...current, customers: [...current.customers.filter((item) => item.id !== saved.id), saved] }))
    return saved
  }, [updateSnapshot])

  const saveCustomerPrivacy = useCallback<AppDataContextValue['saveCustomerPrivacy']>(async (input, signatureDataUrl) => {
    const saved = await postAction<Customer>('saveCustomerPrivacy', {
      customer: { ...input, id: input.id ?? makeId('customer'), createdAt: nowIso(), updatedAt: nowIso() },
      signatureDataUrl,
      acknowledgementAccepted: true,
    })
    updateSnapshot((current) => ({ ...current, customers: [...current.customers.filter((item) => item.id !== saved.id), saved] }))
    // PDF und privater Speicher werden serverseitig nachgelagert fertiggestellt; die Datenschutz-PDF wird nicht automatisch versendet.
    // Die Oberfläche darf deshalb sofort schließen und synchronisiert anschließend still.
    window.setTimeout(() => void refreshSilently(), 1_500)
    return saved
  }, [refreshSilently, updateSnapshot])

  const finalizeOnlineCustomerIntake = useCallback<AppDataContextValue['finalizeOnlineCustomerIntake']>(async (id) => {
    const saved = await postAction<Customer>('finalizeOnlineCustomerIntake', { id })
    updateSnapshot((current) => ({
      ...current,
      customers: [...current.customers.filter((item) => item.id !== saved.id), saved],
      onlineCustomerIntakes: current.onlineCustomerIntakes.map((item) => (
        item.id === id ? { ...item, status: 'finalized', finalizedAt: nowIso(), finalCustomerId: saved.id } : item
      )),
    }))
    await refreshSilently()
    return saved
  }, [refreshSilently, updateSnapshot])

  const resendPrivacyEmail = useCallback<AppDataContextValue['resendPrivacyEmail']>(async (id) => {
    await postAction('resendPrivacyEmail', { id })
    await refreshSilently()
  }, [refreshSilently])

  const renewCustomer = useCallback<AppDataContextValue['renewCustomer']>(async (id, followUpAt, serviceType) => {
    await postAction('renewCustomer', { id, followUpAt, serviceType })
    await refreshSilently()
  }, [refreshSilently])

  const trashCustomer = useCallback<AppDataContextValue['trashCustomer']>(async (id, reason) => {
    pendingHiddenRef.current.customers.add(id)
    updateSnapshot((current) => ({ ...current, customers: current.customers.filter((item) => item.id !== id) }))
    try {
      await postAction('trashCustomer', { id, reason })
      await refreshSilently()
    } catch (caught) {
      pendingHiddenRef.current.customers.delete(id)
      await refreshSilently()
      throw caught
    }
  }, [refreshSilently, updateSnapshot])

  const restoreDeletedCustomer = useCallback<AppDataContextValue['restoreDeletedCustomer']>(async (id) => {
    pendingHiddenRef.current.deletedCustomers.add(id)
    updateSnapshot((current) => ({ ...current, deletedCustomers: current.deletedCustomers.filter((item) => item.id !== id) }))
    try {
      await postAction('restoreCustomer', { id })
      await refreshSilently()
    } catch (caught) {
      pendingHiddenRef.current.deletedCustomers.delete(id)
      await refreshSilently()
      throw caught
    }
  }, [refreshSilently, updateSnapshot])

  const purgeDeletedCustomer = useCallback<AppDataContextValue['purgeDeletedCustomer']>(async (id) => {
    pendingHiddenRef.current.deletedCustomers.add(id)
    updateSnapshot((current) => ({ ...current, deletedCustomers: current.deletedCustomers.filter((item) => item.id !== id) }))
    try {
      await postAction('purgeCustomer', { id })
      await refreshSilently()
    } catch (caught) {
      pendingHiddenRef.current.deletedCustomers.delete(id)
      await refreshSilently()
      throw caught
    }
  }, [refreshSilently, updateSnapshot])

  const cancelCustomer = useCallback<AppDataContextValue['cancelCustomer']>(async (id, cancellation) => {
    await postAction('cancelCustomer', { id, cancellation })
    await refreshSilently()
  }, [refreshSilently])

  const saveAppointment = useCallback<AppDataContextValue['saveAppointment']>(async (input) => {
    const timestamp = nowIso()
    const existing = snapshotRef.current.appointments.find((item) => item.id === input.id)
    const saved = await postAction<Appointment>('saveAppointment', {
      ...input,
      id: input.id ?? makeId('appointment'),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    })
    updateSnapshot((current) => ({ ...current, appointments: [...current.appointments.filter((item) => item.id !== saved.id), saved] }))
    window.setTimeout(() => void refreshSilently(), 500)
    return saved
  }, [refreshSilently, updateSnapshot])

  const saveNotification = useCallback<AppDataContextValue['saveNotification']>(async (input) => {
    const timestamp = nowIso()
    const existing = snapshotRef.current.notifications.find((item) => item.id === input.id)
    const saved = await postAction<NotificationItem>('saveNotification', {
      ...input,
      id: input.id ?? makeId('notification'),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    })
    updateSnapshot((current) => ({ ...current, notifications: [...current.notifications.filter((item) => item.id !== saved.id), saved] }))
    return saved
  }, [updateSnapshot])

  const acknowledgeNotification = useCallback<AppDataContextValue['acknowledgeNotification']>(async (id) => {
    await postAction('acknowledgeNotification', { id })
    await refreshSilently()
  }, [refreshSilently])

  const startWork = useCallback<AppDataContextValue['startWork']>(async () => {
    const session = await postAction<WorkSession>('startWork', { date: toLocalDateKey() })
    await refreshSilently()
    return session
  }, [refreshSilently])

  const togglePause = useCallback<AppDataContextValue['togglePause']>(async (sessionId) => {
    await postAction('togglePause', { id: sessionId })
    await refreshSilently()
  }, [refreshSilently])

  const endWork = useCallback<AppDataContextValue['endWork']>(async (sessionId) => {
    await postAction('endWork', { id: sessionId })
    await refreshSilently()
  }, [refreshSilently])

  const saveDayNote = useCallback<AppDataContextValue['saveDayNote']>(async (note) => {
    await postAction('saveDayNote', note)
    await refreshSilently()
  }, [refreshSilently])

  const saveArchive = useCallback<AppDataContextValue['saveArchive']>(async (archive) => {
    await postAction('saveArchive', archive)
    await refreshSilently()
  }, [refreshSilently])

  const value = useMemo<AppDataContextValue>(() => ({
    ...snapshot,
    ready,
    syncing,
    lastSyncAt,
    error,
    refresh,
    saveVisit,
    deleteVisit,
    restoreDeletedVisit,
    purgeDeletedVisit,
    saveCustomer,
    saveCustomerPrivacy,
    finalizeOnlineCustomerIntake,
    resendPrivacyEmail,
    renewCustomer,
    trashCustomer,
    restoreDeletedCustomer,
    purgeDeletedCustomer,
    cancelCustomer,
    saveAppointment,
    saveNotification,
    acknowledgeNotification,
    startWork,
    togglePause,
    endWork,
    saveDayNote,
    saveArchive,
  }), [snapshot, ready, syncing, lastSyncAt, error, refresh, saveVisit, deleteVisit, restoreDeletedVisit, purgeDeletedVisit, saveCustomer, saveCustomerPrivacy, finalizeOnlineCustomerIntake, resendPrivacyEmail, renewCustomer, trashCustomer, restoreDeletedCustomer, purgeDeletedCustomer, cancelCustomer, saveAppointment, saveNotification, acknowledgeNotification, startWork, togglePause, endWork, saveDayNote, saveArchive])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData must be used inside AppDataProvider')
  return value
}
