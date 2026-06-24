// ShadowCrypt Service Worker
// Minimal SW to satisfy PWA installability requirements.
// Caches the app shell on install for offline resilience.

const CACHE_NAME = 'shadowcrypt-v2';

// App shell resources to cache on install
const PRECACHE_URLS = [
  '/',
  '/chat',
  '/auth',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache silently; failures are non-fatal
      return cache.addAll(PRECACHE_URLS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Remove old caches from previous SW versions
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy: always try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful same-origin GET requests
        if (
          response.ok &&
          event.request.method === 'GET' &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
