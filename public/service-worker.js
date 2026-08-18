const CACHE = 'vd-fieldops-v8-online-signature'
const SHELL = ['/', '/brand/vd-logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && ['style', 'script', 'image', 'font'].includes(request.destination)) {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
      }
      return response
    })),
  )
})

self.addEventListener('push', (event) => {
  // Auf dem Sperrbildschirm werden absichtlich keine Kunden-, Adress- oder Vertragsdaten angezeigt.
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = {} }
  event.waitUntil(self.registration.showNotification('Voss & Dicke FieldOps', {
    body: 'Neue geschützte Benachrichtigung. App öffnen, um Details anzuzeigen.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'vd-notification',
    data: { url: payload.url || '/?section=notifications' },
    renotify: true,
    actions: [{ action: 'open', title: 'Sicher öffnen' }],
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/?section=notifications'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => 'focus' in client)
      if (existing) {
        existing.navigate(url)
        return existing.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
