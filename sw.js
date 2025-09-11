// sw.js — SWR cache สำหรับ GET /api/events
const NAME = 'rltg-cache-v1';
const API_EVENTS = /\/api\/events(?:\?|$)/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== NAME).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (API_EVENTS.test(url.pathname + url.search)) {
    e.respondWith((async () => {
      const cache = await caches.open(NAME);
      const cached = await cache.match(request);
      const network = fetch(request).then(resp => {
        if (resp && resp.ok) cache.put(request, resp.clone());
        return resp;
      }).catch(() => cached || Response.error());
      return cached || network;
    })());
  }
});
