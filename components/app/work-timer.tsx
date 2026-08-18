'use client'

import { useEffect, useMemo, useState } from 'react'
import { Coffee, Play, Square } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import type { ProfileId } from '@/lib/types'
import { formatMinutes, toLocalDateKey, workMinutes } from '@/lib/utils'

export function WorkTimer({ profileId }: { profileId: ProfileId }) {
  const { workSessions, startWork, togglePause, endWork } = useAppData()
  const [, tick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const today = toLocalDateKey()
  const session = useMemo(() => workSessions.find((item) => item.profileId === profileId && item.date === today && !item.endedAt), [workSessions, profileId, today])
  const paused = Boolean(session?.pauses.at(-1) && !session.pauses.at(-1)?.endedAt)

  useEffect(() => {
    if (!session) return
    const interval = window.setInterval(() => tick((value) => value + 1), 30_000)
    return () => window.clearInterval(interval)
  }, [session])

  useEffect(() => {
    if (!session || paused) return
    const check = () => {
      const berlin = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
      const [hour, minute] = berlin.split(':').map(Number)
      if (hour < 20) return
      const marker = `vd_work_reminder_${profileId}_${today}_${hour}_${Math.floor(minute / 15)}`
      if (localStorage.getItem(marker)) return
      localStorage.setItem(marker, '1')
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Deine Arbeitszeit läuft noch', {
          body: 'Arbeitszeit beenden oder „Heute länger arbeiten“ wählen.',
          icon: '/icons/icon-192.png',
          tag: `worktime-${profileId}`,
        })
      }
    }
    check()
    const interval = window.setInterval(check, 60_000)
    return () => window.clearInterval(interval)
  }, [session, paused, profileId, today])

  async function run(action: () => Promise<unknown>) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Arbeitszeit konnte nicht aktualisiert werden.')
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <div className="work-timer-wrap">
        <button className="work-timer start" type="button" disabled={busy} onClick={() => void run(() => startWork(profileId))}>
          <Play />
          <span><small>Arbeitszeit</small><strong>{busy ? 'Wird gestartet …' : 'Arbeitstag starten'}</strong></span>
        </button>
        {error && <small className="work-timer-error">{error}</small>}
      </div>
    )
  }

  return (
    <div className="work-timer-wrap">
      <div className={paused ? 'work-timer running paused' : 'work-timer running'}>
        <div className="work-clock"><span className="pulse-dot" /><div><small>{paused ? 'Pause seit' : 'Arbeitszeit läuft'}</small><strong>{formatMinutes(workMinutes(session))}</strong></div></div>
        <div className="work-actions">
          <button type="button" disabled={busy} onClick={() => void run(() => togglePause(session.id))}>{paused ? <><Play /> Weiter</> : <><Coffee /> Pause</>}</button>
          <button type="button" className="danger-light" disabled={busy} onClick={() => void run(() => endWork(session.id))}><Square /> {busy ? 'Speichert …' : 'Beenden'}</button>
        </div>
      </div>
      {error && <small className="work-timer-error">{error}</small>}
    </div>
  )
}
