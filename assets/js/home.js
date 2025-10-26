(() => {
  // -------------------- Globals / Utils --------------------
  window.API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:4000/api' : '/api';

  window.formatDateLabel = function (s) {
    if (!s) return '—';
    const d = new Date(s); if (isNaN(d)) return s;
    const day = d.getDate(), month = d.getMonth() + 1, yearBE = d.getFullYear() + 543;
    return `${day}/${month}/${String(yearBE).slice(-2)}`;
  };
  window.escapeHtml = (t = '') => t.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function toastError(title, text) {
    if (window.Swal) Swal.fire({ title, text, icon: 'error', confirmButtonText: 'OK' });
    else alert((title ? title + '\n' : '') + (text || ''));
  }
  function toastOK(title, text) {
    if (window.Swal) Swal.fire({ title, text, icon: 'success', confirmButtonText: 'OK' });
    else alert((title ? title + '\n' : '') + (text || ''));
  }

  // -------------------- Notifications Logic --------------------
  (function () {
    const btn = document.getElementById('notifBtn');
    const modal = document.getElementById('notifModal');
    const card = document.getElementById('notifCard');
    const badge = document.getElementById('notifBadge');
    const listEl = document.getElementById('notifList');
    const emptyEl = document.getElementById('notifEmpty');

    if (!btn || !modal || !card) return;

    const overlay = modal.querySelector('[data-overlay]');
    const closeBtn = modal.querySelector('[data-close]');
    let NOTIFICATIONS = [];

    function place() {
      const r = btn.getBoundingClientRect(), gap = 10, width = card.offsetWidth;
      const maxLeft = window.innerWidth - width - 8;
      card.style.left = Math.max(8, Math.min(r.right - width + 48, maxLeft)) + 'px';
      card.style.top = (r.bottom + gap) + 'px';
    }

    function open() {
      modal.classList.remove('hidden');
      requestAnimationFrame(place);
      window.addEventListener('resize', place, { passive: true });
      markAsRead();
    }
    function close() {
      modal.classList.add('hidden');
      window.removeEventListener('resize', place);
    }

    btn.addEventListener('click', open);
    overlay?.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

    function render() {
      const unreadCount = NOTIFICATIONS.filter(n => !n.read).length;
      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      if (NOTIFICATIONS.length === 0) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
        return;
      }

      emptyEl.classList.add('hidden');
      listEl.innerHTML = NOTIFICATIONS.map(n => {
        const isUnread = !n.read ? 'bg-indigo-50' : 'bg-white';
        const link = n.eventId ? `./event.html?id=${n.eventId}` : '#';
        const date = new Date(n.createdAt).toLocaleString('th-TH', { day:'numeric', month:'short', hour:'2-digit', minute: '2-digit' });

        return `
          <a href="${link}" class="block p-3 rounded-lg hover:bg-slate-100 ${isUnread}">
            <div class="flex items-start gap-3">
              ${!n.read ? '<div class="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0"></div>' : '<div class="h-2 w-2 shrink-0"></div>'}
              <div class="flex-1">
                <p class="text-sm text-slate-800">${window.escapeHtml(n.message)}</p>
                <p class="text-xs text-slate-500 mt-1">${date}</p>
              </div>
            </div>
          </a>`;
      }).join('');
    }

    async function loadNotifications() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${window.API_BASE}/notifications/me?ts=${Date.now()}`, {
          headers: { Authorization: "Bearer " + token },
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        NOTIFICATIONS = await res.json();
        render();
      } catch (e) {
        console.error("Failed to load notifications:", e);
      }
    }

    async function markAsRead() {
      const hasUnread = NOTIFICATIONS.some(n => !n.read);
      if (!hasUnread) return;

      NOTIFICATIONS.forEach(n => n.read = true);
      render();

      const token = localStorage.getItem("token");
      try {
        await fetch(`${window.API_BASE}/notifications/me/mark-as-read`, {
          method: 'POST',
          headers: { Authorization: "Bearer " + token },
          credentials: "include",
          cache: "no-store",
        });
      } catch (e) {
        console.error("Failed to mark notifications as read:", e);
      }
    }

    loadNotifications();
  })();

  // -------------------- Apple TV-like Hero --------------------
  (function () {
    const stage = document.getElementById('tvStage');
    if (!stage) return;

    const IMAGES = [
      'assets/hero/1.v2.jpg',
      'assets/hero/2.v2.jpg',
      'assets/hero/3.v2.jpg',
      'assets/hero/4.v2.jpg',
      'assets/hero/5.v2.jpg',
      'assets/hero/6.v2.jpg'
    ];

    const dotsWrap = document.getElementById('tvDots');
    const btnPrev = document.getElementById('tvPrev');
    const btnNext = document.getElementById('tvNext');
    const btnToggle = document.getElementById('tvToggle');

    function makeSlide(src, i) {
      const eager = i === 0 ? 'eager' : 'lazy';
      const prio  = i === 0 ? 'high' : 'auto';
      const el = document.createElement('div');
      el.className = 'tv-slide';
      el.innerHTML = `
        <img
          src="${src}"
          srcset="${src} 1600w"
          sizes="(max-width: 1024px) 100vw, 1100px"
          width="1600" height="900"
          alt=""
          loading="${eager}" fetchpriority="${prio}" decoding="async"
          referrerpolicy="no-referrer" crossorigin="anonymous">
        <div class="fade"></div>`;
      const img = el.querySelector('img');
      el.dataset.loading = '1';
      img.addEventListener('load', () => { delete el.dataset.loading; });
      img.addEventListener('error', () => { img.src = 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop'; });
      stage.appendChild(el);
      return el;
    }

    const slides = IMAGES.map((src, i) => makeSlide(src, i));
    const dots = IMAGES.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'dot'; b.addEventListener('click', () => goTo(i));
      dotsWrap && dotsWrap.appendChild(b);
      return b;
    });

    let index = 0, timer = null, playing = true;
    const INTERVAL = 6000;

    function apply() {
      const n = slides.length, L = (index - 1 + n) % n, R = (index + 1) % n;
      slides.forEach((sl, i) => {
        sl.classList.remove('is-center', 'is-left', 'is-right', 'is-hidden');
        if (i === index) sl.classList.add('is-center');
        else if (i === L) sl.classList.add('is-left');
        else if (i === R) sl.classList.add('is-right');
        else sl.classList.add('is-hidden');

        const img = sl.querySelector('img');
        if (i === index) { img.style.animation = 'none'; img.offsetHeight; img.style.animation = ''; }
      });
      dots.forEach((d, i) => d?.classList.toggle('active', i === index));
    }
    function goTo(i) { index = (i + slides.length) % slides.length; apply(); restart(); }
    const next = () => goTo(index + 1), prev = () => goTo(index - 1);
    function start() { if (playing && !timer) timer = setInterval(next, INTERVAL); }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }

    btnNext?.addEventListener('click', next);
    btnPrev?.addEventListener('click', prev);
    btnToggle?.addEventListener('click', () => { playing = !playing; if (btnToggle) btnToggle.textContent = playing ? '⏸' : '▶︎'; playing ? start() : stop(); });

    stage.tabIndex = 0;
    stage.addEventListener('keydown', e => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); });
    let sx = 0, dx = 0;
    stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; dx = 0; stop(); }, { passive: true });
    stage.addEventListener('touchmove', e => { dx = e.touches[0].clientX - sx; }, { passive: true });
    stage.addEventListener('touchend', () => { if (Math.abs(dx) > 40) (dx < 0 ? next() : prev()); if (playing) start(); });

    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

    apply(); start();

    ['tvDotsWrap', 'tvToggle', 'tvPrev', 'tvNext'].forEach(id => {
      const el = document.getElementById(id);
      if (el) stage.appendChild(el);
    });
  })();

 // -------------------- Profile / History / Events (with Pagination) --------------------
let currentUser = null;

(function () {
  const API_BASE = window.API_BASE;
  const token = localStorage.getItem("token");
  if (!token) { location.href = "./index.html"; return; }

  const $ = (s) => document.querySelector(s);
  const eventList = $("#eventList");
  const pagerWrap = $("#eventPager"); // ต้องมี <div id="eventPager"></div> ใต้ <ul id="eventList">
  const searchInput = $("#searchInput");
  const searchBtn = $("#searchBtn");
  const fab = $("#fabAdd"), addModal = $("#addModal"), addForm = $("#addForm");
  const dateInput = document.getElementById('addDate');
  if (dateInput) { const offset = new Date().getTimezoneOffset() * 60000; dateInput.value = new Date(Date.now() - offset).toISOString().slice(0, 10); }
  const addCancel = $("#addCancel");

  let ALL_EVENTS = [];

  // ===== Pagination state & helpers =====
  const PAGER = { page: 1, size: 8, view: [] }; // size จะเซ็ตตามหน้าจอข้างล่าง

  function computePageSize() {
    const cols = matchMedia('(min-width:1024px)').matches ? 4
               : matchMedia('(min-width:768px)').matches ? 2
               : 1;
    const rows = 4; // ล็อก 2 แถว
    PAGER.size = cols * rows; // lg:8, md:4, mobile:2
  }
  computePageSize();
  window.addEventListener('resize', (() => {
    let t; return () => { clearTimeout(t); t = setTimeout(() => {
      const old = PAGER.size; computePageSize();
      if (PAGER.size !== old) { PAGER.page = 1; renderEvents(PAGER.view); }
    }, 150); };
  })());

  function paginate(items, page, size) {
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(Math.max(1, page), pages);
    const start = (p - 1) * size;
    return { page: p, pages, total, slice: items.slice(start, start + size) };
  }

  function renderPager(meta) {
    if (!pagerWrap) return;
    const { page, pages } = meta;
    if (pages <= 1) { pagerWrap.innerHTML = ''; return; }

    const btn = (label, goto, active=false, disabled=false) => `
      <button data-goto="${goto}" ${disabled?'disabled':''}
        class="h-10 min-w-10 px-3 rounded-xl border
               ${active?'bg-slate-800 text-white border-slate-800 shadow'
                      :'bg-transparent text-slate-200/90 border-white/30 hover:bg-white/10'}
               disabled:opacity-40 disabled:cursor-not-allowed transition">
        ${label}
      </button>`;

    const bits = [];
    const addEllipsis = () => bits.push(`<span class="px-2 text-slate-400">…</span>`);
    const addNum = (n) => bits.push(btn(n, n, n===page));

    bits.push(btn('«', 1, false, page===1));
    bits.push(btn('‹', page-1, false, page===1));

    const windowSize = 1;
    const left = Math.max(2, page - windowSize);
    const right = Math.min(pages - 1, page + windowSize);

    addNum(1);
    if (left > 2) addEllipsis();
    for (let n = left; n <= right; n++) addNum(n);
    if (right < pages - 1) addEllipsis();
    if (pages > 1) addNum(pages);

    bits.push(btn('›', page+1, false, page===pages));
    bits.push(btn('หน้าสุดท้าย', pages, false, page===pages));

    pagerWrap.className = "mt-6 flex items-center justify-center gap-3";
    pagerWrap.innerHTML = bits.join('');

    pagerWrap.querySelectorAll('button[data-goto]').forEach(b=>{
      b.addEventListener('click', () => {
        const goto = Number(b.getAttribute('data-goto'));
        if (!Number.isFinite(goto)) return;
        PAGER.page = goto;
        renderEvents(PAGER.view); // อยู่ใน scope เดียวกัน — ไม่ error แล้ว
        // เลื่อนให้เห็นกริดชัด ๆ
        eventList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ===== Grid renderer (internal) =====
  function renderGrid(list, q="") {
    if (!Array.isArray(list) || list.length === 0) {
      eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-5 text-center text-slate-200 ring-1 ring-white/10 col-span-full">
        ${q ? `ไม่พบกิจกรรมที่ตรงกับ “${window.escapeHtml(q)}”` : 'ยังไม่มีกิจกรรม'}
      </li>`;
      return;
    }

    eventList.innerHTML = list.map(ev => {
      const dateTxt = ev.dateText ? window.formatDateLabel(ev.dateText) : "—";
      const title = window.escapeHtml(ev.title || 'Untitled Event');
      const eventUrl = `./event.html?id=${ev._id}`;

      const raw = String(ev.imageUrl || '').trim();
      const src =
        /^https?:\/\//i.test(raw) ? raw :
        raw.startsWith('/assets') ? raw :
        raw.startsWith('assets') ? '/' + raw :
        raw.startsWith('./assets') ? '/' + raw.replace(/^\.\//, '') :
        raw.startsWith('/') ? raw :
        (raw ? '/' + raw : '');
      const hasImage = !!src;

      const fallbackIcon = `<div class="absolute inset-0 bg-slate-700 grid place-items-center">
        <svg class="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      </div>`;

      const imageEl = hasImage
        ? `<img src="${window.escapeHtml(src)}" alt="" loading="lazy"
             class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out">`
        : fallbackIcon;

      return `<li class="relative aspect-[16/11] rounded-xl overflow-hidden group shadow-lg bg-slate-800 ring-1 ring-white/10">
        ${imageEl}
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"></div>
        <div class="absolute bottom-0 left-0 right-0 p-4 text-white z-10">
          <h3 class="text-lg font-semibold leading-tight mb-1 line-clamp-2">${title}</h3>
          <div class="flex items-center justify-between text-sm mt-2">
            <span class="text-slate-300">${dateTxt}</span>
            <a href="${eventUrl}"
              class="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors whitespace-nowrap">
              ดูรายละเอียด
            </a>
          </div>
        </div>
        <a href="${eventUrl}" class="absolute inset-0 z-0" aria-label="${title}"></a>
      </li>`;
    }).join("");
  }

  // ===== Public renderer (handles pagination) =====
  function renderEvents(items, q="") {
    PAGER.view = Array.isArray(items) ? items : [];
    const meta = paginate(PAGER.view, PAGER.page, PAGER.size);
    renderGrid(meta.slice, q);
    renderPager(meta);
  }

  // ===== Search =====
  function applySearch() {
    const q = (searchInput?.value || "").trim().toLowerCase();
    PAGER.page = 1;
    if (!q) { renderEvents(ALL_EVENTS); return; }
    const filtered = ALL_EVENTS.filter(ev => {
      const f = (v) => String(v || "").toLowerCase();
      return [ev.title, ev.location, ev.dateText].some(v => f(v).includes(q));
    });
    renderEvents(filtered, q);
  }
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const applySearchDebounced = debounce(applySearch, 150);
  searchBtn?.addEventListener('click', applySearch);
  searchInput?.addEventListener('input', applySearchDebounced);
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
    if (e.key === 'Escape') { searchInput.value = ''; applySearch(); }
  });

  // ===== Me / UI (คงของเดิมย่อ ๆ) =====
  async function loadMe() {
    const res = await fetch(`${API_BASE}/auth/me?ts=${Date.now()}`, {
      headers: { Authorization: "Bearer " + token }, credentials: "include", cache: "no-store",
    });
    if (!res.ok) throw new Error("unauthorized");
    const json = await res.json().catch(() => ({}));
    const me = json.user || json;
    currentUser = me;

    if (me.role === "admin") {
      const historyModel = document.getElementById('historyModal'); historyModel?.remove?.();
      const historyBtn = document.getElementById('historyBtn'); historyBtn?.remove?.();
    }
    const id = (x) => document.getElementById(x);
    const fullName = [me.firstName, me.lastName].filter(Boolean).join(" ").trim();
    id("ppName") && (id("ppName").textContent = fullName || "—");
    id("ppId")   && (id("ppId").textContent   = me.studentId ?? "—");
    id("ppEmail") && (id("ppEmail").textContent = me.email ?? "—");
    id("ppMajor") && (id("ppMajor").textContent = me.major ?? "—");
    id("ppPhone") && (id("ppPhone").textContent = me.phone ?? "—");

    const calFab = document.getElementById('calendarFab');
    if (me.role === "admin") { fab?.classList.remove("hidden"); calFab?.remove?.(); }
    else { calFab?.classList.remove('hidden'); }
  }

  function wireLogout() {
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      try {
        await fetch(`${API_BASE}/auth/logout?ts=${Date.now()}`, { method: "POST", credentials: "include", cache: "no-store" });
      } catch {}
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("rltg:events:v1");
        sessionStorage.clear();
        if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
        if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); }
      } catch {}
      location.replace("./index.html");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadMe().catch(() => { localStorage.removeItem("token"); location.href = "./index.html"; });
    wireLogout();
  });

  // ===== Load events & initial render =====
  async function loadEvents() {
    const key = 'rltg:events:v1';

    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const items = JSON.parse(cached);
        if (Array.isArray(items)) { ALL_EVENTS = items; PAGER.page = 1; renderEvents(ALL_EVENTS); }
      } catch {}
    }

    try {
      const res = await fetch(`${API_BASE}/events?ts=${Date.now()}`, {
        credentials: 'include', cache: 'no-store', keepalive: true
      });
      const items = await res.json().catch(() => []);
      ALL_EVENTS = Array.isArray(items) ? items : [];
      localStorage.setItem(key, JSON.stringify(ALL_EVENTS));
      PAGER.page = 1;
      renderEvents(ALL_EVENTS);
    } catch (e) {
      if (!eventList.innerHTML.trim()) {
        eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-4 text-slate-200 ring-1 ring-white/10 col-span-full">โหลดข้อมูลไม่สำเร็จ</li>`;
      }
    }
  }

  // ===== Add event (คง logic เดิม) =====
  function openAdd() { addModal?.classList.remove("hidden"); }
  function closeAdd() { addModal?.classList.add("hidden"); addForm?.reset(); }

  addForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('addSubmitBtn');
    const fd = new FormData(addForm);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'กำลังบันทึก...'; }

    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        credentials: "include",
        body: fd,
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: `HTTP Error ${res.status}` }));
        throw new Error(data.message || `เกิดข้อผิดพลาด: ${res.status}`);
      }
      closeAdd();
      toastOK('เพิ่มกิจกรรมสำเร็จ!');
      await loadEvents();
    } catch (err) {
      console.error("Add event error:", err);
      toastError('เพิ่มกิจกรรมไม่สำเร็จ', err.message || 'โปรดตรวจสอบข้อมูลแล้วลองอีกครั้ง');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'บันทึก'; }
    }
  });
  addCancel?.addEventListener("click", closeAdd);
  fab?.addEventListener("click", openAdd);
  addModal?.querySelector("[data-overlay]")?.addEventListener("click", closeAdd);

  Promise.allSettled([loadEvents()]).catch(() => { });
})();

  // -------------------- History modal (user) --------------------
  (function historyModal() {
    const API_BASE = window.API_BASE;
    const btnOpen = document.getElementById('historyBtn');
    const modal = document.getElementById('historyModal');
    if (!btnOpen || !modal) return;

    const btnClose = document.getElementById('historyClose');
    const overlay = modal.querySelector('[data-overlay]');
    const ul = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    const loading = document.getElementById('historyLoading');

    const open = () => modal.classList.remove('hidden');
    const close = () => modal.classList.add('hidden');

    async function fetchMyRegistrations() {
      const token = localStorage.getItem('token');
      const opt = { headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store' };
      let res = await fetch(`${API_BASE}/registrations/me?ts=${Date.now()}`, opt);
      if (res.ok) { const j = await res.json().catch(() => ({})); return j.items || []; }
      if (res.status === 404) {
        res = await fetch(`${API_BASE}/auth/my-registrations?ts=${Date.now()}`, opt);
        if (res.ok) { const j = await res.json().catch(() => ({})); return j.items || []; }
      }
      const t = await res.text().catch(() => ''); throw new Error(`GET failed ${res.status}: ${t || 'unknown error'}`);
    }

    async function loadHistory() {
      ul.classList.add('hidden'); ul.innerHTML = ''; empty.classList.add('hidden'); loading.classList.remove('hidden');
      try {
        const items = await fetchMyRegistrations();
        loading.classList.add('hidden');
        if (!items.length) { empty.classList.remove('hidden'); return; }
        ul.innerHTML = items.map(it => {
          const ev = it.event || {}; const title = ev.title || '(ไม่ระบุชื่อกิจกรรม)';
          const dateTxt = window.formatDateLabel(ev.dateText); const loc = ev.location || '—';
          const orphan = !ev._id;
          return `<li class="rounded-xl border border-slate-200 bg-white/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-semibold text-slate-900">
                  ${window.escapeHtml(title)}
                  ${orphan ? '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">ถูกลบแล้ว</span>' : ''}
                </div>
                <div class="text-sm text-slate-500">${dateTxt} • ${window.escapeHtml(loc)}</div>
                ${it.address ? `<div class="mt-1 text-xs text-slate-500">address: ${window.escapeHtml(it.address)}</div>` : ''}
              </div>
              <div class="shrink-0 flex gap-2">
                ${orphan
                  ? `<button data-remove="${it._id}" class="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300">ลบออก</button>`
                  : `<a href="./event.html?id=${ev._id}" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700">ดูรายละเอียด</a>`}
              </div>
            </div>
          </li>`;
        }).join('');
        ul.classList.remove('hidden');

        ul.querySelectorAll('[data-remove]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-remove');
            try {
              await fetch(`${API_BASE}/registrations/${id}`, {
                method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, cache: 'no-store'
              });
              loadHistory();
            } catch { }
          });
        });
      } catch (err) { loading.textContent = 'โหลดไม่สำเร็จ: ' + err.message; }
    }

    btnOpen.addEventListener('click', () => { open(); loadHistory(); });
    btnClose?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  })();

  // -------------------- Admin: Registrations Modal --------------------
  (function () {
    const API_BASE = window.API_BASE;
    const token = localStorage.getItem("token");
    if (!token) return;

    const $ = (s) => document.querySelector(s);
    const eventList = $("#eventList");
    const fabAdd = $("#fabAdd");
    const fabReg = $("#fabReg");
    const fabDel = $("#fabDel");

    const delUI = {
      wrap: document.getElementById('delModal'),
      overlay: document.querySelector('#delModal [data-overlay]'),
      close: document.getElementById('delClose'),
      close2: document.getElementById('delClose2'),
      loading: document.getElementById('delLoading'),
      empty: document.getElementById('delEmpty'),
      scroll: document.getElementById('delScroll'),
      list: document.getElementById('delList'),
    };

    const regUI = {
      wrap: document.getElementById('regModal'),
      overlay: document.querySelector('#regModal [data-overlay]'),
      close: document.getElementById('regClose'),
      close2: document.getElementById('regClose2'),
      sumWrap: document.getElementById('regSummary'),
      sumScroll: document.getElementById('regScroll'),
      sumLoading: document.getElementById('regLoading'),
      sumEmpty: document.getElementById('regEmpty'),
      table: document.getElementById('regTable'),
      tbody: document.getElementById('regTbody'),
      detailWrap: document.getElementById('regDetail'),
      dScroll: document.getElementById('rdScroll'),
      dTitle: document.getElementById('rdTitle'),
      dDate: document.getElementById('rdDate'),
      dLoading: document.getElementById('rdLoading'),
      dEmpty: document.getElementById('rdEmpty'),
      dTable: document.getElementById('rdTable'),
      dTbody: document.getElementById('rdTbody'),
      dBack: document.getElementById('rdBack'),
    };

    const esc = window.escapeHtml ?? (s => s);
    const fmt = window.formatDateLabel ?? (s => s);
    let RD_CURRENT_ROWS = [];

    function toDisplayDate(s) {
      if (!s) return '—';
      const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
      if (isNaN(d)) return '—';
      const day = d.getDate(), month = d.getMonth() + 1, year = d.getFullYear() + 543;
      return `${day}/${month}/${String(year).slice(-2)}`;
    }
    function showModal(el) {
      el.classList.remove('hidden');
      document.documentElement.classList.add('overflow-hidden');
      const p = el.querySelector('.modal-enter');
      if (p) requestAnimationFrame(() => p.classList.add('modal-enter-active'));
    }
    function hideModal(el) {
      const p = el.querySelector('.modal-enter');
      if (p) p.classList.remove('modal-enter-active');
      setTimeout(() => { el.classList.add('hidden'); document.documentElement.classList.remove('overflow-hidden'); }, 180);
    }

    function listify(j) {
      if (!j) return [];
      if (Array.isArray(j)) return j;
      if (Array.isArray(j.items)) return j.items;
      if (Array.isArray(j.data)) return j.data;
      if (Array.isArray(j.results)) return j.results;
      return [];
    }
    async function tryJson(url) {
      try {
        const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json().catch(() => null);
      } catch { return null; }
    }

    async function fetchEventCounts() {
      try {
        const r = await fetch(`${API_BASE}/events/admin/summary?ts=${Date.now()}`, {
          headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store'
        });
        if (!r.ok) return {};
        const list = await r.json().catch(() => []);
        const map = {};
        list.forEach(it => { map[it.eventId] = it.count || 0; });
        return map;
      } catch { return {}; }
    }
    function getRegEventId(reg) {
      if (!reg) return null;
      if (typeof reg.event === 'string') return reg.event;
      if (reg.event && typeof reg.event === 'object') return reg.event._id || null;
      return reg.eventId || reg.eventID || reg.event_id || null;
    }

    let CURRENT_USER = null;
    let EVENTS_CACHE = [];

    async function loadMe() {
      const res = await fetch(`${API_BASE}/auth/me?ts=${Date.now()}`, {
        headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store'
      });
      const j = await res.json().catch(() => ({}));
      CURRENT_USER = j.user || j;
      if (CURRENT_USER?.role === 'admin') {
        fabAdd?.classList.remove('hidden');
        fabReg?.classList.remove('hidden');
        fabDel?.classList.remove('hidden');
        document.getElementById('calendarFab')?.remove?.();
      }
    }

    async function loadEventsForAdminCacheOnly() {
      const res = await fetch(`${API_BASE}/events?ts=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
      const items = await res.json().catch(() => []);
      EVENTS_CACHE = Array.isArray(items) ? items : [];
    }

    (async function initAdmin() {
      await loadMe();
      if (CURRENT_USER?.role !== 'admin') return;
      await loadEventsForAdminCacheOnly();
    })().catch(() => {});

    function openDelModal() {
      if (!delUI.wrap) return;
      delUI.loading?.classList.remove('hidden');
      delUI.empty?.classList.add('hidden');
      delUI.scroll?.classList.add('hidden');
      delUI.list.innerHTML = '';
      showModal(delUI.wrap);

      const items = EVENTS_CACHE || [];
      delUI.loading?.classList.add('hidden');
      if (!items.length) { delUI.empty?.classList.remove('hidden'); return; }

      delUI.list.innerHTML = items.map(ev => `
        <li class="rounded-xl border border-slate-200 bg-white/60 p-4 flex items-center justify-between gap-3">
          <div>
            <div class="font-semibold">${esc(ev.title || '(ไม่ระบุชื่อกิจกรรม)')}</div>
            <div class="text-sm text-slate-500">${fmt(ev.dateText)} • ${esc(ev.location || '—')}</div>
          </div>
          <button data-del="${ev._id}" class="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500">ลบ</button>
        </li>`).join('');
      delUI.scroll?.classList.remove('hidden');

      delUI.list.querySelectorAll('button[data-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-del');
          const ev = EVENTS_CACHE.find(e => e._id === id);
          const name = ev?.title || '';

          if (window.Swal) {
            const c = await Swal.fire({
              title: 'ยืนยันลบกิจกรรมนี้?',
              text: name,
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: 'ลบ',
              cancelButtonText: 'ยกเลิก',
              confirmButtonColor: '#e11d48'
            });
            if (!c.isConfirmed) return;
          } else if (!confirm(`ยืนยันลบ: ${name}`)) return;

          btn.disabled = true;
          try {
            const r = await fetch(`${API_BASE}/events/${id}`, {
              method: 'DELETE',
              headers: { Authorization: 'Bearer ' + token },
              credentials: 'include',
              cache: 'no-store',
            });
            if (!r.ok) {
              const j = await r.json().catch(() => ({}));
              throw new Error(j.message || r.status);
            }

            // update caches & DOM
            EVENTS_CACHE = EVENTS_CACHE.filter(e => e._id !== id);
            try {
              const key = 'rltg:events:v1';
              const cached = JSON.parse(localStorage.getItem(key) || '[]');
              const next = Array.isArray(cached) ? cached.filter(e => e._id !== id) : [];
              localStorage.setItem(key, JSON.stringify(next));
            } catch {}

            btn.closest('li')?.remove();
            document.querySelector(`#eventList a[href="./event.html?id=${id}"]`)?.closest('li')?.remove();

            if (!delUI.list.children.length) {
              delUI.scroll?.classList.add('hidden');
              delUI.empty?.classList.remove('hidden');
            }
            toastOK('ลบสำเร็จ');
          } catch (e) {
            toastError('ลบไม่สำเร็จ', e.message || '');
          } finally {
            btn.disabled = false;
          }
        });
      });
    }

    fabDel?.addEventListener('click', openDelModal);
    delUI.overlay?.addEventListener('click', () => hideModal(delUI.wrap));
    delUI.close?.addEventListener('click', () => hideModal(delUI.wrap));
    delUI.close2?.addEventListener('click', () => hideModal(delUI.wrap));

    async function fetchAllRegistrations() {
      const urls = [
        `${API_BASE}/registrations`,
        `${API_BASE}/admin/registrations`,
        `${API_BASE}/registration`,
      ];
      for (const u of urls) {
        const j = await tryJson(u);
        if (j !== null) return listify(j);
      }
      return undefined;
    }
    async function fetchRegistrationsByEvent(eventId) {
      const urls = [
        `${API_BASE}/events/${eventId}/registrations`,
        `${API_BASE}/events/${eventId}/registration`,
        `${API_BASE}/events/${eventId}/participants`,
        `${API_BASE}/events/${eventId}/attendees`,
        `${API_BASE}/registrations?eventId=${encodeURIComponent(eventId)}`,
        `${API_BASE}/registrations?event=${encodeURIComponent(eventId)}`,
        `${API_BASE}/registrations/by-event/${eventId}`,
        `${API_BASE}/registrations/event/${eventId}`,
      ];
      for (const u of urls) {
        const j = await tryJson(u);
        if (j !== null) return listify(j);
      }
      return [];
    }
    function countFromEvent(ev) {
      if (ev == null) return null;
      if (typeof ev.registrationsCount === 'number') return ev.registrationsCount;
      if (typeof ev.registrationCount === 'number') return ev.registrationCount;
      if (typeof ev.attendeesCount === 'number') return ev.attendeesCount;
      if (typeof ev.participantsCount === 'number') return ev.participantsCount;
      if (Array.isArray(ev.registrations)) return ev.registrations.length;
      if (Array.isArray(ev.attendees)) return ev.attendees.length;
      return null;
    }

    async function openRegModal() {
      if (CURRENT_USER?.role !== 'admin' || !regUI.wrap) return;

      regUI.sumLoading.classList.remove('hidden');
      regUI.sumWrap.classList.remove('hidden');
      regUI.detailWrap.classList.add('hidden');
      regUI.sumEmpty.classList.add('hidden');
      regUI.table.classList.add('hidden');
      regUI.tbody.innerHTML = '';
      regUI.sumScroll?.scrollTo?.(0, 0);
      showModal(regUI.wrap);

      let events = EVENTS_CACHE;
      if (!events.length) {
        const r = await fetch(`${API_BASE}/events?ts=${Date.now()}`, { credentials: 'include', cache: 'no-store' });
        events = await r.json().catch(() => []);
        events = Array.isArray(events) ? events : [];
      }

      const allListMaybe = await fetchAllRegistrations();
      const allList = Array.isArray(allListMaybe) ? allListMaybe : (allListMaybe === undefined ? undefined : listify(allListMaybe));

      let rows = [];
      if (allList === undefined || allList.length === 0) {
        rows = events.map(ev => ({ ev, count: countFromEvent(ev) }));
      } else {
        const map = new Map();
        allList.forEach(reg => {
          const id = getRegEventId(reg);
          if (!id) return;
          map.set(id, (map.get(id) || 0) + 1);
        });
        rows = events.map(ev => {
          const fromEv = countFromEvent(ev);
          const grouped = map.get(ev._id) ?? 0;
          return { ev, count: (fromEv ?? grouped) };
        });
      }

      const COUNTS = await fetchEventCounts();
      regUI.tbody.innerHTML = events.map(ev => {
        const c = COUNTS[ev._id] ?? 0;
        return `<tr class="border-t">
          <td class="py-2 pr-3">${esc(ev.title || '(ไม่ระบุชื่อกิจกรรม)')}</td>
          <td class="py-2 pr-3">${toDisplayDate(ev.dateText)}</td>
          <td class="py-2 pr-3">${c}</td>
          <td class="py-2">
            <button data-view="${ev._id}" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">ดูรายชื่อ</button>
          </td>
        </tr>`;
      }).join("");

      regUI.sumLoading.classList.add('hidden');
      if (!rows.length) regUI.sumEmpty.classList.remove('hidden'); else regUI.table.classList.remove('hidden');

      regUI.tbody.querySelectorAll('button[data-view]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-view');
          const ev = events.find(e => e._id === id) || {};
          await openRegDetail(ev);
        });
      });
    }

    function sanitizeFilename(s = '') {
      return String(s).replace(/[\/\\?%*:|"<>]/g, '_').trim() || 'export';
    }

    function toCSV(rows) {
      const header = ['ชื่อ', 'รหัสนักศึกษา', 'คณะ', 'E-mail', 'เบอร์โทรศัพท์', 'ที่อยู่ (ตอนลงทะเบียน)'];
      const escCSV = (v) => {
        const t = String(v ?? '');
        return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      const lines = [header.map(escCSV).join(',')];
      for (const r of rows) {
        lines.push([r.name, r.idnum, r.faculty, r.email, r.phone, r.addr].map(escCSV).join(','));
      }
      return lines.join('\n');
    }

    function downloadCSVFile(filename, csvText) {
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    const coalesce = (...vals) => {
      for (const v of vals) {
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
      return undefined;
    };

    async function openRegDetail(ev) {
      regUI.detailWrap.classList.remove('hidden');
      regUI.sumWrap.classList.add('hidden');
      regUI.dScroll?.scrollTo?.(0, 0);
      regUI.dTitle.textContent = ev.title || '(ไม่ระบุชื่อกิจกรรม)';
      regUI.dDate.textContent = toDisplayDate(ev.dateText);
      regUI.dLoading.classList.remove('hidden');
      regUI.dEmpty.classList.add('hidden');
      regUI.dTable.classList.add('hidden');
      regUI.dTbody.innerHTML = '';
      RD_CURRENT_ROWS = [];
      document.getElementById('rdExport')?.setAttribute('disabled', 'true');

      let regs = await fetchRegistrationsByEvent(ev._id);
      if (!regs.length) {
        const all = await fetchAllRegistrations();
        if (Array.isArray(all)) regs = all.filter(r => getRegEventId(r) === ev._id);
      }

      regUI.dLoading.classList.add('hidden');
      if (!regs.length) { regUI.dEmpty.classList.remove('hidden'); return; }

      regUI.dTbody.innerHTML = regs.map(r => {
        const u = r.user || r.profile || r.account || {};

        const first = coalesce(
          u.firstName, u.firstname, u.first_name, u.givenName, u.given_name,
          r.firstName, r.firstname, r.first_name, r.givenName, r.given_name
        );
        const last = coalesce(
          u.lastName, u.lastname, u.last_name, u.familyName, u.family_name,
          r.lastName, r.lastname, r.last_name, r.familyName, r.family_name
        );
        const fullFromParts = [first, last].filter(Boolean).join(' ').trim();
        const name = coalesce(
          fullFromParts,
          u.fullName, u.fullname, u.name,
          r.fullName, r.fullname, r.name,
          u.username, r.username,
          '—'
        );

        const idnum   = coalesce(u.studentId, u.idNumber, r.studentId, r.idNumber, r.sid, '—');
        const faculty = coalesce(
          u.faculty, u.fac, u.facultyName, u.department, u.major, u.school, u.college,
          r.faculty, r.fac, r.facultyName, r.department, r.major, r.school, r.college,
          '—'
        );
        const email   = coalesce(u.email, r.email, '—');
        const phone   = coalesce(u.phone, u.tel, r.phone, r.tel, '—');
        const addr    = coalesce(r.address, r.addr, r.registrationAddress, r.contactAddress, '—');

        return `<tr class="border-t">
          <td class="py-2 pr-3">${esc(name)}</td>
          <td class="py-2 pr-3">${esc(idnum)}</td>
          <td class="py-2 pr-3">${esc(faculty)}</td>
          <td class="py-2 pr-3">${esc(email)}</td>
          <td class="py-2 pr-3">${esc(phone)}</td>
          <td class="py-2 pr-3">${esc(addr)}</td>
        </tr>`;
      }).join('');

      RD_CURRENT_ROWS = regs.map(r => {
        const u = r.user || r.profile || r.account || {};

        const first = coalesce(
          u.firstName, u.firstname, u.first_name, u.givenName, u.given_name,
          r.firstName, r.firstname, r.first_name, r.givenName, r.given_name
        );
        const last = coalesce(
          u.lastName, u.lastname, u.last_name, u.familyName, u.family_name,
          r.lastName, r.lastname, r.last_name, r.familyName, r.family_name
        );
        const fullFromParts = [first, last].filter(Boolean).join(' ').trim();
        const name = coalesce(
          fullFromParts,
          u.fullName, u.fullname, u.name,
          r.fullName, r.fullname, r.name,
          u.username, r.username,
          '—'
        );

        const idnum   = coalesce(u.studentId, u.idNumber, r.studentId, r.idNumber, r.sid, '—');
        const faculty = coalesce(
          u.faculty, u.fac, u.facultyName, u.department, u.major, u.school, u.college,
          r.faculty, r.fac, r.facultyName, r.department, r.major, r.school, r.college,
          '—'
        );
        const email   = coalesce(u.email, r.email, '—');
        const phone   = coalesce(u.phone, u.tel, r.phone, r.tel, '—');
        const addr    = coalesce(r.address, r.addr, r.registrationAddress, r.contactAddress, '—');

        return { name, idnum, faculty, email, phone, addr };
      });

      regUI.dTable.classList.remove('hidden');
      document.getElementById('rdExport')?.removeAttribute('disabled');
    }

    fabReg?.addEventListener('click', openRegModal);
    regUI.overlay?.addEventListener('click', () => hideModal(regUI.wrap));
    regUI.close?.addEventListener('click', () => hideModal(regUI.wrap));
    regUI.close2?.addEventListener('click', () => hideModal(regUI.wrap));
    regUI.dBack?.addEventListener('click', () => {
      regUI.detailWrap.classList.add('hidden');
      regUI.sumWrap.classList.remove('hidden');
      regUI.sumScroll?.scrollTo?.(0, 0);
    });

    document.getElementById('rdExport')?.addEventListener('click', () => {
      if (!RD_CURRENT_ROWS.length) return;
      const title = document.getElementById('rdTitle')?.textContent || 'export';
      const date  = document.getElementById('rdDate')?.textContent || '';
      const filename = sanitizeFilename(`${title} ${date}`.trim());
      const csv = toCSV(RD_CURRENT_ROWS);
      downloadCSVFile(filename, csv);
    });
  })();

  // -------------------- Service worker --------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ });
    });
  }

  requestIdleCallback?.(() => {
    // warm image cache
    ['2.v2.jpg','3.v2.jpg'].forEach(name => {
      const i = new Image();
      i.referrerPolicy = 'no-referrer';
      i.src = `/assets/hero/${name}`;
    });
  });
})();