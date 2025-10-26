// sw.js
const VER = 'v20251026-2';
const STATIC_CACHE  = `static-${VER}`;
const RUNTIME_CACHE = `runtime-${VER}`;

const STATIC_ASSETS = [
  '/', '/home.html',
  // อย่าใส่ไฟล์ที่มี ?v=xxx ตรงๆ ในพรีแคช ให้ปล่อย runtime จัดการ
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
    await self.clients.claim();
  })());
});

// รับข้อความเพื่อสั่ง skip waiting จากหน้าเว็บ
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function isHTML(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').includes('text/html');
}
function isStaticAsset(url) {
  return /\.(?:js|css|woff2?)$/i.test(url.pathname);
}
function isHeroImage(url) {
  return url.pathname.startsWith('/assets/hero/');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) HTML → network-first
  if (isHTML(req)) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req, { ignoreSearch: false });
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // 2) Hero images → network-first (เห็นรูปใหม่ทันที)
  if (isHeroImage(url)) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req, { ignoreSearch: false })) || fetch(req);
      }
    })());
    return;
  }

  // 3) JS/CSS/ฟ้อนต์ → stale-while-revalidate (สนใจ query string)
  if (isStaticAsset(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req, { ignoreSearch: false });
      const fetchAndUpdate = fetch(req).then(res => {
        cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await fetchAndUpdate) || fetch(req);
    })());
    return;
  }

  // 4) อื่น ๆ → ลอง cache-first แล้วค่อยเน็ต
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: false });
    return cached || fetch(req).then(async res => {
      const c = await caches.open(RUNTIME_CACHE);
      c.put(req, res.clone());
      return res;
    });
  })());
});
