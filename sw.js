// Minimal hand-written service worker: app-shell cache-first strategy with a versioned cache
// name tied to the app version, so a rebuild invalidates stale assets automatically.
//
// The install-time manifest pre-caches the complete compiled module graph so first-load offline
// behavior does not depend on fetch-time caching having already visited every route.
// Personal/API responses are deliberately never placed in the app-shell cache.
const CACHE_VERSION = 'streamarkr-v0.12.0';
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
        const manifestRes = await fetch('./sw-manifest.json', { cache: 'no-store' });
        if (manifestRes.ok) {
          const { files } = await manifestRes.json();
          if (Array.isArray(files) && files.length) await cache.addAll(files);
        }
      } catch {
        // Fetch-time caching remains a fallback if the generated manifest is temporarily unavailable.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppAssetRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (request.headers.has('authorization')) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !isAppAssetRequest(event.request)) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
