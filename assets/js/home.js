// assets/js/home.js
document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIG & STATE ---
  const state = {
    currentUser: null,
    allEvents: [],
    notifications: [],
  };

  // ใช้ base ต่างกันระหว่าง local vs prod (Vercel / rltg.online)
  const host = window.location.hostname.toLowerCase();
  const isLocal = host === '127.0.0.1' || host === 'localhost';
  const API_BASE = isLocal ? 'http://127.0.0.1:4000' : ''; // same-origin on prod

  // --- DOM ELEMENTS CACHE ---
  const DOM = {
    eventList: document.getElementById('eventList'),
    searchInput: document.getElementById('searchInput'),
    profileBtn: document.getElementById('profileBtn'),
    profileModal: document.getElementById('profileModal'),
    logoutBtn: document.getElementById('logoutBtn'),

    // โปรไฟล์แผง (มีไม่มีก็ได้ – เช็ค null ไว้แล้ว)
    ppName:  document.getElementById('ppName'),
    ppId:    document.getElementById('ppId'),
    ppEmail: document.getElementById('ppEmail'),
    ppMajor: document.getElementById('ppMajor'),
    ppPhone: document.getElementById('ppPhone'),

    // แจ้งเตือน (มีไม่มีก็ได้)
    notifBtn:   document.getElementById('notifBtn'),
    notifModal: document.getElementById('notifModal'),
    notifBadge: document.getElementById('notifBadge'),
    notifList:  document.getElementById('notifList'),
    notifEmpty: document.getElementById('notifEmpty'),

    // ประวัติการลงทะเบียน (มีไม่มีก็ได้)
    historyBtn:     document.getElementById('historyBtn'),
    historyModal:   document.getElementById('historyModal'),
    historyList:    document.getElementById('historyList'),
    historyEmpty:   document.getElementById('historyEmpty'),
    historyLoading: document.getElementById('historyLoading'),

    // ปุ่มแอดมิน (มีไม่มีก็ได้)
    fabAdd: document.getElementById('fabAdd'),
    fabReg: document.getElementById('fabReg'),
    fabDel: document.getElementById('fabDel'),

    calendarFab: document.getElementById('calendarFab'),

    // hero/แบนเนอร์ด้านบน (มีไม่มีก็ได้)
    tvStage: document.getElementById('tvStage'),
  };

  // --- UTILS ---
  const Utils = {
    formatDateLabel(s) {
      if (!s) return '—';
      const d = new Date(s);
      if (isNaN(d)) return s;
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const yearBE = d.getFullYear() + 543;
      return `${day}/${month}/${String(yearBE).slice(-2)}`;
    },
    escapeHtml(t = '') {
      return t.replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[m]));
    },
    debounce(fn, ms) {
      let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    },
    async apiFetch(endpoint, options = {}) {
      const token = localStorage.getItem("token");
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}${endpoint}`, {
        credentials: 'include',
        ...options,
        headers
      });

      // พยายาม parse json เสมอ เพื่อดึง message
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.message || `API Error: ${res.status}`;
        throw new Error(msg);
      }
      return data;
    }
  };

  // --- HERO SLIDER (ตัวอย่างแบบง่าย ถ้าไม่มี element ก็ข้าม) ---
  const HeroSlider = {
    init() {
      if (!DOM.tvStage) return;
      // แสดงภาพปกของกิจกรรม 0-3 รายการ ถ้ามี imageUrl
      const picks = state.allEvents.filter(e => e.imageUrl).slice(0, 3);
      if (!picks.length) { DOM.tvStage.innerHTML = ''; return; }
      DOM.tvStage.innerHTML = picks.map((e, i) => `
        <figure class="tv-slide ${i===0?'is-center':'is-right'}">
          <img src="${e.imageUrl}" alt="${Utils.escapeHtml(e.title||'Event')}" />
        </figure>
      `).join('');
    }
  };

  // --- History Modal (optional) ---
  const HistoryModal = {
    init() {
      if (!DOM.historyBtn || !DOM.historyModal) return;
      const open = () => { DOM.historyModal.classList.remove('hidden'); this.load(); };
      const close = () => DOM.historyModal.classList.add('hidden');
      DOM.historyBtn.addEventListener('click', open);
      DOM.historyModal.querySelector('[data-overlay]')?.addEventListener('click', close);
      DOM.historyModal.querySelector('#historyClose')?.addEventListener('click', close);
    },
    async load() {
      if (!DOM.historyList || !DOM.historyEmpty || !DOM.historyLoading) return;
      DOM.historyList.classList.add('hidden');
      DOM.historyEmpty.classList.add('hidden');
      DOM.historyLoading.classList.remove('hidden');
      DOM.historyLoading.textContent = 'กำลังโหลด...';
      try {
        const data = await Utils.apiFetch('/api/auth/my-registrations');
        const items = data.items || [];
        DOM.historyLoading.classList.add('hidden');

        if (!items.length) {
          DOM.historyEmpty.classList.remove('hidden');
          return;
        }

        DOM.historyList.innerHTML = items.map(it => {
          const ev = it.event || {};
          const isOrphan = !ev._id;
          const title = isOrphan
            ? (it.eventSnapshot?.title || '(กิจกรรมถูกลบไปแล้ว)')
            : (ev.title || 'N/A');
          return `
            <li class="rounded-xl border p-4">
              <div class="font-semibold">${Utils.escapeHtml(title)} ${isOrphan ? '<span class="text-xs text-red-500">ถูกลบแล้ว</span>' : ''}</div>
              <div class="text-sm text-slate-500">${Utils.formatDateLabel(ev.dateText)}</div>
            </li>
          `;
        }).join('');
        DOM.historyList.classList.remove('hidden');
      } catch (err) {
        DOM.historyLoading.textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + err.message;
      }
    }
  };

  // --- Admin (optional) ---
  const Admin = {
    init() {
      DOM.fabAdd?.addEventListener('click', () => { /* open add modal */ });
      DOM.fabDel?.addEventListener('click', () => { /* open delete modal */ });
      DOM.fabReg?.addEventListener('click', () => { /* open registrations modal */ });
      console.log('Admin features initialized');
    }
  };

  // --- APP ---
  const App = {
    init() {
      if (!localStorage.getItem("token")) {
        window.location.href = "/index.html";
        return;
      }
      this.bindEvents();
      this.loadInitialData();
    },
    bindEvents() {
      DOM.logoutBtn?.addEventListener('click', this.handleLogout);
      DOM.searchInput?.addEventListener('input', Utils.debounce(this.handleSearch, 250));
    },
    async loadInitialData() {
      try {
        const [meData, eventsData] = await Promise.all([
          Utils.apiFetch('/api/auth/me'),
          Utils.apiFetch('/api/events'),
        ]);

        state.currentUser = meData.user;
        this.renderUserProfile();

        state.allEvents = Array.isArray(eventsData) ? eventsData : [];
        this.renderEvents();

        // init modules หลังจากได้ข้อมูล
        HeroSlider.init();
        HistoryModal.init();
      } catch (error) {
        console.error('Failed to load initial data:', error.message);
        if (/401|invalid token/i.test(error.message)) {
          localStorage.removeItem("token");
          window.location.href = "/index.html";
        }
      }
    },
    renderUserProfile() {
      const u = state.currentUser;
      if (!u) return;

      // มี element ก็เติมให้
      DOM.ppName && (DOM.ppName.textContent = `${u.firstName||''} ${u.lastName||''}`.trim() || '—');
      DOM.ppId && (DOM.ppId.textContent = u.studentId || '—');
      DOM.ppEmail && (DOM.ppEmail.textContent = u.email || '—');
      DOM.ppMajor && (DOM.ppMajor.textContent = u.major || '—');
      DOM.ppPhone && (DOM.ppPhone.textContent = u.phone || '—');

      const isAdmin = u.role === 'admin';
      DOM.fabAdd?.classList.toggle('hidden', !isAdmin);
      DOM.fabReg?.classList.toggle('hidden', !isAdmin);
      DOM.fabDel?.classList.toggle('hidden', !isAdmin);
      DOM.calendarFab?.classList.toggle('hidden', isAdmin);

      if (isAdmin) Admin.init();
    },
    renderEvents(customItems) {
      if (!DOM.eventList) return;
      const items = customItems || state.allEvents;

      if (!items.length) {
        const q = (DOM.searchInput?.value || '').trim();
        DOM.eventList.innerHTML =
          `<li class="rounded-xl bg-slate-800/80 px-6 py-4 text-slate-200 ring-1 ring-white/10">
            ${q ? `ไม่พบกิจกรรมที่ตรงกับ "${Utils.escapeHtml(q)}"` : 'ยังไม่มีกิจกรรม'}
           </li>`;
        return;
      }

      DOM.eventList.innerHTML = items.map(ev => {
        const dateTxt = ev.dateText ? `${Utils.formatDateLabel(ev.dateText)} ` : '';
        return `
          <li>
            <a href="/event.html?id=${ev._id}"
               class="group flex items-center gap-3 rounded-full bg-slate-800 px-6 py-4 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 transition">
              <span class="inline-block h-2 w-10 rounded-full bg-slate-600 group-hover:bg-slate-500"></span>
              <span class="font-semibold tracking-wide">${dateTxt}${Utils.escapeHtml(ev.title||'')}</span>
            </a>
          </li>`;
      }).join('');
    },
    handleSearch(e) {
      const q = e.target.value.trim().toLowerCase();
      const filtered = state.allEvents.filter(ev =>
        (ev.title || '').toLowerCase().includes(q) ||
        (ev.location || '').toLowerCase().includes(q)
      );
      App.renderEvents(filtered);
    },
    async handleLogout() {
      try { await Utils.apiFetch('/api/auth/logout', { method: 'POST' }); }
      finally {
        localStorage.removeItem("token");
        window.location.href = "/index.html";
      }
    }
  };

  // START
  App.init();
});
