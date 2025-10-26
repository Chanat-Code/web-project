// sw.js
const VER = 'v4';                           // ⬅️ เปลี่ยนเวอร์ชัน
const STATIC_CACHE  = `static-${VER}`;
const RUNTIME_CACHE = `runtime-${VER}`;
const API_EVENTS = /\/api\/events(?:\?|$)/;

// ✅ พรีแคชเฉพาะไฟล์คงที่จริง ๆ (อย่าใส่ home.js)
const STATIC_ASSETS = [
  '/',
  '/home.html',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // เปิด navigation preload (ช่วยให้หน้าโหลดเร็วขึ้นตอนออนไลน์)
    try { await self.registration.navigationPreload?.enable?.(); } catch {}
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const path = url.pathname;

  // 0) หน้า HTML (navigation) → network-first + fallback มา /home.html จากแคช
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const preload = await e.preloadResponse;
        return preload || await fetch(req, { cache: 'no-store' });
      } catch {
        return (await caches.match('/home.html')) ||
               new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 1) API /events → network-first (มีสำรองในแคช)
  if (API_EVENTS.test(path + url.search)) {
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

  // 2) รูปภาพ → SWR + purge 404 + ขอแบบ reload
  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(path)) {
    e.respondWith((async () => {
      const cache  = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const fresh  = await fetch(req, { cache: 'reload' })
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

  // 3) ไฟล์ static (.js/.css/ฟอนต์) → SWR (ไม่ใช้ cache-first อีกต่อไป)
  if (/\.(?:js|css|woff2?|ttf)$/i.test(path)) {
    e.respondWith((async () => {
      const cache  = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      // ขอของใหม่ทุกครั้ง แล้วอัปเดตแคช (กัน stale JS)
      const freshP = fetch(req, { cache: 'no-store' })
        .then(async res => { if (res.ok) await cache.put(req, res.clone()); return res; })
        .catch(() => null);
      return cached || (await freshP) || fetch(req);
    })());
    return;
  }

  // 4) อย่างอื่น → ปล่อยตามปกติ (ไป network)
});
