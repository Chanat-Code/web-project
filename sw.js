// sw.js (ปรับปรุง)
const VER = 'v191';
const STATIC_CACHE  = `static-${VER}`;
const RUNTIME_CACHE = `runtime-${VER}`;
const API_EVENTS = /\/api\/events(?:\?|$)/;

// ปรับ: ใส่ไฟล์พื้นฐานสำหรับ fallback ออฟไลน์
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

// ——— Install ———
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ——— Activate + Navigation Preload ———
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // เปิด navigation preload ถ้ามี
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

  // ข้าม cross-origin ทั้งหมด (ลดบั๊กและ opaque)
  if (!sameOrigin(url)) return;

  // 0) HTML navigations → network-first + offline fallback
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        // ใช้ navigation preload ถ้ามี
        const prel = await e.preloadResponse;
        if (prel) return prel;

        const fresh = await fetch(req, { cache: 'no-store' });
        return fresh;
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match('/home.html')) || Response.error();
      }
    })());
    return;
  }

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

  // 2) รูปภาพ → SWR (stale-while-revalidate) + จำกัดจำนวน
  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);

      const freshPromise = fetch(req, { cache: 'reload' }).then(async (res) => {
        if (res.ok) {
          await cache.put(req, res.clone());
          // บีบจำนวน entries กันบวม
          limitCacheEntries(RUNTIME_CACHE, 120);
        } else if (res.status === 404 && cached) {
          await cache.delete(req);
        }
        return res;
      }).catch(() => cached); // ถ้าเน็ตล่ม ให้ใช้ cached

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
        const runtimeCached = await cache.match(req);
        if (runtimeCached) return runtimeCached;

        const staticCache = await caches.open(STATIC_CACHE);
        const staticCached = await staticCache.match(req);
        return staticCached || new Response('', { status: 504 });
      }
    })());
    return;
  }

  // อื่นๆ → ลอง runtime cache ก่อน ค่อยไปเน็ต (cache-first with network fallback)
  e.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && req.method === 'GET') await cache.put(req, res.clone());
      return res;
    } catch {
      return hit || Response.error();
    }
  })());
});
