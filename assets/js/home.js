(() => {
  // ==================== Globals / Utils ====================
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  window.API_BASE = isLocal ? "http://localhost:4000/api" : "/api";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function clamp(n, a, b) { return Math.max(a, Math.min(n, b)); }
  function pad2(n) { return String(n).padStart(2, "0"); }

  // Date label in BE (Thai) yy  
  window.formatDateLabel = function (s) {
    if (!s) return "—";
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
    if (Number.isNaN(+d)) return String(s);
    const day = d.getDate(), month = d.getMonth() + 1, yearBE = d.getFullYear() + 543;
    return `${pad2(day)}/${pad2(month)}/${String(yearBE).slice(-2)}`;
  };

  window.escapeHtml = (t = "") => t.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  function toast(kind, title, text) {
    if (window.Swal) {
      Swal.fire({ title, text, icon: kind, confirmButtonText: "OK" });
    } else {
      alert((title ? title + "\n" : "") + (text || ""));
    }
  }
  function toastError(t, m) { toast("error", t, m); }
  function toastOK(t, m) { toast("success", t, m); }

  // Fetch helper with timeout + auth + no-store
  async function fetchJSON(url, { method = "GET", headers = {}, body, auth = false, timeout = 10000 } = {}) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    const h = new Headers(headers);
    if (auth) {
      const token = localStorage.getItem("token");
      if (token) h.set("Authorization", "Bearer " + token);
    }
    const res = await fetch(url, { method, headers: h, body, credentials: "include", cache: "no-store", signal: ctrl.signal });
    clearTimeout(id);
    const type = res.headers.get("content-type") || "";
    const maybeJSON = type.includes("application/json");
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      if (maybeJSON) { try { const j = await res.json(); msg = j?.message || msg; } catch {} }
      throw new Error(msg);
    }
    return maybeJSON ? res.json() : res.text();
  }

  // ==================== Notifications ====================
  (function notifications() {
    const btn = $("#notifBtn");
    const modal = $("#notifModal");
    const card = $("#notifCard");
    if (!btn || !modal || !card) return;

    const overlay = modal.querySelector("[data-overlay]");
    const closeBtn = modal.querySelector("[data-close]");
    const badge = $("#notifBadge");
    const listEl = $("#notifList");
    const emptyEl = $("#notifEmpty");
    let NOTIFICATIONS = [];

    function place() {
      const r = btn.getBoundingClientRect(), gap = 10, width = card.offsetWidth || 360;
      const left = clamp(r.right - width + 48, 8, window.innerWidth - width - 8);
      const top = r.bottom + gap;
      card.style.left = left + "px";
      card.style.top = top + "px";
    }
    function open() { modal.classList.remove("hidden"); requestAnimationFrame(place); window.addEventListener("resize", place, { passive: true }); markAsRead(); }
    function close() { modal.classList.add("hidden"); window.removeEventListener("resize", place); }

    btn.addEventListener("click", open, { passive: true });
    overlay?.addEventListener("click", close, { passive: true });
    closeBtn?.addEventListener("click", close, { passive: true });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.classList.contains("hidden")) close(); });

    function render() {
      const unread = NOTIFICATIONS.filter(n => !n.read).length;
      if (badge) { if (unread > 0) { badge.textContent = unread > 9 ? "9+" : String(unread); badge.classList.remove("hidden"); } else { badge.classList.add("hidden"); } }
      if (!listEl || !emptyEl) return;
      if (!NOTIFICATIONS.length) { listEl.innerHTML = ""; emptyEl.classList.remove("hidden"); return; }
      emptyEl.classList.add("hidden");
      listEl.innerHTML = NOTIFICATIONS.map(n => {
        const isUnread = !n.read ? "bg-indigo-50" : "bg-white";
        const link = n.eventId ? `./event.html?id=${n.eventId}` : "#";
        const date = n.createdAt ? new Date(n.createdAt).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
        return `
          <a href="${link}" class="block p-3 rounded-lg hover:bg-slate-100 ${isUnread}">
            <div class="flex items-start gap-3">
              ${!n.read ? '<div class="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0"></div>' : '<div class="h-2 w-2 shrink-0"></div>'}
              <div class="flex-1">
                <p class="text-sm text-slate-800">${window.escapeHtml(n.message || "")}</p>
                <p class="text-xs text-slate-500 mt-1">${date}</p>
              </div>
            </div>
          </a>`;
      }).join("");
    }

    async function loadNotifications() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        NOTIFICATIONS = await fetchJSON(`${window.API_BASE}/notifications/me?ts=${Date.now()}`, { auth: true });
        if (!Array.isArray(NOTIFICATIONS)) NOTIFICATIONS = [];
        render();
      } catch (e) { console.error("Failed to load notifications:", e); }
    }

    async function markAsRead() {
      if (!NOTIFICATIONS.some(n => !n.read)) return;
      NOTIFICATIONS.forEach(n => (n.read = true));
      render();
      try { await fetchJSON(`${window.API_BASE}/notifications/me/mark-as-read`, { method: "POST", auth: true }); } catch (e) { console.error("Failed to mark read:", e); }
    }

    loadNotifications();
  })();

  // ==================== Apple TV-like Hero ====================
  (function hero() {
    const stage = $("#tvStage");
    if (!stage) return;

    const IMAGES = [
      "assets/hero/1.v2.jpg",
      "assets/hero/2.v2.jpg",
      "assets/hero/3.v2.jpg",
      "assets/hero/4.v2.jpg",
      "assets/hero/5.v2.jpg",
      "assets/hero/6.v2.jpg",
    ];

    const dotsWrap = $("#tvDots");
    const btnPrev = $("#tvPrev");
    const btnNext = $("#tvNext");
    const btnToggle = $("#tvToggle");

    function makeSlide(src, i) {
      const eager = i === 0 ? "eager" : "lazy";
      const prio = i === 0 ? "high" : "auto";
      const el = document.createElement("div");
      el.className = "tv-slide";
      el.innerHTML = `
        <img src="${src}" srcset="${src} 1600w" sizes="(max-width: 1024px) 100vw, 1100px" width="1600" height="900" alt="" loading="${eager}" fetchpriority="${prio}" decoding="async" referrerpolicy="no-referrer" crossorigin="anonymous">
        <div class="fade"></div>`;
      const img = el.querySelector("img");
      el.dataset.loading = "1";
      img.addEventListener("load", () => { delete el.dataset.loading; }, { once: true });
      img.addEventListener("error", () => { img.src = "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop"; }, { once: true });
      stage.appendChild(el);
      return el;
    }

    const slides = IMAGES.map(makeSlide);
    const dots = IMAGES.map((_, i) => {
      const b = document.createElement("button");
      b.className = "dot";
      b.addEventListener("click", () => goTo(i));
      dotsWrap?.appendChild(b);
      return b;
    });

    let index = 0, timer = null, playing = true;
    const INTERVAL = 6000;

    function apply() {
      const n = slides.length, L = (index - 1 + n) % n, R = (index + 1) % n;
      slides.forEach((sl, i) => {
        sl.classList.remove("is-center", "is-left", "is-right", "is-hidden");
        if (i === index) sl.classList.add("is-center");
        else if (i === L) sl.classList.add("is-left");
        else if (i === R) sl.classList.add("is-right");
        else sl.classList.add("is-hidden");
        const img = sl.querySelector("img");
        if (i === index) { img.style.animation = "none"; /* restart CSS animation */ void img.offsetHeight; img.style.animation = ""; }
      });
      dots.forEach((d, i) => d?.classList.toggle("active", i === index));
    }
    function goTo(i) { index = (i + slides.length) % slides.length; apply(); restart(); }
    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);
    function start() { if (playing && !timer) timer = setInterval(next, INTERVAL); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); start(); }

    btnNext?.addEventListener("click", next, { passive: true });
    btnPrev?.addEventListener("click", prev, { passive: true });
    btnToggle?.addEventListener("click", () => { playing = !playing; btnToggle.textContent = playing ? "⏸" : "▶︎"; playing ? start() : stop(); });

    stage.tabIndex = 0;
    stage.addEventListener("keydown", e => { if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); });

    let sx = 0, dx = 0;
    stage.addEventListener("touchstart", e => { sx = e.touches[0].clientX; dx = 0; stop(); }, { passive: true });
    stage.addEventListener("touchmove", e => { dx = e.touches[0].clientX - sx; }, { passive: true });
    stage.addEventListener("touchend", () => { if (Math.abs(dx) > 40) (dx < 0 ? next() : prev()); if (playing) start(); }, { passive: true });

    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

    apply(); start();

    ["tvDotsWrap", "tvToggle", "tvPrev", "tvNext"].forEach(id => { const el = document.getElementById(id); if (el) stage.appendChild(el); });

    (window.requestIdleCallback || setTimeout)(() => {
      ["2.v2.jpg", "3.v2.jpg"].forEach(name => { const i = new Image(); i.referrerPolicy = "no-referrer"; i.src = `/assets/hero/${name}`; });
    }, 0);
  })();

  // ==================== Profile Modal ====================
  (function profileModal() {
    const btn = $("#profileBtn");
    const modal = $("#profileModal");
    const card = $("#profileCard");
    if (!btn || !modal || !card) return;

    const overlay = modal.querySelector("[data-overlay]");
    const closeBtn = modal.querySelector("[data-close]");
    let lastActive = null;

    function place() {
      const r = btn.getBoundingClientRect(), gap = 10, width = card.offsetWidth || 360;
      const left = clamp(r.right - width, 8, window.innerWidth - width - 8);
      const top = clamp(r.bottom + gap, 8, window.innerHeight - card.offsetHeight - 8);
      card.style.left = left + "px";
      card.style.top = top + "px";
    }
    function lockScroll(lock) {
      const el = document.scrollingElement || document.documentElement;
      if (lock) { el.dataset.prevOverflow = el.style.overflow || ""; el.style.overflow = "hidden"; document.body.classList.add("overflow-hidden"); }
      else { el.style.overflow = el.dataset.prevOverflow || ""; document.body.classList.remove("overflow-hidden"); delete el.dataset.prevOverflow; }
    }
    function open() { lastActive = document.activeElement; modal.classList.remove("hidden"); lockScroll(true); requestAnimationFrame(place); window.addEventListener("resize", place, { passive: true }); }
    function close() { modal.classList.add("hidden"); lockScroll(false); lastActive?.focus?.(); window.removeEventListener("resize", place); }

    btn.addEventListener("click", open, { passive: true });
    overlay?.addEventListener("click", close, { passive: true });
    closeBtn?.addEventListener("click", close, { passive: true });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.classList.contains("hidden")) close(); });
  })();

  // ==================== Events: pagination / search / add ====================
  (function events() {
    const API_BASE = window.API_BASE;
    const token = localStorage.getItem("token");
    if (!token) { location.replace("./index.html"); return; }

    // Elements
    const eventList = $("#eventList");
    const paginationControlsContainer = $("#paginationControls");
    const searchInput = $("#searchInput");
    const searchBtn = $("#searchBtn");
    const fab = $("#fabAdd");
    const addModal = $("#addModal");
    const addForm = $("#addForm");
    const dateInput = $("#addDate");
    const addCancel = $("#addCancel");

    if (dateInput) {
      const offset = new Date().getTimezoneOffset() * 60000;
      dateInput.value = new Date(Date.now() - offset).toISOString().slice(0, 10);
    }

    // State
    let ALL_EVENTS_CURRENT_PAGE = [];
    let currentPage = 1;
    const eventsPerPage = 8;
    let totalPages = 1;
    let isLoadingEvents = false;
    let currentUser = null;

    // --- Renderers
    function normalizeImageSrc(raw) {
      const s = String(raw || "").trim();
      if (!s) return "";
      if (/^https?:\/\//i.test(s)) return s;
      const p = s.replace(/^\.\//, "");
      if (p.startsWith("assets/")) return "/" + p;
      if (p.startsWith("/")) return p;
      return "/" + p;
    }

    function renderEvents(items, q = "") {
      if (!eventList) return;
      if (!Array.isArray(items) || items.length === 0) {
        eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-5 text-center text-slate-200 ring-1 ring-white/10 col-span-full">${q ? `ไม่พบกิจกรรมที่ตรงกับ “${window.escapeHtml(q)}”` : "ยังไม่มีกิจกรรม"}</li>`;
        return;
      }
      eventList.innerHTML = items.map(ev => {
        const dateTxt = ev.dateText ? window.formatDateLabel(ev.dateText) : "—";
        const title = window.escapeHtml(ev.title || "Untitled Event");
        const eventUrl = `./event.html?id=${ev._id}`;
        const src = normalizeImageSrc(ev.imageUrl);
        const hasImage = !!src;
        const fallbackIcon = `
          <div class="absolute inset-0 bg-slate-700 grid place-items-center">
            <svg class="w-12 h-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </div>`;
        const imageEl = hasImage ? `<img src="${window.escapeHtml(src)}" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out">` : fallbackIcon;

        return `
          <li class="relative aspect-[16/11] rounded-xl overflow-hidden group shadow-lg bg-slate-800 ring-1 ring-white/10">
            ${imageEl}
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none"></div>
            <div class="absolute bottom-0 left-0 right-0 p-4 text-white z-10">
              <h3 class="text-lg font-semibold leading-tight mb-1 line-clamp-2">${title}</h3>
              <div class="flex items-center justify-between text-sm mt-2">
                <span class="text-slate-300">${dateTxt}</span>
                <a href="${eventUrl}" class="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors whitespace-nowrap">ดูรายละเอียด</a>
              </div>
            </div>
            <a href="${eventUrl}" class="absolute inset-0" aria-label="${title}"></a>
          </li>`;
      }).join("");
    }

    function createPageButton(pageNumber, current) {
      const isCurrent = pageNumber === current;
      const base = "px-3 py-1 rounded border border-slate-600";
      const on = "bg-indigo-600 text-white border-indigo-600";
      const off = "hover:bg-slate-700";
      return `<button data-page="${pageNumber}" class="${base} ${isCurrent ? on : off}" ${isCurrent ? 'aria-current="page"' : ""}>${pageNumber}</button>`;
    }

    function renderPaginationControls(current, total) {
      if (!paginationControlsContainer) return;
      paginationControlsContainer.innerHTML = "";
      if (total <= 1) return;

      let html = "";
      html += `<button data-page="${current - 1}" class="px-3 py-1 rounded border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${current === 1 ? "disabled" : ""}>ก่อนหน้า</button>`;

      const maxPagesToShow = 7;
      const side = Math.floor((maxPagesToShow - 3) / 2);
      const start = Math.max(2, current - side);
      const end = Math.min(total - 1, current + side);

      html += createPageButton(1, current);
      if (start > 2) html += `<span class="px-2">...</span>`;
      for (let i = start; i <= end; i++) html += createPageButton(i, current);
      if (end < total - 1) html += `<span class="px-2">...</span>`;
      if (total > 1) html += createPageButton(total, current);

      html += `<button data-page="${current + 1}" class="px-3 py-1 rounded border border-slate-600 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed" ${current === total ? "disabled" : ""}>ถัดไป</button>`;

      paginationControlsContainer.innerHTML = html;
      $$('button[data-page]', paginationControlsContainer).forEach(b => {
        b.addEventListener("click", e => {
          const target = parseInt(e.currentTarget.getAttribute("data-page"), 10);
          if (!Number.isNaN(target) && target !== current && !isLoadingEvents) loadEvents(target);
        });
      });
    }

    // --- Data
    async function loadEvents(page = 1) {
      if (isLoadingEvents) return; isLoadingEvents = true;
      if (eventList) eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-5 text-center text-slate-200 ring-1 ring-white/10 col-span-full">กำลังโหลดกิจกรรม...</li>`;
      if (paginationControlsContainer) paginationControlsContainer.innerHTML = "";
      try {
        const data = await fetchJSON(`${API_BASE}/events?page=${page}&limit=${eventsPerPage}&ts=${Date.now()}`);
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        ALL_EVENTS_CURRENT_PAGE = items;
        currentPage = Number(data?.currentPage || page) || page;
        totalPages = Number(data?.totalPages || 1) || 1;
        renderEvents(ALL_EVENTS_CURRENT_PAGE);
        renderPaginationControls(currentPage, totalPages);
      } catch (e) {
        console.error("Failed to load events:", e);
        if (eventList) eventList.innerHTML = `<li class="rounded-xl bg-rose-800/80 px-6 py-4 text-rose-100 ring-1 ring-white/10 col-span-full">⚠️ โหลดข้อมูลไม่สำเร็จ: ${window.escapeHtml(e.message || "")}</li>`;
        renderPaginationControls(1, 1);
      } finally { isLoadingEvents = false; }
    }

    // --- Search (เฉพาะหน้าปัจจุบัน)
    function applySearch() {
      const q = (searchInput?.value || "").trim().toLowerCase();
      if (!q) { renderEvents(ALL_EVENTS_CURRENT_PAGE); renderPaginationControls(currentPage, totalPages); return; }
      const filtered = ALL_EVENTS_CURRENT_PAGE.filter(ev => {
        const f = v => String(v || "").toLowerCase();
        return [ev.title, ev.location, ev.dateText].some(v => f(v).includes(q));
      });
      renderEvents(filtered, q);
      if (paginationControlsContainer) paginationControlsContainer.innerHTML = "";
    }
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const applySearchDebounced = debounce(applySearch, 250);

    searchBtn?.addEventListener("click", applySearch);
    searchInput?.addEventListener("input", applySearchDebounced);
    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); applySearch(); }
      if (e.key === "Escape") { searchInput.value = ""; loadEvents(1); }
    });

    // --- Add Event
    function openAdd() { addModal?.classList.remove("hidden"); }
    function closeAdd() { addModal?.classList.add("hidden"); addForm?.reset(); }
    addCancel?.addEventListener("click", closeAdd);
    fab?.addEventListener("click", openAdd);
    addModal?.querySelector("[data-overlay]")?.addEventListener("click", closeAdd);

    addForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = $("#addSubmitBtn");
      const fd = new FormData(addForm);
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "กำลังบันทึก..."; }
      try {
        await fetchJSON(`${API_BASE}/events`, { method: "POST", body: fd, auth: true });
        closeAdd();
        toastOK("เพิ่มกิจกรรมสำเร็จ!");
        await loadEvents(1);
      } catch (err) {
        console.error("Add event error:", err);
        toastError("เพิ่มกิจกรรมไม่สำเร็จ", err.message || "โปรดตรวจสอบข้อมูลแล้วลองอีกครั้ง");
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "บันทึก"; }
      }
    });

    // --- Me + Logout
    async function loadMe() {
      const json = await fetchJSON(`${API_BASE}/auth/me?ts=${Date.now()}`, { auth: true }).catch(() => ({}));
      const me = json?.user || json || {};
      currentUser = me;

      // update profile panel
      const id = (x) => document.getElementById(x);
      const fullName = [me.firstName, me.lastName].filter(Boolean).join(" ").trim();
      id("ppName") && (id("ppName").textContent = fullName || "—");
      id("ppId") && (id("ppId").textContent = me.studentId ?? "—");
      id("ppEmail") && (id("ppEmail").textContent = me.email ?? "—");
      id("ppMajor") && (id("ppMajor").textContent = me.major ?? "—");
      id("ppPhone") && (id("ppPhone").textContent = me.phone ?? "—");

      // toggle admin/user UI
      const calFab = $("#calendarFab");
      if (me.role === "admin") {
        fab?.classList.remove("hidden");
        $("#historyModal")?.remove?.();
        $("#historyBtn")?.remove?.();
        calFab?.remove?.();
      } else {
        calFab?.classList.remove("hidden");
      }
    }

    function wireLogout() {
      const btn = $("#logoutBtn");
      if (!btn) return;
      btn.addEventListener("click", async () => {
        try { await fetchJSON(`${API_BASE}/auth/logout?ts=${Date.now()}`, { method: "POST" }); } catch {}
        try {
          localStorage.removeItem("token");
          sessionStorage.clear();
          if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
          if ("serviceWorker" in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); }
        } catch {}
        location.replace("./index.html");
      });
    }

    document.addEventListener("DOMContentLoaded", () => {
      loadMe().then(() => loadEvents(1)).catch(() => { localStorage.removeItem("token"); location.replace("./index.html"); });
      wireLogout();
    });
  })();

  // ==================== History modal (user) ====================
  (function historyModal() {
    const API_BASE = window.API_BASE;
    const btnOpen = $("#historyBtn");
    const modal = $("#historyModal");
    if (!btnOpen || !modal) return;

    const btnClose = $("#historyClose");
    const overlay = modal.querySelector("[data-overlay]");
    const ul = $("#historyList");
    const empty = $("#historyEmpty");
    const loading = $("#historyLoading");

    const open = () => modal.classList.remove("hidden");
    const close = () => modal.classList.add("hidden");

    async function fetchMyRegistrations() {
      const opt = { auth: true };
      try {
        const j = await fetchJSON(`${API_BASE}/registrations/me?ts=${Date.now()}`, opt);
        return Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []);
      } catch (resErr) {
        try {
          const j2 = await fetchJSON(`${API_BASE}/auth/my-registrations?ts=${Date.now()}`, opt);
          return Array.isArray(j2?.items) ? j2.items : (Array.isArray(j2) ? j2 : []);
        } catch (e) { throw e; }
      }
    }

    async function loadHistory() {
      ul.classList.add("hidden"); ul.innerHTML = ""; empty.classList.add("hidden"); loading.classList.remove("hidden");
      try {
        const items = await fetchMyRegistrations();
        loading.classList.add("hidden");
        if (!items.length) { empty.classList.remove("hidden"); return; }
        ul.innerHTML = items.map(it => {
          const ev = it.event || {}; const title = ev.title || "(ไม่ระบุชื่อกิจกรรม)";
          const dateTxt = window.formatDateLabel(ev.dateText); const loc = ev.location || "—";
          const orphan = !ev._id;
          return `<li class="rounded-xl border border-slate-200 bg-white/60 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-semibold text-slate-900">${window.escapeHtml(title)} ${orphan ? '<span class="ml-2 text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">ถูกลบแล้ว</span>' : ""}</div>
                <div class="text-sm text-slate-500">${dateTxt} • ${window.escapeHtml(loc)}</div>
                ${it.address ? `<div class="mt-1 text-xs text-slate-500">address: ${window.escapeHtml(it.address)}</div>` : ""}
              </div>
              <div class="shrink-0 flex gap-2">
                ${orphan
                  ? `<button data-remove="${it._id}" class="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300">ลบออก</button>`
                  : `<a href="./event.html?id=${ev._id}" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700">ดูรายละเอียด</a>`}
              </div>
            </div>
          </li>`;
        }).join("");
        ul.classList.remove("hidden");
        $$('[data-remove]', ul).forEach(btn => btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-remove");
          try { await fetchJSON(`${API_BASE}/registrations/${id}`, { method: "DELETE", auth: true }); loadHistory(); } catch {}
        }));
      } catch (err) { loading.textContent = "โหลดไม่สำเร็จ: " + (err.message || ""); }
    }

    btnOpen.addEventListener("click", () => { open(); loadHistory(); });
    btnClose?.addEventListener("click", close);
    overlay?.addEventListener("click", close);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.classList.contains("hidden")) close(); });
  })();

  // ==================== Admin: Registrations / Delete ====================
  (function admin() {
    const API_BASE = window.API_BASE;
    const token = localStorage.getItem("token");
    if (!token) return; // not logged in

    const fabAdd = $("#fabAdd");
    const fabReg = $("#fabReg");
    const fabDel = $("#fabDel");

    const delUI = {
      wrap: $("#delModal"),
      overlay: $("#delModal [data-overlay]"),
      close: $("#delClose"),
      close2: $("#delClose2"),
      loading: $("#delLoading"),
      empty: $("#delEmpty"),
      scroll: $("#delScroll"),
      list: $("#delList"),
    };

    const regUI = {
      wrap: $("#regModal"),
      overlay: $("#regModal [data-overlay]"),
      close: $("#regClose"),
      close2: $("#regClose2"),
      sumWrap: $("#regSummary"),
      sumScroll: $("#regScroll"),
      sumLoading: $("#regLoading"),
      sumEmpty: $("#regEmpty"),
      table: $("#regTable"),
      tbody: $("#regTbody"),
      detailWrap: $("#regDetail"),
      dScroll: $("#rdScroll"),
      dTitle: $("#rdTitle"),
      dDate: $("#rdDate"),
      dLoading: $("#rdLoading"),
      dEmpty: $("#rdEmpty"),
      dTable: $("#rdTable"),
      dTbody: $("#rdTbody"),
      dBack: $("#rdBack"),
    };

    const esc = window.escapeHtml ?? (s => s);
    const fmt = window.formatDateLabel ?? (s => s);
    let RD_CURRENT_ROWS = [];
    let CURRENT_USER = null;
    let EVENTS_CACHE = [];

    function showModal(el) { el?.classList.remove("hidden"); document.documentElement.classList.add("overflow-hidden"); const p = el?.querySelector(".modal-enter"); if (p) requestAnimationFrame(() => p.classList.add("modal-enter-active")); }
    function hideModal(el) { const p = el?.querySelector(".modal-enter"); if (p) p.classList.remove("modal-enter-active"); setTimeout(() => { el?.classList.add("hidden"); document.documentElement.classList.remove("overflow-hidden"); }, 180); }

    function listify(j) { if (!j) return []; if (Array.isArray(j)) return j; if (Array.isArray(j.items)) return j.items; if (Array.isArray(j.data)) return j.data; if (Array.isArray(j.results)) return j.results; return []; }

    async function tryJson(url) { try { return await fetchJSON(url, { auth: true }); } catch { return null; } }

    async function fetchEventCounts() {
      const j = await tryJson(`${API_BASE}/events/admin/summary?ts=${Date.now()}`);
      const map = {};
      (Array.isArray(j) ? j : []).forEach(it => { map[it.eventId] = it.count || 0; });
      return map;
    }

    function getRegEventId(reg) {
      if (!reg) return null;
      if (typeof reg.event === "string") return reg.event;
      if (reg.event && typeof reg.event === "object") return reg.event._id || null;
      return reg.eventId || reg.eventID || reg.event_id || null;
    }
    function countFromEvent(ev) {
      if (ev == null) return null;
      if (typeof ev.registrationsCount === "number") return ev.registrationsCount;
      if (typeof ev.registrationCount === "number") return ev.registrationCount;
      if (typeof ev.attendeesCount === "number") return ev.attendeesCount;
      if (typeof ev.participantsCount === "number") return ev.participantsCount;
      if (Array.isArray(ev.registrations)) return ev.registrations.length;
      if (Array.isArray(ev.attendees)) return ev.attendees.length;
      return null;
    }

    async function loadMe() {
      const j = await fetchJSON(`${API_BASE}/auth/me?ts=${Date.now()}`, { auth: true }).catch(() => ({}));
      CURRENT_USER = j?.user || j || {};
      if (CURRENT_USER?.role === "admin") {
        fabAdd?.classList.remove("hidden");
        fabReg?.classList.remove("hidden");
        fabDel?.classList.remove("hidden");
        $("#calendarFab")?.remove?.();
      }
    }

    async function loadEventsForAdminCacheOnly() {
      const j = await fetchJSON(`${API_BASE}/events?ts=${Date.now()}`).catch(() => []);
      EVENTS_CACHE = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []);
    }

    (async function initAdmin() {
      await loadMe();
      if (CURRENT_USER?.role !== "admin") return;
      await loadEventsForAdminCacheOnly();
    })().catch(() => {});

    function openDelModal() {
      if (!delUI.wrap) return;
      delUI.loading?.classList.remove("hidden");
      delUI.empty?.classList.add("hidden");
      delUI.scroll?.classList.add("hidden");
      delUI.list.innerHTML = "";
      showModal(delUI.wrap);

      const items = EVENTS_CACHE || [];
      delUI.loading?.classList.add("hidden");
      if (!items.length) { delUI.empty?.classList.remove("hidden"); return; }

      delUI.list.innerHTML = items.map(ev => `
        <li class="rounded-xl border border-slate-200 bg-white/60 p-4 flex items-center justify-between gap-3">
          <div>
            <div class="font-semibold">${esc(ev.title || "(ไม่ระบุชื่อกิจกรรม)")}</div>
            <div class="text-sm text-slate-500">${fmt(ev.dateText)} • ${esc(ev.location || "—")}</div>
          </div>
          <button data-del="${ev._id}" class="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500">ลบ</button>
        </li>`).join("");
      delUI.scroll?.classList.remove("hidden");

      $$('button[data-del]', delUI.list).forEach(btn => btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        const ev = EVENTS_CACHE.find(e => e._id === id);
        const name = ev?.title || "";
        if (window.Swal) {
          const c = await Swal.fire({ title: "ยืนยันลบกิจกรรมนี้?", text: name, icon: "question", showCancelButton: true, confirmButtonText: "ลบ", cancelButtonText: "ยกเลิก", confirmButtonColor: "#e11d48" });
          if (!c.isConfirmed) return;
        } else if (!confirm(`ยืนยันลบ: ${name}`)) { return; }

        btn.disabled = true;
        try {
          await fetchJSON(`${API_BASE}/events/${id}`, { method: "DELETE", auth: true });
          EVENTS_CACHE = EVENTS_CACHE.filter(e => e._id !== id);
          btn.closest("li")?.remove();
          document.querySelector(`#eventList a[href="./event.html?id=${id}"]`)?.closest("li")?.remove();
          if (!delUI.list.children.length) { delUI.scroll?.classList.add("hidden"); delUI.empty?.classList.remove("hidden"); }
          toastOK("ลบสำเร็จ");
        } catch (e) { toastError("ลบไม่สำเร็จ", e.message || ""); }
        finally { btn.disabled = false; }
      }));
    }
    fabDel?.addEventListener("click", openDelModal);

    async function fetchAllRegistrations() {
      const urls = [
        `${API_BASE}/registrations`,
        `${API_BASE}/admin/registrations`,
        `${API_BASE}/registration`,
      ];
      for (const u of urls) { const j = await tryJson(u); if (j !== null) return listify(j); }
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
      for (const u of urls) { const j = await tryJson(u); if (j !== null) return listify(j); }
      return [];
    }

    async function openRegModal() {
      const wrap = regUI.wrap; if (!wrap) return;

      regUI.sumLoading.classList.remove("hidden");
      regUI.sumWrap.classList.remove("hidden");
      regUI.detailWrap.classList.add("hidden");
      regUI.sumEmpty.classList.add("hidden");
      regUI.table.classList.add("hidden");
      regUI.tbody.innerHTML = "";
      regUI.sumScroll?.scrollTo?.(0, 0);
      showModal(wrap);

      let events = EVENTS_CACHE;
      if (!events.length) {
        const j = await fetchJSON(`${API_BASE}/events?ts=${Date.now()}`).catch(() => []);
        events = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : []);
      }

      const allMaybe = await fetchAllRegistrations();
      const allList = Array.isArray(allMaybe) ? allMaybe : (allMaybe === undefined ? undefined : listify(allMaybe));

      let rows = [];
      if (allList === undefined || allList.length === 0) {
        rows = events.map(ev => ({ ev, count: countFromEvent(ev) }));
      } else {
        const map = new Map();
        allList.forEach(reg => { const id = getRegEventId(reg); if (!id) return; map.set(id, (map.get(id) || 0) + 1); });
        rows = events.map(ev => ({ ev, count: (countFromEvent(ev) ?? map.get(ev._id) ?? 0) }));
      }

      const COUNTS = await fetchEventCounts();
      regUI.tbody.innerHTML = events.map(ev => {
        const c = COUNTS[ev._id] ?? 0;
        return `<tr class="border-t">
          <td class="py-2 pr-3">${esc(ev.title || "(ไม่ระบุชื่อกิจกรรม)")}</td>
          <td class="py-2 pr-3">${fmt(ev.dateText)}</td>
          <td class="py-2 pr-3">${c}</td>
          <td class="py-2"><button data-view="${ev._id}" class="px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800">ดูรายชื่อ</button></td>
        </tr>`;
      }).join("");

      regUI.sumLoading.classList.add("hidden");
      if (!rows.length) regUI.sumEmpty.classList.remove("hidden"); else regUI.table.classList.remove("hidden");

      $$('button[data-view]', regUI.tbody).forEach(btn => btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-view");
        const ev = events.find(e => e._id === id) || {};
        await openRegDetail(ev);
      }));

      async function openRegDetail(ev) {
        regUI.detailWrap.classList.remove("hidden");
        regUI.sumWrap.classList.add("hidden");
        regUI.dScroll?.scrollTo?.(0, 0);
        regUI.dTitle.textContent = ev.title || "(ไม่ระบุชื่อกิจกรรม)";
        regUI.dDate.textContent = fmt(ev.dateText);
        regUI.dLoading.classList.remove("hidden");
        regUI.dEmpty.classList.add("hidden");
        regUI.dTable.classList.add("hidden");
        regUI.dTbody.innerHTML = "";
        RD_CURRENT_ROWS = [];
        $("#rdExport")?.setAttribute("disabled", "true");

        let regs = await fetchRegistrationsByEvent(ev._id);
        if (!regs.length) {
          const all = await fetchAllRegistrations();
          if (Array.isArray(all)) regs = all.filter(r => getRegEventId(r) === ev._id);
        }

        regUI.dLoading.classList.add("hidden");
        if (!regs.length) { regUI.dEmpty.classList.remove("hidden"); return; }

        const coalesce = (...vals) => {
          for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
          return undefined;
        };

        regUI.dTbody.innerHTML = regs.map(r => {
          const u = r.user || r.profile || r.account || {};
          const first = coalesce(u.firstName, u.firstname, u.first_name, u.givenName, u.given_name, r.firstName, r.firstname, r.first_name, r.givenName, r.given_name);
          const last = coalesce(u.lastName, u.lastname, u.last_name, u.familyName, u.family_name, r.lastName, r.lastname, r.last_name, r.familyName, r.family_name);
          const fullFromParts = [first, last].filter(Boolean).join(" ").trim();
          const name = coalesce(fullFromParts, u.fullName, u.fullname, u.name, r.fullName, r.fullname, r.name, u.username, r.username, "—");
          const idnum = coalesce(u.studentId, u.idNumber, r.studentId, r.idNumber, r.sid, "—");
          const faculty = coalesce(u.faculty, u.fac, u.facultyName, u.department, u.major, u.school, u.college, r.faculty, r.fac, r.facultyName, r.department, r.major, r.school, r.college, "—");
          const email = coalesce(u.email, r.email, "—");
          const phone = coalesce(u.phone, u.tel, r.phone, r.tel, "—");
          const addr = coalesce(r.address, r.addr, r.registrationAddress, r.contactAddress, "—");
          return `<tr class="border-t">
            <td class="py-2 pr-3">${esc(name)}</td>
            <td class="py-2 pr-3">${esc(idnum)}</td>
            <td class="py-2 pr-3">${esc(faculty)}</td>
            <td class="py-2 pr-3">${esc(email)}</td>
            <td class="py-2 pr-3">${esc(phone)}</td>
            <td class="py-2 pr-3">${esc(addr)}</td>
          </tr>`;
        }).join("");

        RD_CURRENT_ROWS = regs.map(r => {
          const u = r.user || r.profile || r.account || {};
          const first = u.firstName || u.firstname || u.first_name || u.givenName || u.given_name || r.firstName || r.firstname || r.first_name || r.givenName || r.given_name;
          const last = u.lastName || u.lastname || u.last_name || u.familyName || u.family_name || r.lastName || r.lastname || r.last_name || r.familyName || r.family_name;
          const fullFromParts = [first, last].filter(Boolean).join(" ").trim();
          const name = fullFromParts || u.fullName || u.fullname || u.name || r.fullName || r.fullname || r.name || u.username || r.username || "—";
          const idnum = u.studentId || u.idNumber || r.studentId || r.idNumber || r.sid || "—";
          const faculty = u.faculty || u.fac || u.facultyName || u.department || u.major || u.school || u.college || r.faculty || r.fac || r.facultyName || r.department || r.major || r.school || r.college || "—";
          const email = u.email || r.email || "—";
          const phone = u.phone || u.tel || r.phone || r.tel || "—";
          const addr = r.address || r.addr || r.registrationAddress || r.contactAddress || "—";
          return { name, idnum, faculty, email, phone, addr };
        });

        regUI.dTable.classList.remove("hidden");
        $("#rdExport")?.removeAttribute("disabled");
      }

      function sanitizeFilename(s = "") { return String(s).replace(/[\/\\?%*:|"<>]/g, "_").trim() || "export"; }
      function toCSV(rows) {
        const header = ["ชื่อ", "รหัสนักศึกษา", "คณะ", "E-mail", "เบอร์โทรศัพท์", "ที่อยู่ (ตอนลงทะเบียน)"];
        const escCSV = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
        const lines = [header.map(escCSV).join(",")];
        for (const r of rows) lines.push([r.name, r.idnum, r.faculty, r.email, r.phone, r.addr].map(escCSV).join(","));
        return lines.join("\n");
      }
      function downloadCSVFile(filename, csvText) {
        const BOM = "\uFEFF";
        const blob = new Blob([BOM + csvText], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      }

      fabReg?.addEventListener("click", openRegModal);
      regUI.overlay?.addEventListener("click", () => hideModal(regUI.wrap));
      regUI.close?.addEventListener("click", () => hideModal(regUI.wrap));
      regUI.close2?.addEventListener("click", () => hideModal(regUI.wrap));
      regUI.dBack?.addEventListener("click", () => { regUI.detailWrap.classList.add("hidden"); regUI.sumWrap.classList.remove("hidden"); regUI.sumScroll?.scrollTo?.(0, 0); });
      $("#rdExport")?.addEventListener("click", () => { if (!RD_CURRENT_ROWS.length) return; const title = regUI.dTitle?.textContent || "export"; const date = regUI.dDate?.textContent || ""; const filename = sanitizeFilename(`${title} ${date}`.trim()); const csv = toCSV(RD_CURRENT_ROWS); downloadCSVFile(filename, csv); });
    })();
  })();

  // ==================== Service worker ====================
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
  }
})();
