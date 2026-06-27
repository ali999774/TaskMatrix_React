// TODO(pwa): migrate to vite-plugin-pwa (Workbox) for durable cache versioning + precache manifest
const CACHE_NAME = 'taskmatrix-react-v6'

// App shell assets to pre-cache on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
]

// --- LIFECYCLE ---

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell')
      return Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] Failed to cache:', url, err))
        )
      )
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      ),
      self.clients.claim(),
    ])
  )
})

// --- FETCH STRATEGIES ---

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Supabase API: network-first, return JSON error offline
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request.clone()).catch(() =>
        new Response(
          JSON.stringify({
            error: 'Offline',
            message: 'Your changes will sync when you are back online.',
            status: 503,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    )
    return
  }

  // Navigation: network-first (always get latest deployment), cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME)
        try {
          const networkResponse = await fetch(event.request)
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone())
          }
          return networkResponse
        } catch {
          const cached = await cache.match(event.request) || await cache.match('/')
          if (cached) return cached
          // Truly offline, no cache — minimal fallback page
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>TaskMatrix — Offline</title></head>' +
            '<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;">' +
            '<div style="text-align:center;color:#374151;"><div style="font-size:48px;margin-bottom:16px;">📊</div>' +
            '<h2 style="margin-bottom:8px;">TaskMatrix is offline</h2>' +
            '<p style="color:#6b7280;">Reconnect to load your tasks.</p></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          )
        }
      })()
    )
    return
  }

  // Everything else: cache-first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            const toCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache))
          }
          return networkResponse
        })
        .catch(() => new Response('', { status: 503, statusText: 'Offline' }))
    })
  )
})
