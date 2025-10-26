// sw.js
const VER = 'v3';
const STATIC_CACHE  = `static-${VER}`;
const RUNTIME_CACHE = `runtime-${VER}`;
const API_EVENTS = /\/api\/events(?:\?|$)/;

const STATIC_ASSETS = [
  '/', '/home.html',
  '/assets/js/home.js',
  // 🚫 อย่าพรีแคชรูปที่เปลี่ยนบ่อย
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
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) API → network-first (มีสำรอง)
  if (API_EVENTS.test(url.pathname + url.search)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await cache.match(req)) ||
               new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  // 2) รูปภาพ → SWR + reload + purge 404 (จากบล็อกด้านบน)
  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const fresh = await fetch(req, { cache: 'reload' })
        .then(async res => {
          if (res.ok) await cache.put(req, res.clone());
          else if (res.status === 404 && cached) await cache.delete(req);
          return res;
        })
        .catch(() => null);
      return cached || fresh || new Response('', { status: 504 });
    })());
    return;
  }

  // 3) static อื่น ๆ → cache-first (ถ้าฟังส์ชันเปลี่ยนบ่อย ให้ใช้ SWR เช่นเดียวกับรูป)
  if (/\.(?:js|css|woff2?)$/i.test(url.pathname)) {
    e.respondWith((async () => (await caches.match(req)) || fetch(req))());
    return;
  }
});
