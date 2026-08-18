'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, X } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import type { AppSection, NotificationItem, ProfileId } from '@/lib/types'

export function NotificationWatcher({ profileId, onNavigate }: { profileId: ProfileId; onNavigate: (section: AppSection) => void }) {
  const { notifications, acknowledgeNotification } = useAppData()
  const [visible, setVisible] = useState<NotificationItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const candidates = useMemo(() => notifications.filter((item) => !item.resolvedAt && (item.audience === 'both' || item.audience === profileId)), [notifications, profileId])

  useEffect(() => {
    const check = () => {
      const now = Date.now()
      const due = candidates.find((item) => {
        const ownAck = profileId === 'voss' ? item.ackVossAt : item.ackDickeAt
        if (ownAck) return false
        const scheduled = new Date(item.scheduledAt).getTime()
        const reminderKey = `vd_popup_${item.id}_${profileId}_${Math.floor(now / (15 * 60_000))}`
        if (scheduled > now + 60_000 || localStorage.getItem(reminderKey)) return false
        localStorage.setItem(reminderKey, '1')
        return true
      })
      if (!due) return
      setVisible(due)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(due.title, { body: due.summary, icon: '/icons/icon-192.png', tag: due.id, data: { url: '/?section=notifications' } })
      }
    }
    check()
    const interval = window.setInterval(check, 60_000)
    return () => window.clearInterval(interval)
  }, [candidates, profileId])

  if (!visible) return null
  const section: AppSection = visible.linkedType === 'appointment' ? 'calendar' : visible.linkedType === 'customer' ? 'customers' : visible.linkedType === 'day' || visible.linkedType === 'week' ? 'week' : 'notifications'
  const acknowledgeVisible = async () => {
    if (!visible || busy) return
    setBusy(true); setError('')
    try {
      await acknowledgeNotification(visible.id, profileId)
      setVisible(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bestätigung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }
  const openLinked = () => {
    if (visible.linkedId) {
      const url = new URL(window.location.href)
      url.searchParams.set('open', visible.linkedId)
      window.history.replaceState({}, '', url)
    }
    onNavigate(section)
    if (visible.linkedId) {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('vd:open-linked', { detail: { type: visible.linkedType, id: visible.linkedId } })), 0)
    }
    setVisible(null)
  }
  return <div className="in-app-popup"><span><Bell /></span><div><small>Neue Benachrichtigung</small><strong>{visible.title}</strong><p>{visible.summary}</p>{error && <em className="popup-error">{error}</em>}<div><button type="button" disabled={busy} onClick={openLinked}>Öffnen</button><button type="button" disabled={busy} onClick={() => void acknowledgeVisible()}><Check /> {busy ? 'Speichert …' : 'Gesehen'}</button></div></div><button type="button" className="popup-close" disabled={busy} onClick={() => setVisible(null)}><X /></button></div>
}
