// Minimal hand-written service worker: app-shell cache-first strategy with a versioned cache
// name tied to the app version, so a rebuild invalidates stale assets automatically.
//
// The install-time manifest pre-caches the complete compiled module graph so first-load offline
// behavior does not depend on fetch-time caching having already visited every route.
// Personal/API responses are deliberately never placed in the app-shell cache.
const CACHE_VERSION = 'streamarkr-v0.13.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/styles/main.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(APP_SHELL);
      try {
        const response = await fetch('./sw-manifest.json', { cache: 'no-store' });
        if (response.ok) {
          const modules = await response.json();
          await cache.addAll(modules);
        }
      } catch {
        // Keep install resilient if the generated module manifest is unavailable.
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    request.headers.has('authorization')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
