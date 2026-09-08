// Minimal hand-written service worker: app-shell cache-first strategy with a versioned cache
// name tied to the app version, so a rebuild invalidates stale assets automatically.
//
// The install-time manifest pre-caches the complete compiled module graph so first-load offline
// behavior does not depend on fetch-time caching having already visited every route.
// Personal/API responses are deliberately never placed in the app-shell cache.
const CACHE_VERSION = 'streamarkr-v0.17.0';
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isPersonalApi = url.pathname.startsWith('/api/');
  const hasAuthorization = event.request.headers.has('authorization');

  // Cache only same-origin unauthenticated app assets. This prevents Worker snapshot/personal-data
  // responses from entering Cache Storage when the PWA and API eventually share an origin, and
  // also avoids caching cross-origin API responses if the Worker is hosted separately.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || isPersonalApi || hasAuthorization) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })
  );
});