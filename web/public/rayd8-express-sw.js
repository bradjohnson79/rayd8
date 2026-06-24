const STATIC_CACHE = 'rayd8-express-static-v2'
const STATIC_ASSETS = [
  '/favicon.svg',
  '/manifest.webmanifest',
  '/icons/rayd8-express-192.png',
  '/icons/rayd8-express-512.png',
  '/icons/rayd8-express-192-maskable.png',
  '/icons/rayd8-express-512-maskable.png',
]

function shouldBypassCache(url) {
  return (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/v1/') ||
    url.pathname.startsWith('/clerk') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/subscription') ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('/mux') ||
    url.pathname.includes('/stream') ||
    url.pathname.includes('/token') ||
    url.hostname.includes('clerk') ||
    url.hostname.includes('mux.com') ||
    url.hostname.includes('mux.dev') ||
    url.hostname.includes('stream.mux') ||
    url.pathname.includes('playback-token') ||
    url.pathname.includes('session')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        // Installability should not fail because a non-critical icon is unavailable.
      }),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
      ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (shouldBypassCache(url)) {
    return
  }

  if (url.origin === self.location.origin && STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)))
  }
})
