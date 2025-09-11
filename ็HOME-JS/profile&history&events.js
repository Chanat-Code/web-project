let currentUser = null; /* ใช้ global ตัวเดียวพอ */

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
        const top = Math.min(r.bottom + gap, window.innerHeight - card.offsetHeight - 8);
        card.style.left = left + 'px'; card.style.top = top + 'px';
    }
    function lockScroll(lock) {
        const el = document.scrollingElement || document.documentElement;
        if (lock) { el.dataset.prevOverflow = el.style.overflow || ''; el.style.overflow = 'hidden'; document.body.classList.add('overflow-hidden'); }
        else { el.style.overflow = el.dataset.prevOverflow || ''; document.body.classList.remove('overflow-hidden'); delete el.dataset.prevOverflow; }
    }
    function open() { lastActive = document.activeElement; modal.classList.remove('hidden'); lockScroll(true); requestAnimationFrame(place); window.addEventListener('resize', place, { passive: true }); }
    function close() { modal.classList.add('hidden'); lockScroll(false); if (lastActive) lastActive.focus(); window.removeEventListener('resize', place); }

    btn.addEventListener('click', open);
    overlay.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
})();

(function () {
    const API_BASE = window.API_BASE;
    const token = localStorage.getItem("token");
    if (!token) { location.href = "./index.html"; return; }

    const $ = (s) => document.querySelector(s);
    const eventList = $("#eventList");
    const searchInput = $("#searchInput");
    const searchBtn = $("#searchBtn");
    const fab = $("#fabAdd"), addModal = $("#addModal"), addForm = $("#addForm");
    const dateInput = document.getElementById('addDate');
    if (dateInput) { const offset = new Date().getTimezoneOffset() * 60000; dateInput.value = new Date(Date.now() - offset).toISOString().slice(0, 10); }
    const addCancel = $("#addCancel");

    // เก็บรายการทั้งหมดไว้สำหรับกรอง
    let ALL_EVENTS = [];

    // แสดงรายการ (รองรับข้อความเมื่อไม่พบผลลัพธ์)
    function renderEvents(items, q = "") {
        if (!Array.isArray(items) || items.length === 0) {
            eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-4 text-slate-200 ring-1 ring-white/10">
            ${q ? `ไม่พบกิจกรรมที่ตรงกับ “${window.escapeHtml(q)}”` : 'ยังไม่มีกิจกรรม'}
          </li>`;
            return;
        }
        eventList.innerHTML = items.map(ev => {
            const dateTxt = ev.dateText ? `${window.formatDateLabel(ev.dateText)} ` : "";
            return `<li>
            <a href="./event.html?id=${ev._id}" class="group flex items-center gap-3 rounded-full bg-slate-800 px-6 py-4 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 transition">
              <span class="inline-block h-2 w-10 rounded-full bg-slate-600 group-hover:bg-slate-500"></span>
              <span class="font-semibold tracking-wide">${dateTxt}${window.escapeHtml(ev.title || '')}</span>
            </a>
          </li>`;
        }).join("");
    }

    // ฟังก์ชันกรอง
    function applySearch() {
        const q = (searchInput?.value || "").trim().toLowerCase();
        if (!q) { renderEvents(ALL_EVENTS); return; }
        const filtered = ALL_EVENTS.filter(ev => {
            const f = (v) => String(v || "").toLowerCase();
            return [ev.title, ev.location, ev.dateText].some(v => f(v).includes(q));
        });
        renderEvents(filtered, q);
    }

    // debounce เล็กน้อยให้พิมพ์ลื่น
    const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    const applySearchDebounced = debounce(applySearch, 150);

    // ผูกอีเวนต์ค้นหา
    searchBtn?.addEventListener('click', applySearch);
    searchInput?.addEventListener('input', applySearchDebounced);
    searchInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
        if (e.key === 'Escape') { searchInput.value = ''; applySearch(); }
    });

    async function loadMe() {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: "Bearer " + token }, credentials: "include" });
        if (!res.ok) throw new Error("unauthorized");
        const json = await res.json().catch(() => ({}));
        const me = json.user || json;
        currentUser = me;

        // //ซ่อน historyModel ถ้าเป็น admin
        if (me.role === "admin") {
            const historyModel = document.getElementById('historyModal');
            if (historyModel) historyModel.remove();
            const historyBtn = document.getElementById('historyBtn');
            if (historyBtn) historyBtn.remove();
        }

        const id = (x) => document.getElementById(x);
        id("ppName") && (id("ppName").textContent = me.username ?? "—");
        id("ppId") && (id("ppId").textContent = me.idNumber ?? "—");
        id("ppEmail") && (id("ppEmail").textContent = me.email ?? "—");
        id("ppMajor") && (id("ppMajor").textContent = me.major ?? "—");
        id("ppPhone") && (id("ppPhone").textContent = me.phone ?? "—");

        const calFab = document.getElementById('calendarFab');
        if (me.role === "admin") {
            fab?.classList.remove("hidden"); // admin เห็นปุ่ม +
            calFab?.remove();                // ไม่ให้ปุ่ม calendar
        } else {
            calFab?.classList.remove('hidden'); // user เห็นปุ่ม calendar
        }
    }
    function wireLogout() {
        const btn = document.getElementById("logoutBtn");
        if (!btn) return;
        btn.addEventListener("click", async () => {
            try {
                await fetch(`${API_BASE}/api/auth/logout`, {
                    method: "POST",
                    credentials: "include",
                });
            } catch (e) { }
            localStorage.removeItem("token");
            location.href = "./index.html";
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadMe();
        wireLogout();
    });


    async function loadEvents() {
        const key = 'rltg:events:v1';

        // 1) ตอบด้วย cache ก่อน (แสดงผลไว)
        const cached = localStorage.getItem(key);
        if (cached) {
            try {
                const items = JSON.parse(cached);
                if (Array.isArray(items)) { ALL_EVENTS = items; renderEvents(ALL_EVENTS); }
            } catch { }
        }

        // 2) ดึงของจริงแล้วอัปเดตทับ
        try {
            const res = await fetch(`${API_BASE}/events`, { credentials: 'include', headers: { 'Cache-Control': 'no-cache' }, keepalive: true });
            const items = await res.json();
            ALL_EVENTS = Array.isArray(items) ? items : [];
            localStorage.setItem(key, JSON.stringify(ALL_EVENTS));
            renderEvents(ALL_EVENTS);
        } catch (e) {
            if (!eventList.innerHTML.trim()) {
                eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-4 text-slate-200 ring-1 ring-white/10">โหลดข้อมูลไม่สำเร็จ</li>`;
            }
        }
    }

    function openAdd() { addModal?.classList.remove("hidden"); }
    function closeAdd() { addModal?.classList.add("hidden"); addForm?.reset(); }

    addForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(addForm); const payload = Object.fromEntries(fd.entries());
        const res = await fetch(`${API_BASE}/events`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            credentials: "include", body: JSON.stringify(payload)
        });
        if (!res.ok) { const data = await res.json().catch(() => ({})); alert(`เพิ่มกิจกรรมไม่สำเร็จ: ${data.message || res.status}`); return; }
        closeAdd(); loadEvents();
    });
    addCancel?.addEventListener("click", closeAdd);
    fab?.addEventListener("click", openAdd);
    addModal?.querySelector("[data-overlay]")?.addEventListener("click", closeAdd);

    Promise.allSettled([loadMe(), loadEvents()])
        .catch(() => { localStorage.removeItem("token"); location.href = "./index.html"; });
})();

(function historyModal() {
    const API_BASE = window.API_BASE;
    const btnOpen = document.getElementById('historyBtn');
    const modal = document.getElementById('historyModal');
    const btnClose = document.getElementById('historyClose');
    const overlay = modal?.querySelector('[data-overlay]');
    const ul = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    const loading = document.getElementById('historyLoading');
    if (!btnOpen || !modal) return;

    const open = () => modal.classList.remove('hidden');
    const close = () => modal.classList.add('hidden');

    async function fetchMyRegistrations() {
        const token = localStorage.getItem('token');
        const opt = { headers: { Authorization: 'Bearer ' + token }, credentials: 'include' };
        let res = await fetch(`${API_BASE}/registrations/me`, opt);
        if (res.ok) { const j = await res.json().catch(() => ({})); return j.items || []; }
        if (res.status === 404) {
            res = await fetch(`${API_BASE}/auth/my-registrations`, opt);
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
                            method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
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