/* ===== Admin Registrations Modal (Fixed v2) ===== */
(function () {
    const API_BASE = window.API_BASE;
    const token = localStorage.getItem("token");
    if (!token) return;

    // ---------- DOM ----------
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
        // summary
        sumLoading: document.getElementById('regLoading'),
        sumEmpty: document.getElementById('regEmpty'),
        table: document.getElementById('regTable'),
        tbody: document.getElementById('regTbody'),
        // detail
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

    // ---------- Utils ----------
    const esc = window.escapeHtml ?? (s => s);
    const fmt = window.formatDateLabel ?? (s => s);

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

    // รูปแบบ response → array
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
            const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, credentials: 'include' });
            if (!res.ok) return null;
            return await res.json().catch(() => null);
        } catch { return null; }
    }

    async function fetchEventCounts() {
        try {
            const r = await fetch(`${API_BASE}/events/admin/summary`, {
                headers: { Authorization: 'Bearer ' + token }, credentials: 'include'
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

    // ---------- State ----------
    let CURRENT_USER = null;
    let EVENTS_CACHE = [];

    async function loadMe() {
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: 'Bearer ' + token }, credentials: 'include' });
        const j = await res.json().catch(() => ({}));
        CURRENT_USER = j.user || j;
        if (CURRENT_USER?.role === 'admin') {
            fabAdd?.classList.remove('hidden');
            fabReg?.classList.remove('hidden');
            fabDel?.classList.remove('hidden');
            document.getElementById('calendarFab')?.remove?.();
        }
    }
    async function loadEvents() {
        const res = await fetch(`${API_BASE}/events`, { credentials: 'include' });
        const items = await res.json().catch(() => []);
        EVENTS_CACHE = Array.isArray(items) ? items : [];
        if (!EVENTS_CACHE.length) {
            eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-4 text-slate-200 ring-1 ring-white/10">ยังไม่มีกิจกรรม</li>`;
            return;
        }
        eventList.innerHTML = EVENTS_CACHE.map(ev => {
            const d = ev.dateText ? `${fmt(ev.dateText)} ` : '';
            return `<li>
            <a href="./event.html?id=${ev._id}" class="group flex items-center gap-3 rounded-full bg-slate-800 px-6 py-4 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 transition">
              <span class="inline-block h-2 w-10 rounded-full bg-slate-600 group-hover:bg-slate-500"></span>
              <span class="font-semibold tracking-wide">${d}${esc(ev.title || '')}</span>
            </a>
          </li>`;
        }).join('');
    }

    // ---------- ลบกิจกรรม (Admin) ----------
    function openDelModal() {
        delUI.loading.classList.remove('hidden');
        delUI.empty.classList.add('hidden');
        delUI.scroll.classList.add('hidden');
        delUI.list.innerHTML = '';
        showModal(delUI.wrap);

        const items = EVENTS_CACHE || [];
        delUI.loading.classList.add('hidden');
        if (!items.length) { delUI.empty.classList.remove('hidden'); return; }

        delUI.list.innerHTML = items.map(ev => `
          <li class="rounded-xl border border-slate-200 bg-white/60 p-4 flex items-center justify-between gap-3">
            <div>
              <div class="font-semibold">${esc(ev.title || '(ไม่ระบุชื่อกิจกรรม)')}</div>
              <div class="text-sm text-slate-500">${fmt(ev.dateText)} • ${esc(ev.location || '—')}</div>
            </div>
            <button data-del="${ev._id}" class="px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500">ลบ</button>
          </li>`).join('');
        delUI.scroll.classList.remove('hidden');

        delUI.list.querySelectorAll('button[data-del]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-del');
                const ev = EVENTS_CACHE.find(e => e._id === id);
                const name = ev?.title || '';
                if (!confirm(`ยืนยันลบกิจกรรมนี้?\n\n${name}`)) return;
                btn.disabled = true;
                try {
                    const r = await fetch(`${API_BASE}/events/${id}`, {
                        method: 'DELETE',
                        headers: { Authorization: 'Bearer ' + token },
                        credentials: 'include'
                    });
                    if (!r.ok) {
                        const j = await r.json().catch(() => ({}));
                        throw new Error(j.message || r.status);
                    }
                    EVENTS_CACHE = EVENTS_CACHE.filter(e => e._id !== id);
                    await loadEvents();
                    btn.closest('li')?.remove();
                    if (!delUI.list.children.length) {
                        delUI.scroll.classList.add('hidden');
                        delUI.empty.classList.remove('hidden');
                    }
                    alert('ลบสำเร็จ');
                } catch (e) {
                    alert('ลบไม่สำเร็จ: ' + e.message);
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

    // ---------- Fetch registrations ----------
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

    // ---------- Summary ----------
    async function openRegModal() {
        if (CURRENT_USER?.role !== 'admin') return;

        regUI.sumLoading.classList.remove('hidden');
        regUI.sumWrap.classList.remove('hidden');
        regUI.detailWrap.classList.add('hidden');
        regUI.sumEmpty.classList.add('hidden');
        regUI.table.classList.add('hidden');
        regUI.tbody.innerHTML = '';
        regUI.detailWrap.classList.add('hidden');
        regUI.sumScroll?.scrollTo?.(0, 0);
        showModal(regUI.wrap);

        let events = EVENTS_CACHE;
        if (!events.length) {
            const r = await fetch(`${API_BASE}/events`, { credentials: 'include' });
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

        // render
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

        // เติมจำนวนแบบ per-event สำหรับแถวว่าง
        const needFill = [...regUI.tbody.querySelectorAll('tr')].filter(tr => {
            const c = tr.querySelector('.js-count');
            return c && c.textContent.trim() === '';
        });
        for (const tr of needFill) {
            const id = tr.querySelector('button[data-view]')?.getAttribute('data-view');
            if (!id) continue;
            const regs = await fetchRegistrationsByEvent(id);
            tr.querySelector('.js-count').textContent = regs.length;
        }

        regUI.tbody.querySelectorAll('button[data-view]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-view');
                const ev = events.find(e => e._id === id) || {};
                await openRegDetail(ev);
            });
        });
    }

    // ---------- Detail ----------
    async function openRegDetail(ev) {
        regUI.detailWrap.classList.remove('hidden');
        regUI.sumWrap.classList.add('hidden');
        regUI.detailWrap.classList.remove('hidden');
        regUI.dScroll?.scrollTo?.(0, 0);
        regUI.dTitle.textContent = ev.title || '(ไม่ระบุชื่อกิจกรรม)';
        regUI.dDate.textContent = toDisplayDate(ev.dateText);
        regUI.dLoading.classList.remove('hidden');
        regUI.dEmpty.classList.add('hidden');
        regUI.dTable.classList.add('hidden');
        regUI.dTbody.innerHTML = '';

        let regs = await fetchRegistrationsByEvent(ev._id);
        if (!regs.length) {
            const all = await fetchAllRegistrations();
            if (Array.isArray(all)) {
                regs = all.filter(r => getRegEventId(r) === ev._id);
            }
        }

        regUI.dLoading.classList.add('hidden');
        if (!regs.length) {
            regUI.dEmpty.classList.remove('hidden');
            return;
        }

        regUI.dTbody.innerHTML = regs.map(r => {
            const u = r.user || r.profile || r.account || {};
            const name = u.username || u.fullName || u.name || r.name || r.username || '—';
            const idnum = u.idNumber || u.studentId || r.idNumber || r.studentId || r.sid || '—';
            const email = u.email || r.email || '—';
            const phone = u.phone || u.tel || r.phone || r.tel || '—';
            const addr = r.address || r.addr || r.registrationAddress || r.contactAddress || '—';
            return `<tr class="border-t">
            <td class="py-2 pr-3">${esc(String(name))}</td>
            <td class="py-2 pr-3">${esc(String(idnum))}</td>
            <td class="py-2 pr-3">${esc(String(email))}</td>
            <td class="py-2 pr-3">${esc(String(phone))}</td>
            <td class="py-2 pr-3">${esc(String(addr))}</td>
          </tr>`;
        }).join('');
        regUI.dTable.classList.remove('hidden');
    }

    // ---------- wire ----------
    fabReg?.addEventListener('click', openRegModal);
    regUI.overlay?.addEventListener('click', () => hideModal(regUI.wrap));
    regUI.close?.addEventListener('click', () => hideModal(regUI.wrap));
    regUI.close2?.addEventListener('click', () => hideModal(regUI.wrap));
    regUI.dBack?.addEventListener('click', () => {
        regUI.detailWrap.classList.add('hidden');
        regUI.sumWrap.classList.remove('hidden');
        regUI.sumScroll?.scrollTo?.(0, 0);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !regUI.wrap.classList.contains('hidden')) hideModal(regUI.wrap); });

    // ---------- start ----------
    Promise.allSettled([loadMe(), loadEvents()]).catch(() => { });
})();