// @ts-nocheck
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
        emptyEl?.classList.remove('hidden'); // Add null check
        return;
      }

      emptyEl?.classList.add('hidden'); // Add null check
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
      'assets/hero/1.v2.jpg', 'assets/hero/2.v2.jpg', 'assets/hero/3.v2.jpg',
      'assets/hero/4.v2.jpg', 'assets/hero/5.v2.jpg', 'assets/hero/6.v2.jpg'
    ];

    const dotsWrap = document.getElementById('tvDots');
    const btnPrev = document.getElementById('tvPrev');
    const btnNext = document.getElementById('tvNext');
    const btnToggle = document.getElementById('tvToggle');

    function makeSlide(src, i) {
      const eager = i === 0 ? 'eager' : 'lazy';
      const prio  = i === 0 ? 'high' : 'auto';
      const el = document.createElement('div');
      el.className = 'tv-slide';
      el.innerHTML = `
        <img src="${src}" srcset="${src} 1600w" sizes="(max-width: 1024px) 100vw, 1100px"
          width="1600" height="900" alt="" loading="${eager}" fetchpriority="${prio}" decoding="async"
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

  // -------------------- Profile Modal Logic --------------------
  (function () {
    const btn = document.getElementById('profileBtn');
    const modal = document.getElementById('profileModal');
    const card = document.getElementById('profileCard');
    if (!btn || !modal || !card) return;
    const overlay = modal.querySelector('[data-overlay]');
    const closeBtn = modal.querySelector('[data-close]');
    let lastActive = null;
    function place() {
      const r = btn.getBoundingClientRect(), gap = 10, width = card.offsetWidth || 360;
      const maxLeft = window.innerWidth - width - 8;
      const left = Math.max(8, Math.min(r.right - width, maxLeft));
      const top = Math.min(r.bottom + gap, window.innerHeight - (card.offsetHeight || 0) - 8);
      card.style.left = left + 'px'; card.style.top = top + 'px';
    }
    function lockScroll(lock) {
      const el = document.scrollingElement || document.documentElement;
      if (lock) { el.dataset.prevOverflow = el.style.overflow || ''; el.style.overflow = 'hidden'; document.body.classList.add('overflow-hidden'); }
      else { el.style.overflow = el.dataset.prevOverflow || ''; document.body.classList.remove('overflow-hidden'); delete el.dataset.prevOverflow; }
    }
    function open() { lastActive = document.activeElement; modal.classList.remove('hidden'); lockScroll(true); requestAnimationFrame(place); window.addEventListener('resize', place, { passive: true }); }
    function close() { modal.classList.add('hidden'); lockScroll(false); if (lastActive) lastActive.focus?.(); window.removeEventListener('resize', place); }
    btn.addEventListener('click', open);
    overlay?.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  })();

  // -------------------- Main Event/Pagination/Search/Add Logic --------------------
  (function () {
    const API_BASE = window.API_BASE;
    const token = localStorage.getItem("token");
    if (!token) { location.href = "./index.html"; return; }

    const $ = (s) => document.querySelector(s);
    const eventList = $("#eventList");
    const paginationControlsContainer = $("#paginationControls");
    const searchInput = $("#searchInput");
    const searchBtn = $("#searchBtn");
    const fab = $("#fabAdd"), addModal = $("#addModal"), addForm = $("#addForm");
    const dateInput = document.getElementById('addDate');
    if (dateInput) { const offset = new Date().getTimezoneOffset() * 60000; dateInput.value = new Date(Date.now() - offset).toISOString().slice(0, 10); }
    const addCancel = $("#addCancel");

    // --- State Variables ---
    let ALL_EVENTS_CURRENT_PAGE = [];
    let currentPage = 1;
    const eventsPerPage = 8;
    let totalPages = 1;
    let isLoadingEvents = false;
    let currentUser = null;

    // --- renderEvents function ---
    function renderEvents(items, q = "") {
        if (!eventList) return;
        if (!Array.isArray(items) || items.length === 0) {
        eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-5 text-center text-slate-200 ring-1 ring-white/10 col-span-full">
            ${q ? `ไม่พบกิจกรรมที่ตรงกับ “${window.escapeHtml(q)}”` : 'ยังไม่มีกิจกรรม'}
        </li>`;
        return;
        }

        eventList.innerHTML = items.map(ev => {
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

    // --- renderPaginationControls ---
    function renderPaginationControls(currentPage, totalPages) {
        if (!paginationControlsContainer) return;
        paginationControlsContainer.innerHTML = '';
        if (totalPages <= 1) return;

        let paginationHTML = '';

        paginationHTML += `
          <button data-page="${currentPage - 1}"
                  class="px-3 py-1 rounded border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  ${currentPage === 1 ? 'disabled' : ''}>
            ก่อนหน้า
          </button>
        `;

        const maxPagesToShow = 7;
        const sidePages = Math.floor((maxPagesToShow - 3) / 2);
        const startPage = Math.max(2, currentPage - sidePages);
        const endPage = Math.min(totalPages - 1, currentPage + sidePages);

        paginationHTML += createPageButton(1, currentPage);
        if (startPage > 2) paginationHTML += `<span class="px-2">...</span>`;
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += createPageButton(i, currentPage);
        }
        if (endPage < totalPages - 1) paginationHTML += `<span class="px-2">...</span>`;
        if (totalPages > 1) paginationHTML += createPageButton(totalPages, currentPage);

        paginationHTML += `
          <button data-page="${currentPage + 1}"
                  class="px-3 py-1 rounded border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  ${currentPage === totalPages ? 'disabled' : ''}>
            ถัดไป
          </button>
        `;

        paginationControlsContainer.innerHTML = paginationHTML;

        paginationControlsContainer.querySelectorAll('button[data-page]').forEach(button => {
            button.addEventListener('click', (e) => {
                const targetPage = parseInt(e.currentTarget.getAttribute('data-page'));
                if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages && targetPage !== currentPage && !isLoadingEvents) {
                    loadEvents(targetPage);
                }
            });
        });
    }

    // --- createPageButton ---
    function createPageButton(pageNumber, currentPage) {
        const isCurrent = pageNumber === currentPage;
        const baseClasses = "px-3 py-1 rounded border border-slate-600";
        const activeClasses = "bg-indigo-600 text-white border-indigo-600";
        const inactiveClasses = "hover:bg-slate-700";
        return `<button data-page="${pageNumber}" class="${baseClasses} ${isCurrent ? activeClasses : inactiveClasses}" ${isCurrent ? 'aria-current="page"' : ''}>${pageNumber}</button>`;
    }

    // --- loadEvents ---
    async function loadEvents(page = 1) {
        if (isLoadingEvents) return;
        isLoadingEvents = true;
        if (eventList) eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-5 text-center text-slate-200 ring-1 ring-white/10 col-span-full">กำลังโหลดกิจกรรม...</li>`;
        if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';

        try {
            const res = await fetch(`${API_BASE}/events?page=${page}&limit=${eventsPerPage}&ts=${Date.now()}`, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();

            ALL_EVENTS_CURRENT_PAGE = data.items || [];
            currentPage = data.currentPage || page;
            totalPages = data.totalPages || 1;

            renderEvents(ALL_EVENTS_CURRENT_PAGE);
            renderPaginationControls(currentPage, totalPages);

        } catch (e) {
            console.error("Failed to load events:", e);
            if (eventList) eventList.innerHTML = `<li class="rounded-xl bg-rose-800/80 px-6 py-4 text-rose-100 ring-1 ring-white/10 col-span-full">⚠️ โหลดข้อมูลไม่สำเร็จ: ${e.message}</li>`;
            renderPaginationControls(1, 1);
        } finally {
            isLoadingEvents = false;
        }
    }

    // --- Search Logic ---
    function applySearch() {
      const q = (searchInput?.value || "").trim().toLowerCase();
      if (!q) {
        loadEvents(1);
        return;
      }
      const filtered = ALL_EVENTS_CURRENT_PAGE.filter(ev => {
        const f = (v) => String(v || "").toLowerCase();
        return [ev.title, ev.location, ev.dateText].some(v => f(v).includes(q));
      });
      renderEvents(filtered, q);
      if (paginationControlsContainer) paginationControlsContainer.innerHTML = '';
    }

    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const applySearchDebounced = debounce(applySearch, 250);

    searchBtn?.addEventListener('click', applySearch);
    searchInput?.addEventListener('input', applySearchDebounced);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
      if (e.key === 'Escape') { searchInput.value = ''; loadEvents(1); }
    });

    // --- loadMe ---
    async function loadMe() {
        try {
            const res = await fetch(`${API_BASE}/auth/me?ts=${Date.now()}`, {
                headers: { Authorization: "Bearer " + token },
                credentials: "include",
                cache: "no-store",
            });
            if (!res.ok) {
                console.error("Failed to fetch user data, redirecting to login.");
                localStorage.removeItem("token");
                location.href = "./index.html";
                return;
            }
            const json = await res.json().catch(() => ({}));
            const me = json.user || json;
            currentUser = me;

            const id = (x) => document.getElementById(x);
            const fullName = [me.firstName, me.lastName].filter(Boolean).join(" ").trim();
            id("ppName") && (id("ppName").textContent = fullName || "—");
            id("ppId")   && (id("ppId").textContent   = me.studentId ?? "—");
            id("ppEmail") && (id("ppEmail").textContent = me.email ?? "—");
            id("ppMajor") && (id("ppMajor").textContent = me.major ?? "—");
            id("ppPhone") && (id("ppPhone").textContent = me.phone ?? "—");

            const calFab = document.getElementById('calendarFab');
            const historyBtn = document.getElementById('historyBtn');
            const adminFabs = [fab, document.getElementById('fabReg'), document.getElementById('fabDel')];

            if (me.role === "admin") {
                adminFabs.forEach(el => el?.classList.remove("hidden"));
                calFab?.remove?.();
                historyBtn?.remove?.();
                document.getElementById('historyModal')?.remove?.();
            } else {
                adminFabs.forEach(el => el?.remove?.());
                calFab?.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Error in loadMe:", error);
            localStorage.removeItem("token");
            location.href = "./index.html";
        }
    }

    // --- wireLogout ---
    function wireLogout() {
        const btn = document.getElementById("logoutBtn");
        if (!btn) return;
        btn.addEventListener("click", async () => {
            try {
                await fetch(`${API_BASE}/auth/logout?ts=${Date.now()}`, {
                    method: "POST", credentials: "include", cache: "no-store",
                });
            } catch (e) { /* ignore */ }
            try {
                localStorage.removeItem("token");
                localStorage.removeItem("rltg:events:v1");
                sessionStorage.clear();
                if (window.caches) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.update()));
                }
            } catch (e) { /* ignore */ }
            location.replace("./index.html");
        });
    }

    // --- Add Event Form Logic ---
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
            await loadEvents(1);

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

    // --- Initial Load ---
    document.addEventListener("DOMContentLoaded", () => {
      loadMe().then(() => { loadEvents(1); })
        .catch((err) => { console.error("Initial loadMe failed:", err); });
      wireLogout();
    });

 })(); // End Main IIFE

 // -------------------- History modal (user) --------------------
 (function historyModal() {
  // ... (History modal code remains the same) ...
    const API_BASE = window.API_BASE;
  const btnOpen = document.getElementById('historyBtn');
  const modal = document.getElementById('historyModal');
  if (!btnOpen || !modal) return; // Exit if button/modal not found (e.g., for admin)

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
   if (!ul || !empty || !loading) return; // Add checks for elements
      ul.classList.add('hidden'); ul.innerHTML = ''; empty.classList.add('hidden'); loading.classList.remove('hidden');
   try {
    const items = await fetchMyRegistrations();
    loading.classList.add('hidden');
    if (!items.length) { empty.classList.remove('hidden'); return; }
    ul.innerHTML = items.map(it => { /* ... generate history item HTML ... */ }).join('');
    ul.classList.remove('hidden');
    ul.querySelectorAll('[data-remove]').forEach(btn => { /* ... add delete listener ... */ });
   } catch (err) { loading.textContent = 'โหลดไม่สำเร็จ: ' + err.message; }
  }

  btnOpen.addEventListener('click', () => { open(); loadHistory(); });
  btnClose?.addEventListener('click', close);
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
 })();

 // -------------------- Admin: Registrations Modal --------------------
 (function () {
  // ... (Admin code - ensure it uses loadEventsForAdminCacheOnly) ...
    const API_BASE = window.API_BASE;
  const token = localStorage.getItem("token");
  if (!token) return;

  const $ = (s) => document.querySelector(s);
  // NOTE: Admin code should NOT interact with the main #eventList rendering
  const fabAdd = $("#fabAdd");
  const fabReg = $("#fabReg");
  const fabDel = $("#fabDel");

    // UI elements for Modals
    const delUI = { wrap: document.getElementById('delModal'), overlay: document.querySelector('#delModal [data-overlay]'), close: document.getElementById('delClose'), close2: document.getElementById('delClose2'), loading: document.getElementById('delLoading'), empty: document.getElementById('delEmpty'), scroll: document.getElementById('delScroll'), list: document.getElementById('delList') };
    const regUI = { wrap: document.getElementById('regModal'), overlay: document.querySelector('#regModal [data-overlay]'), close: document.getElementById('regClose'), close2: document.getElementById('regClose2'), sumWrap: document.getElementById('regSummary'), sumScroll: document.getElementById('regScroll'), sumLoading: document.getElementById('regLoading'), sumEmpty: document.getElementById('regEmpty'), table: document.getElementById('regTable'), tbody: document.getElementById('regTbody'), detailWrap: document.getElementById('regDetail'), dScroll: document.getElementById('rdScroll'), dTitle: document.getElementById('rdTitle'), dDate: document.getElementById('rdDate'), dLoading: document.getElementById('rdLoading'), dEmpty: document.getElementById('rdEmpty'), dTable: document.getElementById('rdTable'), dTbody: document.getElementById('rdTbody'), dBack: document.getElementById('rdBack') };

    const esc = window.escapeHtml ?? (s => s);
    const fmt = window.formatDateLabel ?? (s => s);
    let RD_CURRENT_ROWS = []; // For CSV export

    function toDisplayDate(s) { if (!s) return '—'; const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s); if (isNaN(d)) return '—'; const day = d.getDate(), month = d.getMonth() + 1, year = d.getFullYear() + 543; return `${day}/${month}/${String(year).slice(-2)}`; }
    function showModal(el) { el?.classList.remove('hidden'); document.documentElement.classList.add('overflow-hidden'); const p = el?.querySelector('.modal-enter'); if (p) requestAnimationFrame(() => p.classList.add('modal-enter-active')); }
    function hideModal(el) { const p = el?.querySelector('.modal-enter'); if (p) p.classList.remove('modal-enter-active'); setTimeout(() => { el?.classList.add('hidden'); document.documentElement.classList.remove('overflow-hidden'); }, 180); }
    function listify(j) { if (!j) return []; if (Array.isArray(j)) return j; if (Array.isArray(j.items)) return j.items; if (Array.isArray(j.data)) return j.data; if (Array.isArray(j.results)) return j.results; return []; }
    async function tryJson(url) { try { const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store' }); if (!res.ok) return null; return await res.json().catch(() => null); } catch { return null; } }
    async function fetchEventCounts() { try { const r = await fetch(`${API_BASE}/events/admin/summary?ts=${Date.now()}`, { headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store' }); if (!r.ok) return {}; const list = await r.json().catch(() => []); const map = {}; list.forEach(it => { map[it.eventId] = it.count || 0; }); return map; } catch { return {}; } }
    function getRegEventId(reg) { if (!reg) return null; if (typeof reg.event === 'string') return reg.event; if (reg.event && typeof reg.event === 'object') return reg.event._id || null; return reg.eventId || reg.eventID || reg.event_id || null; }
    const coalesce = (...vals) => { for (const v of vals) { if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim(); } return undefined; };


    let CURRENT_USER_ADMIN = null;
    let EVENTS_CACHE_ADMIN = [];

    async function loadMeAdmin() {
      const res = await fetch(`${API_BASE}/auth/me?ts=${Date.now()}`, { headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      CURRENT_USER_ADMIN = j.user || j;
    }

    async function loadEventsForAdminCacheOnly() {
      const res = await fetch(`${API_BASE}/events?page=1&limit=999&ts=${Date.now()}`, { credentials: 'include', cache: 'no-store' }); // Fetch all for admin cache
      const data = await res.json().catch(() => ({ items: [] }));
      EVENTS_CACHE_ADMIN = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
    }

    (async function initAdmin() {
      await loadMeAdmin();
      if (CURRENT_USER_ADMIN?.role !== 'admin') return;
      await loadEventsForAdminCacheOnly();
    })().catch((err) => { console.error("Admin Init Error:", err)});

    // --- Delete Modal Logic ---
    function openDelModal() {
        if (CURRENT_USER_ADMIN?.role !== 'admin' || !delUI.wrap) return;
        delUI.loading?.classList.remove('hidden'); delUI.empty?.classList.add('hidden'); delUI.scroll?.classList.add('hidden'); delUI.list.innerHTML = '';
        showModal(delUI.wrap);
        const items = EVENTS_CACHE_ADMIN || [];
        delUI.loading?.classList.add('hidden');
        if (!items.length) { delUI.empty?.classList.remove('hidden'); return; }
        delUI.list.innerHTML = items.map(ev => `
          <li class="rounded-xl border border-slate-200 bg-white/60 p-4 flex items-center justify-between gap-3">
            <div><div class="font-semibold">${esc(ev.title || '(...)')}</div><div class="text-sm text-slate-500">${fmt(ev.dateText)} • ${esc(ev.location || '—')}</div></div>
            <button data-del="${ev._id}" class="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500">ลบ</button>
          </li>`).join('');
        delUI.scroll?.classList.remove('hidden');

        delUI.list.querySelectorAll('button[data-del]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-del');
                const ev = EVENTS_CACHE_ADMIN.find(e => e._id === id);
                const name = ev?.title || '';
                // ... (confirm deletion logic) ...
                if (window.Swal) { /* ... Swal confirm ... */ } else if (!confirm(`ยืนยันลบ: ${name}`)) return;

                btn.disabled = true;
                try {
                    const r = await fetch(`${API_BASE}/events/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token }, credentials: 'include', cache: 'no-store' });
                    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || r.status); }

                    EVENTS_CACHE_ADMIN = EVENTS_CACHE_ADMIN.filter(e => e._id !== id);
                    btn.closest('li')?.remove();
                    if (!delUI.list.children.length) { delUI.scroll?.classList.add('hidden'); delUI.empty?.classList.remove('hidden'); }

                    // Trigger reload of the main event list using the globally available loadEvents
                    // Need access to 'currentPage' and 'loadEvents' from the parent scope
                    const mainScope = window; // Assuming loadEvents is global or accessible via window
                    if (mainScope.loadEvents && typeof mainScope.currentPage !== 'undefined') {
                      const listItemsLeftOnPage = document.querySelectorAll('#eventList > li').length - 1;
                      if (listItemsLeftOnPage <= 0 && mainScope.currentPage > 1) {
                        await mainScope.loadEvents(mainScope.currentPage - 1);
                      } else {
                        await mainScope.loadEvents(mainScope.currentPage);
                      }
                    }

                    toastOK('ลบสำเร็จ');
                } catch (e) { toastError('ลบไม่สำเร็จ', e.message || '');
                } finally { btn.disabled = false; }
            });
        });
    }
    fabDel?.addEventListener('click', openDelModal);
    delUI.overlay?.addEventListener('click', () => hideModal(delUI.wrap));
    delUI.close?.addEventListener('click', () => hideModal(delUI.wrap));
    delUI.close2?.addEventListener('click', () => hideModal(delUI.wrap));

    // --- Registrations Modal Logic ---
    // ... (Rest of Admin code: fetchAllRegistrations, fetchRegistrationsByEvent, openRegModal, CSV export, etc.) ...
     async function fetchAllRegistrations() { /* ... */ }
     async function fetchRegistrationsByEvent(eventId) { /* ... */ }
     function countFromEvent(ev) { /* ... */ }

     async function openRegModal() {
        if (CURRENT_USER_ADMIN?.role !== 'admin' || !regUI.wrap) return;
        regUI.sumLoading?.classList.remove('hidden'); regUI.sumWrap?.classList.remove('hidden'); regUI.detailWrap?.classList.add('hidden'); regUI.sumEmpty?.classList.add('hidden'); regUI.table?.classList.add('hidden'); if(regUI.tbody) regUI.tbody.innerHTML = ''; regUI.sumScroll?.scrollTo?.(0, 0);
        showModal(regUI.wrap);
        let events = EVENTS_CACHE_ADMIN;
        if (!events.length) { const r = await fetch(`${API_BASE}/events?page=1&limit=999&ts=${Date.now()}`, { credentials: 'include', cache: 'no-store' }); const data = await r.json().catch(() => ({ items: [] })); events = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []); EVENTS_CACHE_ADMIN = events; } // Refetch if cache is empty
        const COUNTS = await fetchEventCounts();
        if(regUI.tbody) regUI.tbody.innerHTML = events.map(ev => { const c = COUNTS[ev._id] ?? 0; return `<tr class="border-t"><td class="py-2 pr-3">${esc(ev.title || '(...)')}</td><td class="py-2 pr-3">${toDisplayDate(ev.dateText)}</td><td class="py-2 pr-3">${c}</td><td class="py-2"><button data-view="${ev._id}" class="...">ดูรายชื่อ</button></td></tr>`; }).join("");
        regUI.sumLoading?.classList.add('hidden');
        if (!events.length) regUI.sumEmpty?.classList.remove('hidden'); else regUI.table?.classList.remove('hidden');
        regUI.tbody?.querySelectorAll('button[data-view]').forEach(btn => { btn.addEventListener('click', async () => { const id = btn.getAttribute('data-view'); const ev = events.find(e => e._id === id) || {}; await openRegDetail(ev); }); });
     }
     function sanitizeFilename(s = '') { return String(s).replace(/[\/\\?%*:|"<>]/g, '_').trim() || 'export'; }
     function toCSV(rows) { const header = ['ชื่อ', 'รหัสนักศึกษา', 'คณะ', 'E-mail', 'เบอร์โทรศัพท์', 'ที่อยู่ (ตอนลงทะเบียน)']; const escCSV = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }; const lines = [header.map(escCSV).join(',')]; for (const r of rows) { lines.push([r.name, r.idnum, r.faculty, r.email, r.phone, r.addr].map(escCSV).join(',')); } return lines.join('\n'); }
     function downloadCSVFile(filename, csvText) { const BOM = '\uFEFF'; const blob = new Blob([BOM + csvText], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename.endsWith('.csv') ? filename : filename + '.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
     async function openRegDetail(ev) {
        if (!regUI.detailWrap || !regUI.sumWrap || !regUI.dTitle || !regUI.dDate || !regUI.dLoading || !regUI.dEmpty || !regUI.dTable || !regUI.dTbody) return;
        regUI.detailWrap.classList.remove('hidden'); regUI.sumWrap.classList.add('hidden'); regUI.dScroll?.scrollTo?.(0, 0); regUI.dTitle.textContent = ev.title || '(...)'; regUI.dDate.textContent = toDisplayDate(ev.dateText); regUI.dLoading.classList.remove('hidden'); regUI.dEmpty.classList.add('hidden'); regUI.dTable.classList.add('hidden'); regUI.dTbody.innerHTML = ''; RD_CURRENT_ROWS = []; document.getElementById('rdExport')?.setAttribute('disabled', 'true');
        let regs = await fetchRegistrationsByEvent(ev._id);
        // if (!regs.length) { const all = await fetchAllRegistrations(); if (Array.isArray(all)) regs = all.filter(r => getRegEventId(r) === ev._id); } // Optionally re-fetch all if specific fetch fails
        regUI.dLoading.classList.add('hidden');
        if (!regs.length) { regUI.dEmpty.classList.remove('hidden'); return; }
        regUI.dTbody.innerHTML = regs.map(r => { const u = r.user || {}; const first = coalesce(u.firstName, r.firstName); const last = coalesce(u.lastName, r.lastName); const name = coalesce([first, last].filter(Boolean).join(' ').trim(), u.fullName, r.fullName, u.username, '—'); const idnum = coalesce(u.studentId, r.studentId, '—'); const faculty = coalesce(u.faculty, u.major, r.faculty, r.major, '—'); const email = coalesce(u.email, r.email, '—'); const phone = coalesce(u.phone, r.phone, '—'); const addr = coalesce(r.address, '—'); return `<tr class="border-t"><td class="py-2 pr-3">${esc(name)}</td><td class="py-2 pr-3">${esc(idnum)}</td><td class="py-2 pr-3">${esc(faculty)}</td><td class="py-2 pr-3">${esc(email)}</td><td class="py-2 pr-3">${esc(phone)}</td><td class="py-2 pr-3">${esc(addr)}</td></tr>`; }).join('');
        RD_CURRENT_ROWS = regs.map(r => { const u = r.user || {}; const first = coalesce(u.firstName, r.firstName); const last = coalesce(u.lastName, r.lastName); const name = coalesce([first, last].filter(Boolean).join(' ').trim(), u.fullName, r.fullName, u.username, '—'); const idnum = coalesce(u.studentId, r.studentId, '—'); const faculty = coalesce(u.faculty, u.major, r.faculty, r.major, '—'); const email = coalesce(u.email, r.email, '—'); const phone = coalesce(u.phone, r.phone, '—'); const addr = coalesce(r.address, '—'); return { name, idnum, faculty, email, phone, addr }; });
        regUI.dTable.classList.remove('hidden'); document.getElementById('rdExport')?.removeAttribute('disabled');
     }
     fabReg?.addEventListener('click', openRegModal);
     regUI.overlay?.addEventListener('click', () => hideModal(regUI.wrap));
     regUI.close?.addEventListener('click', () => hideModal(regUI.wrap));
     regUI.close2?.addEventListener('click', () => hideModal(regUI.wrap));
     regUI.dBack?.addEventListener('click', () => { regUI.detailWrap?.classList.add('hidden'); regUI.sumWrap?.classList.remove('hidden'); regUI.sumScroll?.scrollTo?.(0, 0); });
     document.getElementById('rdExport')?.addEventListener('click', () => { if (!RD_CURRENT_ROWS.length) return; const title = regUI.dTitle?.textContent || 'export'; const date = regUI.dDate?.textContent || ''; const filename = sanitizeFilename(`${title} ${date}`.trim()); const csv = toCSV(RD_CURRENT_ROWS); downloadCSVFile(filename, csv); });

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