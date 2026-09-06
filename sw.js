// Minimal hand-written service worker: app-shell cache-first strategy with a versioned cache
// name tied to the app version, so a rebuild invalidates stale assets automatically.
//
// Correction 12: install-time caching must not assume runtime (fetch-time) caching alone will
// eventually populate the cache — a user who goes offline right after first load must already
// have every compiled JS module cached. `sw-manifest.json` is generated at build time
// (`npm run build` -> generate-sw-manifest.mjs) listing every file under dist/, so install()
// below pre-caches the static shell AND the full compiled module graph in one pass.
const CACHE_VERSION = 'streamarkr-v0.10.2';
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
        // If the manifest can't be fetched (e.g. dev server hiccup), fetch-time caching in the
        // handler below still fills the cache progressively — this just makes first-load
        // reliability best-effort rather than a hard install failure.
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
  if (event.request.method !== 'GET') return;
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
