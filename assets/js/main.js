// Tanvee Goenka: portfolio
(() => {
  // Header: solid once the page is scrolled; slides away while scrolling down, back when scrolling up
  const header = document.querySelector('.site-header');
  if (header) {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 8);
      if (Math.abs(y - lastY) < 6) return;
      header.classList.toggle('is-hidden', y > lastY && y > header.offsetHeight && !header.contains(document.activeElement));
      lastY = y;
    };
    // tint the header gradient with the colour of whatever sits just below it, and use light text on dark
    const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).map(Number); return (p[3] ?? 1) > 0.5 ? p.slice(0, 3) : null; };
    const bgAt = (x, y) => {
      for (const el of document.elementsFromPoint(x, y)) {
        if (header.contains(el)) continue;
        if (el.matches('img, video, image') || el.closest('svg')) return null; // photos: no single colour
        const rgb = parse(getComputedStyle(el).backgroundColor);
        if (rgb) return rgb;
      }
      return [255, 255, 255];
    };
    let queued = false;
    const tint = () => {
      queued = false;
      const y = header.offsetHeight + 2, w = window.innerWidth;
      const rgb = bgAt(w * 0.5, y) || bgAt(w * 0.08, y) || bgAt(w * 0.92, y) || [255, 255, 255];
      header.style.setProperty('--hdr-rgb', rgb.join(', '));
      header.classList.toggle('is-dark', 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 110);
    };
    const queueTint = () => { if (!queued) { queued = true; requestAnimationFrame(tint); } };
    onScroll();
    tint();
    window.addEventListener('scroll', () => { onScroll(); queueTint(); }, { passive: true });
    window.addEventListener('resize', queueTint, { passive: true });
    window.addEventListener('load', queueTint);
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  }

  // Hero: cycles the three phrases every 3s (Figma "after delay 3s, dissolve 100ms")
  // (with reduced motion the first phrase simply stays put)
  const rotator = document.querySelector('[data-rotator]');
  if (rotator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const phrases = [...rotator.children];
    let i = 0;
    setInterval(() => {
      phrases[i].classList.remove('is-active');
      phrases[i].setAttribute('aria-hidden', 'true');
      i = (i + 1) % phrases.length;
      phrases[i].classList.add('is-active');
      phrases[i].removeAttribute('aria-hidden');
    }, 3000);
  }

  // Case studies: scale the 1440px Figma canvas to the viewport width
  const canvas = document.querySelector('.canvas');
  if (canvas) {
    const width = Number(canvas.dataset.width) || 1440;
    // on the root, so blocks outside the canvas (the case-study close) can use the same scale
    const fit = () => document.documentElement.style.setProperty('--canvas-zoom', document.documentElement.clientWidth / width);
    fit();
    window.addEventListener('resize', fit, { passive: true });
  }

  // Mobile case studies: scale each Figma figure to the width of its column
  const figs = document.querySelectorAll('.m-fig__canvas[data-fit]');
  if (figs.length) {
    const fitFigs = () => figs.forEach(f => {
      const w = f.parentElement.clientWidth;
      if (w) f.style.setProperty('--fig-zoom', Math.min(1, w / Number(f.dataset.fit)));
    });
    fitFigs();
    window.addEventListener('resize', fitFigs, { passive: true });
  }
  document.querySelectorAll('.m-scroll[data-start="center"]').forEach(s => { s.scrollLeft = (s.scrollWidth - s.clientWidth) / 2; });

  // Carousels (Figma prototype): prev/next arrows step through the slides and wrap around
  document.querySelectorAll('[data-carousel]').forEach(root => {
    const slides = [...root.querySelectorAll('[data-slide]')];
    let i = 0;
    const go = step => {
      slides[i].hidden = true;
      i = (i + step + slides.length) % slides.length;
      slides[i].hidden = false;
    };
    for (const [sel, step] of [['[data-carousel-prev]', -1], ['[data-carousel-next]', 1]]) {
      const btn = root.querySelector(sel);
      if (!btn) continue;
      btn.addEventListener('click', () => go(step));
      btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(step); } });
    }
  });

  // Accordions (Figma prototype). On the desktop canvas everything is absolutely placed, so opening one
  // also moves the content below it down (and grows its containers) by data-accordion-grow px.
  document.querySelectorAll('[data-accordion]').forEach(root => {
    const toggle = root.querySelector('[data-accordion-toggle]');
    const body = root.querySelector('[data-accordion-body]');
    const grow = Number(root.dataset.accordionGrow) || 0;
    const canvas = root.closest('.canvas');
    let moved = [];
    const px = (el, prop, d) => { el.style[prop] = (parseFloat(el.style[prop]) || 0) + d + 'px'; };
    const push = () => {
      const below = root.getBoundingClientRect().bottom - 1;
      moved = [];
      for (let node = root; node !== canvas; node = node.parentElement) {
        for (const sib of node.parentElement.children) {
          if (sib !== node && sib.getBoundingClientRect().top >= below) { px(sib, 'top', grow); moved.push(sib); }
        }
      }
      for (let node = root; node; node = node === canvas ? null : node.parentElement) px(node, 'height', grow);
    };
    const pull = () => {
      moved.forEach(el => px(el, 'top', -grow));
      for (let node = root; node; node = node === canvas ? null : node.parentElement) px(node, 'height', -grow);
    };
    const set = open => {
      root.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (grow && canvas) (open ? push : pull)();
      body.hidden = !open;
    };
    toggle.addEventListener('click', () => set(!root.classList.contains('is-open')));
    toggle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); } });
  });

  // Hover tooltips (Figma prototype): [data-tip] shows its tooltip on hover or focus; × or Escape closes it
  const tips = [];
  document.querySelectorAll('[data-tip]').forEach(trigger => {
    const tip = document.getElementById(trigger.dataset.tip);
    if (!tip) return;
    tips.push(tip);
    let timer;
    const show = () => { clearTimeout(timer); tips.forEach(t => { if (t !== tip) t.hidden = true; }); tip.hidden = false; };
    const hide = (delay = 150) => { clearTimeout(timer); timer = setTimeout(() => { tip.hidden = true; }, delay); };
    const leave = e => { if (!trigger.contains(e.relatedTarget) && !tip.contains(e.relatedTarget)) hide(); };
    trigger.addEventListener('mouseover', show);
    trigger.addEventListener('mouseout', leave);
    tip.addEventListener('mouseover', () => clearTimeout(timer));
    tip.addEventListener('mouseout', leave);
    trigger.addEventListener('focus', show);
    trigger.addEventListener('blur', () => hide(0));
    trigger.addEventListener('keydown', e => { if (e.key === 'Escape') hide(0); });
    tip.querySelector('.tip__close')?.addEventListener('click', () => hide(0));
  });

  // Case-study section index (bottom right): appears while the page scrolls, fades once it's still.
  // Targets are found in whichever layout is showing (desktop canvas or mobile); see fixes.js INDEX.
  const index = document.querySelector('[data-cs-index]');
  if (index) {
    const items = [...index.querySelectorAll('[data-target]')];
    const toggle = index.querySelector('.cs-index__toggle');
    const count = index.querySelector('[data-cs-count]');
    const current = index.querySelector('[data-cs-current]');
    const shown = el => el && el.getClientRects().length > 0;
    const norm = t => t.replace(/\s+/g, ' ').trim();
    const find = target => {
      if (/^[#.]/.test(target)) return document.querySelector(target);
      const roots = [...document.querySelectorAll('.canvas-wrap, .m-page, main > .lx, main > section.lx-sec, main')].filter(shown);
      for (const root of roots) {
        for (const el of root.querySelectorAll('h1, h2, h3, p')) if (shown(el) && norm(el.textContent).startsWith(target)) return el;
      }
      return null;
    };
    let targets = [];
    const resolve = () => { targets = items.map(b => find(b.dataset.target)); };
    const top = el => el.getBoundingClientRect().top + window.scrollY;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = -1;
    const setActive = () => {
      const line = window.innerHeight * 0.35;
      let i = -1;
      targets.forEach((el, k) => { if (el && el.getBoundingClientRect().top <= line) i = k; });
      if (i === active) return;
      active = i;
      items.forEach((b, k) => b.toggleAttribute('aria-current', k === i));
      const k = Math.max(0, i);
      count.textContent = `${k + 1}/${items.length}`;
      current.textContent = items[k].textContent;
    };
    // the wash takes the colour of whatever is behind the corner (like the header), with light text on dark
    const footer = document.querySelector('.site-footer');
    const colourAt = (x, y) => {
      for (const el of document.elementsFromPoint(x, y)) {
        if (index.contains(el)) continue;
        if (el.matches('img, video, image') || el.closest('svg')) return null; // photos: no single colour
        const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const c = m[1].split(/[ ,/]+/).map(Number);
        if ((c[3] ?? 1) > 0.5) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    let tintQueued = false;
    const tint = () => {
      tintQueued = false;
      const w = window.innerWidth, h = window.innerHeight;
      // sample where the labels sit; the colour behind most of them wins (photos count as no colour)
      const list = index.querySelector('.cs-index__list').getBoundingClientRect();
      const ys = list.height ? [0.15, 0.4, 0.65, 0.9].map(f => list.top + list.height * f) : [h - 120, h - 60];
      const seen = ys.map(y => colourAt(w - 90, Math.min(h - 4, y))).filter(Boolean);
      const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const darkVotes = seen.filter(c => lum(c) < 110).length;
      const pool = seen.filter(c => (lum(c) < 110) === (darkVotes > seen.length / 2));
      const rgb = pool[pool.length >> 1] || [255, 255, 255];
      index.style.setProperty('--idx-rgb', rgb.join(', '));
      index.classList.toggle('is-dark', 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 110);
    };
    const queueTint = () => { if (!tintQueued) { tintQueued = true; requestAnimationFrame(tint); } };
    // the footer has its own navigation, so the index steps aside for it
    const atFooter = () => footer && footer.getBoundingClientRect().top < window.innerHeight - 40;

    let timer;
    const hold = () => !atFooter() && (index.matches(':hover, :focus-within') || toggle.getAttribute('aria-expanded') === 'true');
    const hide = () => { if (!hold()) index.classList.remove('is-visible'); };
    const onScroll = () => {
      setActive();
      queueTint();
      // not over the case study's own opening screen, and not over the footer
      index.classList.toggle('is-visible', !atFooter() && (window.scrollY > window.innerHeight * 0.6 || hold()));
      clearTimeout(timer);
      timer = setTimeout(hide, 1400);
    };
    resolve();
    setActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { resolve(); setActive(); }, { passive: true });
    window.addEventListener('load', () => { resolve(); setActive(); });
    index.addEventListener('mouseleave', () => { clearTimeout(timer); timer = setTimeout(hide, 900); });
    index.addEventListener('focusout', () => { clearTimeout(timer); timer = setTimeout(hide, 900); });
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      index.classList.toggle('is-open', open);
    });
    items.forEach((b, k) => b.addEventListener('click', () => {
      resolve();
      const el = targets[k];
      if (!el) return;
      const header = document.querySelector('.site-header');
      window.scrollTo({ top: top(el) - (header ? header.offsetHeight : 0) - 16, behavior: still.matches ? 'auto' : 'smooth' });
      toggle.setAttribute('aria-expanded', 'false');
      index.classList.remove('is-open');
    }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && index.classList.contains('is-open')) { toggle.click(); toggle.focus(); } });
  }

  // Videos show their poster with a play button and load only when clicked; they pause when scrolled off-screen
  const videos = document.querySelectorAll('video[data-src]');
  const io = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
    for (const { target: v, isIntersecting } of entries) if (!isIntersecting && !v.paused) v.pause();
  });
  videos.forEach(v => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'video-play';
    btn.setAttribute('aria-label', 'Play video');
    btn.innerHTML = '<span class="video-play__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.8-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" fill="currentColor"/></svg></span>';
    if (v.closest('.canvas, .m-fig__canvas')) {
      // absolutely placed Figma layer: cover exactly the same box
      for (const p of ['left', 'top', 'width', 'height', 'transform', 'transformOrigin', 'borderRadius']) btn.style[p] = v.style[p];
      btn.classList.add('video-play--abs');
      v.after(btn);
    } else {
      const wrap = document.createElement('span');
      wrap.className = 'video-wrap';
      v.before(wrap);
      wrap.append(v, btn);
    }
    btn.addEventListener('click', () => {
      if (!v.src) v.src = v.dataset.src;
      v.controls = true;
      v.muted = false;
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      btn.hidden = true;
      v.focus({ preventScroll: true });
    });
    if (io) io.observe(v);
  });
})();
