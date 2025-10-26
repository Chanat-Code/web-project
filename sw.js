// sw.js
const VER = 'v192';
const STATIC_CACHE  = `static-${VER}`;
const RUNTIME_CACHE = `runtime-${VER}`;
const API_EVENTS = /\/api\/events(?:\?|$)/;

// ไฟล์พื้นฐานสำหรับ fallback ออฟไลน์
const STATIC_ASSETS = ['/', '/home.html'];

// ——— Utils ———
const sameOrigin = (url) => url.origin === self.location.origin;
async function limitCacheEntries(cacheName, max = 120) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
}

// API ที่ “ผูกกับผู้ใช้” (ไม่อนุญาตให้แคช) — ยกเว้น /api/events
const isUserScopedAPI = (url) =>
  url.pathname.startsWith('/api/') && !API_EVENTS.test(url.pathname + url.search);

// ——— Install ———
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// ——— Activate + Navigation Preload ———
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ——— Fetch ———
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!sameOrigin(url)) return;

  // 0) HTML navigations → network-first + offline fallback
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const prel = await e.preloadResponse;
        if (prel) return prel;
        return await fetch(req, { cache: 'no-store' });
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match('/home.html')) || Response.error();
      }
    })());
    return;
  }

  // **สำคัญ**: ทุก API ที่ไม่ใช่ /api/events หรือมี Authorization → network-only (no-store)
  if (isUserScopedAPI(url) || req.headers.has('Authorization')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 1) /api/events → network-first (มีสำรอง)
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

  // 2) รูปภาพ → SWR (stale-while-revalidate) + จำกัดจำนวน
  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const freshPromise = fetch(req, { cache: 'reload' }).then(async (res) => {
        if (res.ok) {
          await cache.put(req, res.clone());
          limitCacheEntries(RUNTIME_CACHE, 120);
        } else if (res.status === 404 && cached) {
          await cache.delete(req);
        }
        return res;
      }).catch(() => cached);
      return cached || freshPromise;
    })());
    return;
  }

  // 3) JS/CSS/Fonts → network-first
  if (/\.(?:js|css|woff2?|ttf|otf)$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const hit = await cache.match(req);
        if (hit) return hit;
        const staticCache = await caches.open(STATIC_CACHE);
        const staticHit = await staticCache.match(req);
        return staticHit || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // อื่นๆ (ไฟล์สาธารณะ) → cache-first
  e.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) await cache.put(req, res.clone());
      return res;
    } catch {
      return hit || Response.error();
    }
  })());
});
