'use client'

import { useEffect, useState } from 'react'
import { BellRing, Download, Share } from 'lucide-react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0))
}

export function PwaTools() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [standalone, setStandalone] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setStandalone(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
      setPermission('Notification' in window ? Notification.permission : 'unsupported')
      void navigator.serviceWorker?.register('/service-worker.js').catch(() => undefined)
    }, 0)
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => { window.clearTimeout(initial); window.removeEventListener('beforeinstallprompt', handler) }
  }, [])

  async function install() {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      if (installPrompt) {
        await installPrompt.prompt()
        await installPrompt.userChoice
        setInstallPrompt(null)
        return
      }
      if (ios) alert('Auf dem iPhone: Teilen-Symbol antippen und „Zum Home-Bildschirm“ wählen.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Installation konnte nicht gestartet werden.')
    } finally {
      setBusy(false)
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window) || busy) return
    setBusy(true); setMessage('')
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') {
        setMessage('Pop-ups wurden im Browser nicht freigegeben.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (vapid) {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid),
        })
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })
        if (!response.ok) throw new Error('Push-Anmeldung konnte nicht gespeichert werden.')
      }
      new Notification('Benachrichtigungen aktiviert', {
        body: 'Termine und Wiedervorlagen erscheinen künftig auch als Pop-up.',
        icon: '/icons/icon-192.png',
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Pop-ups konnten nicht aktiviert werden.')
    } finally {
      setBusy(false)
    }
  }

  if (standalone && permission === 'granted') return null

  return (
    <div className="pwa-tools">
      {!standalone && (installPrompt || ios) && (
        <button type="button" disabled={busy} onClick={() => void install()}><Download /> {busy ? 'Bitte warten …' : 'App installieren'}</button>
      )}
      {permission !== 'granted' && permission !== 'unsupported' && (
        <button type="button" disabled={busy} onClick={() => void enableNotifications()}><BellRing /> {busy ? 'Bitte warten …' : 'Pop-ups aktivieren'}</button>
      )}
      {ios && !standalone && !installPrompt && <span><Share /> Teilen → Zum Home-Bildschirm</span>}
      {message && <small className="pwa-tool-message">{message}</small>}
    </div>
  )
}
