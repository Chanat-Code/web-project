// Improved service worker to fix image loading without Shift+F5

/*
  This version of the service worker is based off of the original sw.js from
  the project repository. The key changes are documented below. To upgrade
  an existing deployment, replace your current sw.js with this file and
  update the `VER` constant to invalidate any old caches. Once deployed,
  hard‑refreshing is no longer necessary for new images.

  Changes:
  - Added a guard that ignores fetch events for cross‑origin requests. In the
    original implementation the SW attempted to handle and cache all image
    requests, including those hosted on third‑party domains (e.g. Google
    Drive or Unsplash). Because those responses are opaque, the cache API
    cannot store them which resulted in CORS errors and stale images unless
    the user performed a hard refresh. By returning early for off‑origin
    requests the browser can fetch these assets directly without SW
    intervention.
  - Kept the existing caching strategies for API, images and static assets
    unchanged. You can still bump the `VER` string whenever you need to
    invalidate previously cached files.
*/

const VER = 'v5';                           // ⬅️ bump every time you update SW
const STATIC_CACHE  = `static-${VER}`;
const RUNTIME_CACHE = `runtime-${VER}`;
const API_EVENTS = /\/api\/events(?:\?|$)/;

const STATIC_ASSETS = [
  '/', '/home.html',
  '/assets/js/home.js?v=20251026-1',        // ⬅️ update when home.js changes
  // Do not pre‑cache frequently changing images
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
      .map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Ignore anything other than GET requests
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /*
    Skip handling for cross‑origin requests. Without this check the SW
    intercepts images hosted on external domains and tries to cache them.
    Those responses are opaque and cannot be cached, leading to failures
    and forcing users to hard refresh to see updated images. Let the
    browser fetch these resources directly.
  */
  if (url.origin !== self.location.origin) return;

  const pathPlusQuery = url.pathname + url.search;

  // 1) API /events → network‑first (fall back to cache)
  if (API_EVENTS.test(pathPlusQuery)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(req);
        return cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // 2) Images → network‑first (+ purge 404)
  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        // Try to fetch a fresh copy
        const fresh = await fetch(req, { cache: 'reload' });
        if (fresh.ok) {
          await cache.put(req, fresh.clone());
        } else if (fresh.status === 404) {
          // Remove old cached copy if server returns 404
          const has = await cache.match(req);
          if (has) await cache.delete(req);
        }
        return fresh;                   // return newest image
      } catch {
        // Offline/net failure → fallback to cache
        const cached = await cache.match(req);
        return cached || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // 3) Other static files (js/css/woff2) → cache‑first
  if (/\.(?:js|css|woff2?)$/i.test(url.pathname)) {
    e.respondWith((async () => (await caches.match(req)) || fetch(req))());
    return;
  }
});