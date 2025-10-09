// assets/js/home.js

document.addEventListener('DOMContentLoaded', () => {
  
  // --- 1. CONFIG & STATE ---
  const state = {
    currentUser: null,
    allEvents: [],
    notifications: [],
  };

  const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' 
    ? 'http://127.0.0.1:4000' 
    : '';

  // --- 2. DOM ELEMENTS CACHE ---
  // รวบรวม element ทั้งหมดไว้ที่เดียว เพื่อให้เรียกใช้ง่ายและเร็วขึ้น
  const DOM = {
    // Main Page
    eventList: document.getElementById('eventList'),
    searchInput: document.getElementById('searchInput'),
    
    // Profile
    profileBtn: document.getElementById('profileBtn'),
    profileModal: document.getElementById('profileModal'),
    ppName: document.getElementById('ppName'),
    ppId: document.getElementById('ppId'),
    ppEmail: document.getElementById('ppEmail'),
    ppMajor: document.getElementById('ppMajor'),
    ppPhone: document.getElementById('ppPhone'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Notifications
    notifBtn: document.getElementById('notifBtn'),
    notifModal: document.getElementById('notifModal'),
    notifBadge: document.getElementById('notifBadge'),
    notifList: document.getElementById('notifList'),
    notifEmpty: document.getElementById('notifEmpty'),
    
    // Admin FABs
    fabAdd: document.getElementById('fabAdd'),
    fabReg: document.getElementById('fabReg'),
    fabDel: document.getElementById('fabDel'),
    
    // User FAB
    calendarFab: document.getElementById('calendarFab'),
  };

  // --- 3. UTILITY FUNCTIONS ---
  // ฟังก์ชันช่วยต่างๆ ที่ใช้ซ้ำๆ
  const Utils = {
    formatDateLabel(s) {
      if (!s) return '—';
      const d = new Date(s);
      if (isNaN(d)) return s;
      const day = d.getDate(), month = d.getMonth() + 1, yearBE = d.getFullYear() + 543;
      return `${day}/${month}/${String(yearBE).slice(-2)}`;
    },
    escapeHtml(t = '') {
      return t.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    },
    debounce(fn, ms) {
      let t;
      return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
      };
    },
    // ฟังก์ชันกลางสำหรับเรียก API
    async apiFetch(endpoint, options = {}) {
      const token = localStorage.getItem("token");
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        credentials: 'include',
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }
      
      return response.json();
    }
  };
  
  // --- 4. MODULES (แบ่งโค้ดเป็นส่วนๆ) ---

  const HeroSlider = {
    IMAGES: [
      '/assets/hero/IMG_20250807_143556.jpg', '/assets/hero/IMG_20250106_182958.jpg',
      '/assets/hero/S__11288578.jpg', '/assets/hero/62403.jpg',
      '/assets/hero/LINE_ALBUM_24768_250907_1.jpg', '/assets/hero/IMG_20250206_135727.jpg'
    ],
    init() {
      const stage = document.getElementById('tvStage');
      if (!stage) return;
      
      stage.innerHTML = `
        <div class="pointer-events-none absolute inset-y-0 left-0 w-[7vw] max-w-32 bg-gradient-to-r from-black/30 to-transparent z-40"></div>
        <div class="pointer-events-none absolute inset-y-0 right-0 w-[7vw] max-w-32 bg-gradient-to-l from-black/30 to-transparent z-40"></div>
        <button id="tvPrev" class="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-50 h-10 w-10 grid place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 hover:bg-black/60" aria-label="Previous slide"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg></button>
        <button id="tvNext" class="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-50 h-10 w-10 grid place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 hover:bg-black/60" aria-label="Next slide"><svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="m10 6-1.41 1.41L13.17 12l-4.58 4.59L10 18l6-6z" /></svg></button>
        <div id="tvDotsWrap" class="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3"><div id="tvDots" class="flex items-center gap-2"></div></div>
      `;

      const slides = this.IMAGES.map((src, i) => {
        const el = document.createElement('div');
        el.className = 'tv-slide';
        el.innerHTML = `<img src="${src}" alt="กิจกรรมแนะนำ ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">`;
        stage.appendChild(el);
        return el;
      });
      // (ส่วน Logic ของ Hero Slider ที่เหลือเหมือนเดิม)
    }
  };

  const Notifications = {
    init() {
        if (!DOM.notifBtn || !DOM.notifModal) return;

        const open = () => {
            DOM.notifModal.classList.remove('hidden');
            this.markAsRead();
        };
        const close = () => DOM.notifModal.classList.add('hidden');

        DOM.notifBtn.addEventListener('click', open);
        DOM.notifModal.querySelector('[data-overlay]')?.addEventListener('click', close);
        DOM.notifModal.querySelector('[data-close]')?.addEventListener('click', close);
        
        this.load();
        setInterval(() => this.load(), 60000); // โหลดใหม่ทุก 1 นาที
    },
    async load() {
        try {
            state.notifications = await Utils.apiFetch('/api/notifications/me');
            this.render();
        } catch (error) {
            console.error('Failed to load notifications:', error.message);
        }
    },
    render() {
        const unreadCount = state.notifications.filter(n => !n.read).length;
        if (DOM.notifBadge) {
            DOM.notifBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            DOM.notifBadge.classList.toggle('hidden', unreadCount === 0);
        }

        if (state.notifications.length === 0) {
            DOM.notifList.innerHTML = '';
            DOM.notifEmpty.classList.remove('hidden');
            return;
        }
        
        DOM.notifEmpty.classList.add('hidden');
        // (ส่วน render list item ของ notification เหมือนเดิม)
    },
    async markAsRead() {
        const hasUnread = state.notifications.some(n => !n.read);
        if (!hasUnread) return;
        
        state.notifications.forEach(n => n.read = true);
        this.render(); // อัปเดต UI ทันที
        
        try {
            await Utils.apiFetch('/api/notifications/me/mark-as-read', { method: 'POST' });
        } catch (error) {
            console.error('Failed to mark notifications as read:', error.message);
        }
    }
  };

  const App = {
    init() {
      if (!localStorage.getItem("token")) {
        window.location.href = "/index.html";
        return;
      }

      HeroSlider.init();
      Notifications.init();
      
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
          Utils.apiFetch('/api/events')
        ]);
        
        state.currentUser = meData.user;
        this.renderUserProfile();

        state.allEvents = Array.isArray(eventsData) ? eventsData : [];
        this.renderEvents();

      } catch (error) {
        console.error("Failed to load initial data:", error.message);
        localStorage.removeItem("token");
        window.location.href = "/index.html";
      }
    },
    renderUserProfile() {
      const user = state.currentUser;
      if (!user) return;

      if (DOM.ppName) DOM.ppName.textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
      // ... (ตั้งค่า DOM element อื่นๆ ของ profile) ...
      
      const isAdmin = user.role === 'admin';
      DOM.fabAdd?.classList.toggle('hidden', !isAdmin);
      DOM.fabReg?.classList.toggle('hidden', !isAdmin);
      DOM.fabDel?.classList.toggle('hidden', !isAdmin);
      DOM.calendarFab?.classList.toggle('hidden', isAdmin);
    },
    renderEvents(customItems) {
      const items = customItems || state.allEvents;
      if (!items.length) {
        DOM.eventList.innerHTML = `<li class="rounded-xl bg-slate-800/80 px-6 py-4 text-slate-200 ring-1 ring-white/10">ไม่พบกิจกรรม</li>`;
        return;
      }
      DOM.eventList.innerHTML = items.map(ev => {
        const dateTxt = ev.dateText ? `${Utils.formatDateLabel(ev.dateText)} ` : "";
        return `<li><a href="/event.html?id=${ev._id}" class="group flex items-center gap-3 rounded-full bg-slate-800 px-6 py-4 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 transition"><span class="inline-block h-2 w-10 rounded-full bg-slate-600 group-hover:bg-slate-500"></span><span class="font-semibold tracking-wide">${dateTxt}${Utils.escapeHtml(ev.title || '')}</span></a></li>`;
      }).join("");
    },
    handleSearch(e) {
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        App.renderEvents();
        return;
      }
      const filtered = state.allEvents.filter(ev => 
        (ev.title || '').toLowerCase().includes(query) ||
        (ev.location || '').toLowerCase().includes(query)
      );
      App.renderEvents(filtered);
    },
    async handleLogout() {
      try {
        await Utils.apiFetch('/api/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem("token");
        window.location.href = "/index.html";
      }
    }
  };

  // --- 5. INITIALIZE APP ---
  App.init();

});