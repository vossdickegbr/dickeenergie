'use client'

import { useMemo, useState } from 'react'
import { Bell, Check, CheckCheck, ChevronRight, Clock3, History, UserCheck } from 'lucide-react'
import { useAppData } from '@/components/app/app-provider'
import type { AppSection, NotificationItem, ProfileId } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

function linkedSection(item: NotificationItem): AppSection {
  if (item.linkedType === 'appointment') return 'calendar'
  if (item.linkedType === 'customer') return 'customers'
  if (item.linkedType === 'day' || item.linkedType === 'week') return 'week'
  return 'notifications'
}

export function NotificationsSection({ profileId, onNavigate }: { profileId: ProfileId; onNavigate: (section: AppSection) => void }) {
  const { notifications, acknowledgeNotification } = useAppData()
  const [tab, setTab] = useState<'open' | 'history'>('open')
  const [busyId, setBusyId] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const relevant = useMemo(() => notifications.filter((item) => item.audience === 'both' || item.audience === profileId).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)), [notifications, profileId])
  const open = relevant.filter((item) => !item.resolvedAt)
  const history = relevant.filter((item) => item.resolvedAt)
  const list = tab === 'open' ? open : history


  async function acknowledge(item: NotificationItem) {
    if (busyId) return
    setBusyId(item.id); setNotice(undefined)
    try {
      await acknowledgeNotification(item.id, profileId)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Benachrichtigung konnte nicht bestätigt werden.')
    } finally {
      setBusyId(undefined)
    }
  }

  function openLinked(item: NotificationItem) {
    if (item.linkedId) {
      const url = new URL(window.location.href)
      url.searchParams.set('open', item.linkedId)
      window.history.replaceState({}, '', url)
    }
    const section = linkedSection(item)
    onNavigate(section)
    if (item.linkedId) {
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('vd:open-linked', { detail: { type: item.linkedType, id: item.linkedId } })), 0)
    }
  }

  return (
    <div className="page-shell notifications-page">
      <header className="page-topbar"><div><span className="eyebrow">Popup + interner Verlauf</span><h1>Benachrichtigungen</h1><p>Details bleiben verborgen, bis der zugehörige Termin oder Datensatz geöffnet wird.</p></div></header>
      {notice && <p className="form-error">{notice}</p>}
      <div className="notification-tabs"><button type="button" className={tab === 'open' ? 'active' : ''} onClick={() => setTab('open')}><Bell /> Offen <b>{open.length}</b></button><button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History /> Verlauf <b>{history.length}</b></button></div>
      <section className="notification-list">
        {list.map((item) => {
          const ownAck = profileId === 'voss' ? item.ackVossAt : item.ackDickeAt
          return <article key={item.id} className={item.resolvedAt ? 'resolved' : ''}><span className="notification-type"><Bell /></span><button type="button" className="notification-copy" onClick={() => openLinked(item)}><strong>{item.title}</strong><p>{item.summary}</p><small><Clock3 /> {formatDateTime(item.scheduledAt)}</small></button><div className="ack-state">{(item.audience === 'both' || item.audience === 'voss') && <span className={item.ackVossAt ? 'done' : ''}><UserCheck /> Voss {item.ackVossAt ? formatDateTime(item.ackVossAt, { dateStyle: 'short', timeStyle: 'short' }) : 'offen'}</span>}{(item.audience === 'both' || item.audience === 'dicke') && <span className={item.ackDickeAt ? 'done' : ''}><UserCheck /> Dicke {item.ackDickeAt ? formatDateTime(item.ackDickeAt, { dateStyle: 'short', timeStyle: 'short' }) : 'offen'}</span>}</div>{!item.resolvedAt && !ownAck ? <button type="button" className="ack-button" disabled={busyId === item.id} onClick={() => void acknowledge(item)}><Check /> {busyId === item.id ? 'Speichert …' : 'Gesehen'}</button> : <button type="button" className="open-linked" onClick={() => openLinked(item)}>{item.resolvedAt ? <CheckCheck /> : <ChevronRight />}</button>}</article>
        })}
        {!list.length && <div className="large-empty"><CheckCheck /><h2>{tab === 'open' ? 'Alles bestätigt' : 'Noch kein Verlauf'}</h2><p>{tab === 'open' ? 'Aktuell wartet keine Benachrichtigung auf deine Bestätigung.' : 'Bestätigte Meldungen bleiben hier mit Datum erhalten.'}</p></div>}
      </section>
      <p className="notification-rule"><strong>Regel:</strong> Gemeinsame Meldungen verschwinden erst aus „Offen“, wenn Herr Voss und Herr Dicke jeweils bestätigt haben. Der Verlauf bleibt erhalten.</p>
    </div>
  )
}
