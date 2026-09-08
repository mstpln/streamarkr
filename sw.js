// Minimal hand-written service worker: app-shell cache-first strategy with a versioned cache
// name tied to the app version, so a rebuild invalidates stale assets automatically.
// The production-activation diagnostics hotfix changes this worker script so installed
// v0.18.0 clients detect a new worker and rerun install-time precaching without changing
// the product build identity.
//
// The install-time manifest pre-caches the complete compiled module graph so first-load offline
// behavior does not depend on fetch-time caching having already visited every route.
// Personal/API responses are deliberately never placed in the app-shell cache.
const CACHE_VERSION = 'streamarkr-v0.18.0';
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
        const manifestResponse = await fetch('./sw-manifest.json', { cache: 'no-store' });
        if (!manifestResponse.ok) throw new Error(`sw-manifest ${manifestResponse.status}`);
        const urls = await manifestResponse.json();
        if (!Array.isArray(urls)) throw new Error('invalid sw-manifest');
        await cache.addAll(urls);
      } catch (error) {
        console.warn('Streamarkr service worker could not precache the compiled module graph.', error);
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name.startsWith('streamarkr-') && name !== CACHE_VERSION).map((name) => caches.delete(name))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || request.headers.has('authorization')) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});
