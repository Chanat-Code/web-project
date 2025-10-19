// sw.js
const VER = 'v2';
const STATIC_CACHE  = `static-${VER}`;
const RUNTIME_CACHE = `runtime-${VER}`;
const API_EVENTS = /\/api\/events(?:\?|$)/;

const STATIC_ASSETS = [
  '/', '/home.html',
  '/assets/js/home.js',
  '/assets/hero/IMG_20250807_143556.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) API events → network-first + put cache (สดเสมอ แต่มีสำรอง)
  if (API_EVENTS.test(url.pathname + url.search)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(req);
        return cached || new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // 2) รูปภาพ → stale-while-revalidate (โหลดไวมากบน revisit)
  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const fetching = fetch(req)
        .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      return cached || fetching || fetch(req);
    })());
    return;
  }

  // 3) ไฟล์ static อื่น ๆ → cache-first
  if (/\.(?:js|css|woff2?)$/i.test(url.pathname)) {
    e.respondWith((async () => (await caches.match(req)) || fetch(req))());
    return;
  }
});
