(function () {
    const IMAGES = [
        'assets/hero/IMG_20250807_143556.jpg',
        'assets/hero/IMG_20250106_182958.jpg',
        'assets/hero/S__11288578.jpg',
        'assets/hero/62403.jpg',
        'assets/hero/LINE_ALBUM_24768_250907_1.jpg',
        'assets/hero/IMG_20250206_135727.jpg'
    ];
    const FALLBACKS = [
        'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1522199755839-a2bacb67c546?q=80&w=1600&auto=format&fit=crop'
    ];

    const stage = document.getElementById('tvStage');
    const dotsWrap = document.getElementById('tvDots');
    const btnPrev = document.getElementById('tvPrev');
    const btnNext = document.getElementById('tvNext');
    const btnToggle = document.getElementById('tvToggle');

    function makeSlide(src, i) {
        const eager = i === 0 ? 'eager' : 'lazy';
        const prio = i === 0 ? 'high' : 'auto';
        const el = document.createElement('div');
        el.className = 'tv-slide';
        el.innerHTML = `
          <img src="${src}" alt=""
              loading="${eager}" fetchpriority="${prio}" decoding="async"
              referrerpolicy="no-referrer" crossorigin="anonymous">
          <div class="fade"></div>`;
        const img = el.querySelector('img');

        el.dataset.loading = '1';
        img.addEventListener('load', () => { delete el.dataset.loading; });
        img.addEventListener('error', () => { img.src = FALLBACKS[i % FALLBACKS.length]; });

        stage.appendChild(el);
        return el;
    }

    const slides = IMAGES.map((src, i) => makeSlide(src, i));
    const dots = IMAGES.map((_, i) => {
        const b = document.createElement('button');
        b.className = 'dot'; b.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(b); return b;
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
        dots.forEach((d, i) => d.classList.toggle('active', i === index));
    }
    function goTo(i) { index = (i + slides.length) % slides.length; apply(); restart(); }
    const next = () => goTo(index + 1), prev = () => goTo(index - 1);
    function start() { if (playing && !timer) timer = setInterval(next, INTERVAL); }
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); start(); }

    btnNext.addEventListener('click', next);
    btnPrev.addEventListener('click', prev);
    btnToggle.addEventListener('click', () => { playing = !playing; btnToggle.textContent = playing ? '⏸' : '▶︎'; playing ? start() : stop(); });

    stage.tabIndex = 0;
    stage.addEventListener('keydown', e => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); });
    let sx = 0, dx = 0;
    stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; dx = 0; stop(); }, { passive: true });
    stage.addEventListener('touchmove', e => { dx = e.touches[0].clientX - sx; }, { passive: true });
    stage.addEventListener('touchend', () => { if (Math.abs(dx) > 40) (dx < 0 ? next() : prev()); if (playing) start(); });

    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

    apply(); start();

    /* ดันคอนโทรลไปไว้ท้าย stage ให้ซ้อนเหนือรูป */
    ['tvDotsWrap', 'tvToggle', 'tvPrev', 'tvNext'].forEach(id => {
        const el = document.getElementById(id);
        if (el) stage.appendChild(el);
    });
})();