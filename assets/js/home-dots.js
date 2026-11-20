/* Home · Connect the Dots
   A canvas field of marks. Every mark carries three tags (project, method, theme).
   Hover or tap one: ink lines run to its relatives, labelled with what links them.
   Pick a project: its marks spring into a constellation sorted by method. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 4);

  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = mqReduce.matches;
  const noHover = matchMedia('(hover: none)').matches;

  const INK = '#111111';
  const COL = { pink: '#F5A8BC', red: '#EE4B2B', yellow: '#F7D038', blue: '#2E64B5', ink: INK };

  // Ten methods = five colours x two shapes. Circles find out, squares make.
  const METHODS = {
    visit:      { label: 'field visit',    sq: false, col: 'red' },
    interviews: { label: 'interviews',     sq: false, col: 'pink' },
    research:   { label: 'research',       sq: false, col: 'blue' },
    testing:    { label: 'testing',        sq: false, col: 'yellow' },
    sharing:    { label: 'early feedback', sq: false, col: 'ink' },
    prototype:  { label: 'prototype',      sq: true,  col: 'yellow' },
    interface:  { label: 'interface',      sq: true,  col: 'blue' },
    service:    { label: 'service map',    sq: true,  col: 'ink' },
    brand:      { label: 'brand',          sq: true,  col: 'pink' },
    strategy:   { label: 'strategy',       sq: true,  col: 'red' }
  };
  const THEMES = ['trust', 'confidence', 'clarity'];
  const PROJECTS = [
    { name: 'Lexafide', title: 'Designing for decisions, not automation', href: 'case-studies/lexafide.html',
      methods: ['prototype', 'interface', 'testing', 'sharing'], themes: [0.36, 0.26, 0.38] },
    { name: 'Sthir', title: 'An assistive writing device for the elderly', href: 'case-studies/sthir.html',
      methods: ['visit', 'research', 'prototype', 'sharing'], themes: [0.22, 0.58, 0.20] },
    { name: 'Fermio', title: 'User-centered battery disposal service', href: 'case-studies/fermio.html',
      methods: ['visit', 'research', 'service', 'strategy', 'prototype', 'interface'], themes: [0.5, 0.16, 0.34] },
    { name: 'Indian Bank', title: 'Converting a legacy brand into a loyal one', href: 'case-studies/indian-bank.html',
      methods: ['interviews', 'research', 'brand', 'strategy', 'interface'], themes: [0.46, 0.2, 0.34] }
  ];

  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ───────── constellation layout, shared by the canvas and the SVG figures ───────── */
  function spiral(n) {
    const r = Math.ceil(Math.sqrt(n)) + 2, pts = [];
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) pts.push([x, y, x * x + y * y + (Math.atan2(y, x) + Math.PI) * 0.001]);
    pts.sort((a, b) => a[2] - b[2]);
    return pts.slice(0, n);
  }
  function constellation(groups, cx, cy, rx, ry, sp) {
    const k = groups.length, a0 = -Math.PI / 2 + (k % 2 ? 0 : Math.PI / k);
    return groups.map((g, j) => {
      const a = a0 + (j * TAU) / k, ux = Math.cos(a), uy = Math.sin(a);
      const x = Math.round(cx + ux * rx), y = Math.round(cy + uy * ry);
      const slots = spiral(g.n).map(([dx, dy]) => [x + dx * sp, y + dy * sp]);
      let top = 0, bot = 0, r = 0;
      for (const s of slots) { top = Math.min(top, s[1] - y); bot = Math.max(bot, s[1] - y); r = Math.max(r, Math.hypot(s[0] - x, s[1] - y)); }
      return { key: g.key, x, y, ux, uy, slots, r: r + sp * 0.5, top: top - sp * 0.5, bot: bot + sp * 0.5 };
    });
  }

  /* ───────────────────────────── the field ───────────────────────────── */
  const hero = $('.hero'), cv = $('#field'), header = $('.top'), statusEl = $('#field-status');
  const outEl = $('#gather-out'), btns = $$('.gbtn');
  const outDefault = outEl ? outEl.innerHTML : '';
  const ctx = cv.getContext('2d');

  let W = 0, H = 0, DPR = 1, cell = 30, size = 26, cols = 0, rows = 0, ox = 0, oy = 0;
  let marks = [], grid = [], free = [], area = { x: 0, y: 0, w: 0, h: 0 };
  let gathered = -1, layout = null, oldLayout = null;
  let link = null, oldLink = null;
  let now = 0, last = 0, running = false, raf = 0, heroOn = true, built = false, first = true;
  let nextMove = 2.2, userActed = false, demoTimer = 0, kbd = false, hoverT = 0;

  function labelFont() { return '500 ' + (W < 700 ? 11 : 12) + 'px "JetBrains Mono", ui-monospace, monospace'; }

  function build() {
    const hr = hero.getBoundingClientRect();
    W = Math.round(hr.width); H = Math.round(hr.height);
    if (!W || !H) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cell = W >= 1100 ? 30 : W >= 700 ? 28 : 20;
    size = Math.round(cell * 0.86);
    cols = Math.floor(W / cell); rows = Math.floor(H / cell);
    ox = (W - cols * cell) / 2; oy = (H - rows * cell) / 2;

    // knock-outs: every line of hero text keeps the cells behind it empty
    const ko = [], px = cell * 0.42, py = cell * 0.12;
    let copyRight = 0, copyTop = H;
    $$('[data-knock]', hero).forEach(el => {
      const inCopy = !!el.closest('.hero-copy');
      for (const q of el.getClientRects()) {
        if (!q.width || !q.height) continue;
        ko.push([q.left - hr.left - px, q.top - hr.top - py, q.right - hr.left + px, q.bottom - hr.top + py]);
        if (inCopy) { copyRight = Math.max(copyRight, q.right - hr.left); copyTop = Math.min(copyTop, q.top - hr.top); }
      }
    });
    const xn = document.getElementById('xnav');   // keep the gallery pill's corner clear
    if (xn) { const q = xn.getBoundingClientRect(); if (q.width) ko.push([q.left - hr.left - 6, q.top - hr.top - 6, q.right - hr.left + 6, q.bottom - hr.top + 6]); }
    const hb = header.getBoundingClientRect().bottom - hr.top + 6;
    area = W >= 1000
      ? { x: copyRight + 14, y: hb, w: W - copyRight - 24, h: H - hb - 58 }
      : { x: 8, y: hb, w: W - 16, h: Math.max(160, copyTop - hb - 10) };

    const R = rng(4107 + cols * 31 + rows * 7);
    // coarse value noise so the field has loose clumps and clearings
    const lat = new Map();
    const lv = (x, y) => { const k = x + ',' + y; if (!lat.has(k)) lat.set(k, R()); return lat.get(k); };
    const noise = (x, y) => {
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = lv(x0, y0), b = lv(x0 + 1, y0), c = lv(x0, y0 + 1), d = lv(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };

    marks = []; grid = new Array(cols * rows).fill(null); free = new Array(cols * rows).fill(true);
    const diag = Math.hypot(W, H);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const l = ox + cx * cell, t = oy + cy * cell, r = l + cell, b = t + cell, idx = cy * cols + cx;
      let blocked = false;
      for (const k of ko) if (l < k[2] && r > k[0] && t < k[3] && b > k[1]) { blocked = true; break; }
      if (blocked) { free[idx] = false; continue; }
      const dens = (0.27 + 0.36 * noise(cx / 4.5, cy / 4.5)) * 0.9;   // 10% fewer marks than the first version
      if (R() > dens) continue;
      const p = Math.floor(R() * 4), P = PROJECTS[p];
      const mk = P.methods[Math.floor(R() * P.methods.length)], M = METHODS[mk];
      let tr = R(), th = 0; while (th < 2 && tr > P.themes[th]) { tr -= P.themes[th]; th++; }
      const x = l + cell / 2, y = t + cell / 2;
      const m = {
        id: 0, cx, cy, hx: x, hy: y, x, y, tx: x, ty: y, px: x, py: y, pt: 0, vx: 0, vy: 0,
        k: 220, c: 17, s: 1, st: 1, sv: 0, a: 1, at: 1, hi: true, born: 0, fly: null,
        p, mk, th, sq: M.sq, fill: COL[M.col]
      };
      if (first && !reduced) { m.s = 0; m.st = 0; m.born = 0.12 + (Math.hypot(x, y - H) / diag) * 0.85 + R() * 0.22; }
      marks.push(m);
    }
    marks.sort((a, b) => (a.fill < b.fill ? -1 : a.fill > b.fill ? 1 : 0));
    marks.forEach((m, i) => { m.id = i; grid[m.cy * cols + m.cx] = m; });
    first = false; built = true;
    link = oldLink = null; layout = oldLayout = null;
    if (gathered >= 0) { const g = gathered; gathered = -1; setGather(g, true); }
    applyAlpha(true);
    if (reduced) { showStill(); }
    render();
  }

  /* ───── physics ───── */
  function step(dt) {
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      if (m.born > 0) { m.born -= dt; if (m.born <= 0) { m.st = 1; m.sv = 7; } }
      if (m.pt > 0) { m.pt -= dt; if (m.pt <= 0) { m.tx = m.px; m.ty = m.py; } }
      const dx = m.tx - m.x, dy = m.ty - m.y;
      if (dx !== 0 || dy !== 0 || m.vx !== 0 || m.vy !== 0) {
        m.vx += (m.k * dx - m.c * m.vx) * dt; m.vy += (m.k * dy - m.c * m.vy) * dt;
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.fly && Math.abs(m.tx - m.x) + Math.abs(m.ty - m.y) < size * 0.7) land(m);
        if (m.pt <= 0 && Math.abs(dx) < 0.06 && Math.abs(dy) < 0.06 && Math.abs(m.vx) < 3 && Math.abs(m.vy) < 3) {
          m.x = m.tx; m.y = m.ty; m.vx = m.vy = 0;
        }
      }
      const ds = m.st - m.s;
      if (ds !== 0 || m.sv !== 0) {
        m.sv += (300 * ds - 15 * m.sv) * dt; m.s += m.sv * dt;
        if (Math.abs(ds) < 0.004 && Math.abs(m.sv) < 0.05) { m.s = m.st; m.sv = 0; }
      }
      if (m.a !== m.at) { m.a += (m.at - m.a) * Math.min(1, dt * 10); if (Math.abs(m.a - m.at) < 0.01) m.a = m.at; }
    }
  }

  // a mover arriving in its new cell shoves the neighbours, who settle back
  function land(m) {
    const f = m.fly; m.fly = null; m.sv += 2.5;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const cx = m.cx + dx, cy = m.cy + dy;
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      const n = grid[cy * cols + cx];
      if (!n || n.pt > 0 || n.fly) continue;
      const d = Math.hypot(dx, dy);
      n.vx += f.ux * 55 + (dx / d) * 60; n.vy += f.uy * 55 + (dy / d) * 60;
    }
  }

  function idleMove() {
    for (let tries = 0; tries < 14; tries++) {
      const m = marks[(Math.random() * marks.length) | 0];
      if (!m || m.born > 0 || m.pt > 0 || m.fly || m.vx || m.vy) continue;
      if (link && (m === link.src || link.set.has(m))) continue;
      let dx = 0, dy = 0;
      const far = 1 + ((Math.random() * Math.random() * 8) | 0);
      if (Math.random() < 0.6) { if (Math.random() < 0.5) dx = Math.random() < 0.5 ? -far : far; else dy = Math.random() < 0.5 ? -far : far; }
      else { dx = ((Math.random() * 9) | 0) - 4; dy = ((Math.random() * 9) | 0) - 4; }
      if (!dx && !dy) continue;
      const cx = m.cx + dx, cy = m.cy + dy;
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      const idx = cy * cols + cx;
      if (!free[idx] || grid[idx]) continue;
      // the stretched mover must not smear across the knocked-out text
      let clear = true;
      const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
      for (let s = 1; s < steps && clear; s++) {
        const sx = Math.round(m.cx + (dx * s) / steps), sy = Math.round(m.cy + (dy * s) / steps);
        if (!free[sy * cols + sx]) clear = false;
      }
      if (!clear) continue;
      grid[m.cy * cols + m.cx] = null; grid[idx] = m;
      m.cx = cx; m.cy = cy; m.hx = ox + cx * cell + cell / 2; m.hy = oy + cy * cell + cell / 2;
      const d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      m.px = m.hx; m.py = m.hy; m.pt = 0.15; m.k = 250; m.c = 18;
      m.vx -= ux * 130; m.vy -= uy * 130;          // anticipation: lean back first
      m.fly = { ux, uy };
      return;
    }
  }

  /* ───── drawing ───── */
  function drawMark(m) {
    if (m.a < 0.01 || m.s < 0.02) return;
    const h = size * 0.5 * m.s, sp = Math.hypot(m.vx, m.vy);
    let L = sp * 0.05; if (L > size * 7) L = size * 7;
    ctx.globalAlpha = m.a; ctx.fillStyle = m.fill;
    if (L < 1) {
      if (m.sq) ctx.fillRect(m.x - h, m.y - h, h * 2, h * 2);
      else { ctx.beginPath(); ctx.arc(m.x, m.y, h, 0, TAU); ctx.fill(); }
      return;
    }
    const thin = Math.max(0.46, 1 - L / (size * 5.5)), ux = m.vx / sp, uy = m.vy / sp;
    if (!m.sq) {
      ctx.strokeStyle = m.fill; ctx.lineCap = 'round'; ctx.lineWidth = h * 2 * thin;
      ctx.beginPath(); ctx.moveTo(m.x - ux * L, m.y - uy * L); ctx.lineTo(m.x + ux * L * 0.12, m.y + uy * L * 0.12); ctx.stroke();
    } else {
      const ang = Math.atan2(uy, ux), q = Math.round(ang / (Math.PI / 2)), red = ang - q * (Math.PI / 2);
      const f = Math.min(1, L / (size * 0.9));
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(q * (Math.PI / 2) + red * f);
      ctx.fillRect(-L - h, -h * thin, L * 1.12 + h * 2, h * 2 * thin);
      ctx.restore();
    }
  }

  function ring(m, r, lw) {
    ctx.lineWidth = lw; ctx.strokeStyle = INK;
    if (m.sq) ctx.strokeRect(m.x - r, m.y - r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, TAU); ctx.stroke(); }
  }

  function paperTag(text, x, y, alpha, align) {
    const w = ctx.measureText(text).width, fh = W < 700 ? 11 : 12;
    const lx = align === 'center' ? x - w / 2 : x;
    ctx.globalAlpha = alpha; ctx.fillStyle = '#fff';
    ctx.fillRect(lx - 4, y - fh / 2 - 3.5, w + 8, fh + 7);
    ctx.fillStyle = INK; ctx.fillText(text, lx, y + 0.5);
  }

  function drawLink(L, alpha) {
    const s = L.src;
    ctx.lineCap = 'butt';
    for (let i = 0; i < L.rels.length; i++) {
      const r = L.rels[i], p = reduced ? 1 : easeOut((now - L.t0 - i * 0.05) / 0.34);
      r.p = p; if (p <= 0) continue;
      const dx = r.m.x - s.x, dy = r.m.y - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const a0 = size * 0.74, a1 = Math.max(a0, d - size * 0.74), e = a0 + (a1 - a0) * p;
      ctx.globalAlpha = alpha; ctx.strokeStyle = INK; ctx.lineWidth = r.kind === 't' ? 1.8 : 1.15;
      ctx.lineCap = r.kind === 't' ? 'round' : 'butt'; ctx.setLineDash(DASH[r.kind] || []);
      ctx.beginPath(); ctx.moveTo(s.x + ux * a0, s.y + uy * a0); ctx.lineTo(s.x + ux * e, s.y + uy * e); ctx.stroke();
      ctx.setLineDash([]); ctx.lineCap = 'butt';
      if (p >= 0.999) {
        if (!r.hit) { r.hit = now; if (!reduced) r.m.sv += 7; }
        if (reduced) { ctx.globalAlpha = alpha; ring(r.m, size * 0.72, 1.15); }
        else {
          const ph = ((now - r.hit) % 1.7) / 1.0;
          ctx.globalAlpha = alpha; ring(r.m, size * 0.72, 1.15);
          if (ph < 1) { ctx.globalAlpha = alpha * (1 - ph) * 0.8; ring(r.m, size * (0.72 + 0.62 * easeOut(ph)), 1.15); }
        }
      }
    }
    ctx.globalAlpha = alpha; ring(s, size * 0.78, 1.8);
    ctx.font = labelFont(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (const r of L.rels) {
      if (r.p > 0.6 && r.lx != null) paperTag(r.label, r.lx, r.ly, alpha * clamp((r.p - 0.6) / 0.4, 0, 1));
    }
    // the hovered mark says what it is
    const c = L.chip, ca = reduced ? 1 : easeOut((now - L.t0) / 0.2);
    ctx.globalAlpha = alpha * ca; ctx.fillStyle = INK;
    ctx.fillRect(c.x, c.y + (1 - ca) * 6 * c.dir, c.w, c.h);
    ctx.fillStyle = '#fff'; ctx.fillText(c.text, c.x + 8, c.y + c.h / 2 + 0.5 + (1 - ca) * 6 * c.dir);
  }

  function drawLayout(Lo, alpha) {
    ctx.lineCap = 'butt'; ctx.strokeStyle = INK; ctx.lineWidth = 1.15;
    ctx.font = labelFont(); ctx.textBaseline = 'middle';
    Lo.nodes.forEach((n, j) => {
      const p = Lo.instant ? 1 : easeOut((now - Lo.t0 - 0.42 - j * 0.07) / 0.45);
      if (p <= 0) return;
      const dx = n.x - Lo.cx, dy = n.y - Lo.cy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const e = Math.max(0, d - n.r - 5) * p;
      ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(Lo.cx, Lo.cy); ctx.lineTo(Lo.cx + ux * e, Lo.cy + uy * e); ctx.stroke();
      const la = clamp((p - 0.5) / 0.5, 0, 1);
      if (la > 0) { ctx.textAlign = 'left'; paperTag(n.label, n.x, n.uy < -0.3 ? n.y + n.top - 11 : n.y + n.bot + 12, alpha * la, 'center'); }
    });
    // hub: the project name on a paper patch
    const hp = Lo.instant ? 1 : easeOut((now - Lo.t0 - 0.25) / 0.4);
    if (hp > 0) {
      const fs = W < 700 ? 17 : 22;
      ctx.font = '600 ' + fs + 'px "Space Grotesk", system-ui, sans-serif'; ctx.textAlign = 'center';
      const w = ctx.measureText(Lo.name).width;
      ctx.globalAlpha = alpha * hp; ctx.fillStyle = '#fff';
      ctx.fillRect(Lo.cx - w / 2 - 9, Lo.cy - fs * 0.5 - 7, w + 18, fs + 14);
      ctx.fillStyle = INK; ctx.fillText(Lo.name, Lo.cx, Lo.cy + 1);
      ctx.textAlign = 'left';
    }
  }

  function render() {
    if (!built) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < marks.length; i++) if (!marks[i].hi) drawMark(marks[i]);
    for (let i = 0; i < marks.length; i++) if (marks[i].hi) drawMark(marks[i]);
    if (oldLayout) { const a = 1 - (now - oldLayout.tc) / 0.18; if (a <= 0) oldLayout = null; else drawLayout(oldLayout, a); }
    if (layout) drawLayout(layout, 1);
    if (oldLink) { const a = 1 - (now - oldLink.tc) / 0.16; if (a <= 0) oldLink = null; else drawLink(oldLink, a); }
    if (link) drawLink(link, 1);
    ctx.globalAlpha = 1;
  }

  /* ───── links between relatives ───── */
  function applyAlpha(instant) {
    for (const k of marks) {
      let at = 1;
      if (gathered >= 0) at = k.p === gathered ? 1 : 0.11;
      if (link && k !== link.src && !link.set.has(k)) at = gathered >= 0 ? (k.p === gathered ? 0.3 : 0.08) : 0.26;
      k.at = at; k.hi = at > 0.6;
      if (instant || reduced) k.a = at;
    }
  }

  // Three links per mark, each a different kind of connection, and no word repeats inside one diagram:
  //   solid  — the same project, a different method   ("also testing")
  //   dashed — the same method, another project       ("prototype in Sthir")
  //   dotted — the same theme, a third project, a third method ("trust, like Indian Bank")
  // The chip on the mark itself carries only its project name.
  function pickRelatives(src) {
    const R = rng(src.id * 977 + 13);
    const minD = cell * 2.7, maxD = Math.min(cell * 15, Math.max(W, H) * 0.46);
    const used = new Set([src]), angs = [];
    function pick(test) {
      const c = [];
      for (const k of marks) {
        if (used.has(k) || k.born > 0 || !free[k.cy * cols + k.cx] || k.ty < area.y + 4 || !test(k)) continue;
        const dx = k.tx - src.tx, dy = k.ty - src.ty, d = Math.hypot(dx, dy);
        if (d < minD || d > maxD) continue;
        c.push({ k, a: Math.atan2(dy, dx), w: R() });
      }
      c.sort((a, b) => a.w - b.w);
      for (const sep of [0.6, 0.35, 0]) {
        for (const q of c) {
          let ok = true;
          for (const a of angs) { let d = Math.abs(a - q.a) % TAU; if (d > Math.PI) d = TAU - d; if (d < sep) { ok = false; break; } }
          if (ok) { used.add(q.k); angs.push(q.a); return q.k; }
        }
      }
      return null;
    }
    const chosen = [];
    const a = pick(k => k.p === src.p && k.mk !== src.mk);
    if (a) chosen.push({ m: a, kind: 'p', label: 'also ' + METHODS[a.mk].label });
    const b = pick(k => k.mk === src.mk && k.p !== src.p);
    if (b) chosen.push({ m: b, kind: 'm', label: METHODS[src.mk].label + ' in ' + PROJECTS[b.p].name });
    const c = pick(k => k.th === src.th && k.p !== src.p && (!b || k.p !== b.p) && k.mk !== src.mk && (!a || k.mk !== a.mk));
    if (c) chosen.push({ m: c, kind: 't', label: THEMES[src.th] + ', like ' + PROJECTS[c.p].name });
    return chosen.map(r => Object.assign(r, { p: 0, hit: 0, lx: null, ly: 0 }));
  }
  const DASH = { p: [], m: [7, 5], t: [1.5, 4.5] };

  function setLink(m, quiet) {
    if (link && link.src === m) return;
    if (!m) {
      if (link) { link.tc = now; oldLink = link; link = null; applyAlpha(); if (!quiet) say(''); kick(); }
      return;
    }
    const rels = pickRelatives(m);
    link = { src: m, rels, t0: now, set: new Set(rels.map(r => r.m)), chip: null };
    oldLink = null;
    // chip
    ctx.font = labelFont();
    const text = PROJECTS[m.p].name;
    const cw = ctx.measureText(text).width + 16, ch = W < 700 ? 22 : 24;
    let cy = m.ty - size * 0.5 - 12 - ch, dir = 1;
    if (cy < area.y) { cy = m.ty + size * 0.5 + 12; dir = -1; }
    const chip = { text, w: cw, h: ch, x: clamp(m.tx - cw / 2, 6, W - cw - 6), y: cy, dir };
    link.chip = chip;
    // labels sit on their lines and step aside for each other
    const boxes = [[chip.x - 4, chip.y - 4, chip.x + cw + 4, chip.y + ch + 4]];
    const ringR = size * 0.8;   // keep labels off the marks and their pulse rings
    for (const k of [m].concat(rels.map(r => r.m))) boxes.push([k.tx - ringR, k.ty - ringR, k.tx + ringR, k.ty + ringR]);
    const fh = W < 700 ? 11 : 12;
    for (const r of rels) {
      const w = ctx.measureText(r.label).width;
      // on the line first; if the line is too short, beside the far mark
      const off = size * 0.95 + 4;
      const spots = [0.56, 0.7, 0.42, 0.82, 0.3, 0.92].map(f => [m.tx + (r.m.tx - m.tx) * f - w / 2, m.ty + (r.m.ty - m.ty) * f])
        .concat([[r.m.tx + off, r.m.ty], [r.m.tx - off - w, r.m.ty], [r.m.tx - w / 2, r.m.ty + off], [r.m.tx - w / 2, r.m.ty - off]]);
      for (const [x, y] of spots) {
        const b = [x - 6, y - fh / 2 - 5, x + w + 6, y + fh / 2 + 5];
        if (b[0] < 2 || b[2] > W - 2 || b[1] < 2 || b[3] > H - 2) continue;
        let hit = false;
        for (const o of boxes) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) { hit = true; break; }
        if (hit) continue;
        r.lx = x; r.ly = y; boxes.push(b); break;
      }
    }
    applyAlpha();
    if (!reduced) m.sv += 8;
    if (!quiet) describe(m, rels);
    kick();
  }

  function describe(m, rels) {
    say('A ' + METHODS[m.mk].label + ' mark from ' + PROJECTS[m.p].name + '. Linked to: ' + (rels.map(r => r.label).join('; ') || 'nothing nearby') + '.');
  }
  function say(t) { if (statusEl) statusEl.textContent = t; }

  /* ───── gather a project ───── */
  function setGather(p, instant) {
    if (!built || p === gathered) return;
    setLink(null, true);
    if (layout) { layout.tc = now; oldLayout = layout; layout = null; }
    gathered = p;
    const quick = instant || reduced;
    if (p >= 0) {
      const P = PROJECTS[p];
      const mine = marks.filter(m => m.p === p);
      const groups = P.methods.map(key => ({ key, list: mine.filter(m => m.mk === key) })).filter(g => g.list.length);
      groups.forEach(g => { g.n = g.list.length; });
      const sp = size + 2;
      const maxN = Math.max.apply(null, groups.map(g => g.n));
      const cr = (Math.sqrt(maxN / Math.PI) + 0.7) * sp;
      const need = cr / Math.sin(Math.PI / groups.length) * 1.02;
      let rx = Math.min(area.w / 2 - cr - 8, cell * 9.2), ry = Math.min(area.h / 2 - cr - 26, rx);
      rx = Math.max(rx, Math.min(need, area.w / 2 - cr * 0.8)); ry = Math.max(ry, Math.min(need * 0.9, area.h / 2 - cr));
      const cx = Math.round(area.x + area.w / 2), cy = Math.round(area.y + area.h / 2);
      const nodes = constellation(groups, cx, cy, rx, ry, sp);
      layout = { cx, cy, name: P.name, nodes, t0: now, instant: quick };
      const far = Math.hypot(W, H);
      nodes.forEach((n, j) => {
        n.label = METHODS[n.key].label;
        const list = groups[j].list.slice().sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y));
        list.forEach((m, i) => {
          const s = n.slots[i], dx = s[0] - m.x, dy = s[1] - m.y, d = Math.hypot(dx, dy) || 1;
          m.px = s[0]; m.py = s[1]; m.fly = null;
          if (quick) { m.x = m.tx = s[0]; m.y = m.ty = s[1]; m.vx = m.vy = 0; m.pt = 0; }
          else {
            m.pt = 0.1 + (d / far) * 0.5 + Math.random() * 0.14;
            m.k = 105 + Math.random() * 40; m.c = 12.5 + Math.random() * 2;
            m.vx -= (dx / d) * 150; m.vy -= (dy / d) * 150;   // lean away, then go
          }
        });
      });
    }
    // everyone who is not in the gathered project goes home
    for (const m of marks) {
      if (m.p === p) continue;
      if (m.px === m.hx && m.py === m.hy && m.tx === m.hx && m.ty === m.hy) continue;
      m.px = m.hx; m.py = m.hy; m.fly = null;
      if (quick) { m.x = m.tx = m.hx; m.y = m.ty = m.hy; m.vx = m.vy = 0; m.pt = 0; }
      else { m.pt = 0.02 + Math.random() * 0.3; m.k = 150 + Math.random() * 50; m.c = 15 + Math.random() * 2; }
    }
    applyAlpha(instant);
    btns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.p === p)));
    if (outEl) {
      if (p >= 0) {
        const P = PROJECTS[p];
        outEl.innerHTML = '<b>' + P.name + '.</b> ' + P.title + '. <a href="' + P.href + '">Read the case study <span aria-hidden="true">&rarr;</span></a>';
      } else outEl.innerHTML = outDefault;
    }
    nextMove = now + 1.5;
    kick();
  }

  /* ───── pointer, touch, keyboard ───── */
  function nearest(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const m of marks) {
      if (gathered >= 0 && m.p !== gathered) continue;
      if (m.born > 0) continue;
      const dx = m.x - x, dy = m.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  function local(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function acted() { userActed = true; clearTimeout(demoTimer); }

  hero.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    if (!built) return;
    acted(); kbd = false;
    const [x, y] = local(e);
    const m = e.target.closest('a,button') ? null : nearest(x, y, cell * 0.8);
    if (m) { hoverT = now; setLink(m); }
    else if (link && now - hoverT > 0.09) setLink(null);
    else if (link) kick();
  });
  hero.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !kbd) setLink(null); });

  let tap = null;
  hero.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') tap = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  hero.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch' || !tap || !built) return;
    const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y), dt = performance.now() - tap.t; tap = null;
    if (moved > 12 || dt > 600 || e.target.closest('a,button')) return;
    acted(); kbd = false;
    const [x, y] = local(e);
    const m = nearest(x, y, cell * 1.5);
    if (m && link && link.src === m) setLink(null); else setLink(m);
  });

  cv.addEventListener('keydown', e => {
    if (!built) return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (dir) {
      e.preventDefault(); acted(); kbd = true;
      const cur = link ? link.src : null;
      if (!cur) { setLink(nearest(area.x + area.w / 2, area.y + area.h / 2, 1e5)); return; }
      let best = null, bs = 1e9;
      for (const m of marks) {
        if (m === cur || (gathered >= 0 && m.p !== gathered)) continue;
        const dx = m.tx - cur.tx, dy = m.ty - cur.ty, along = dx * dir[0] + dy * dir[1], perp = Math.abs(dx * dir[1] - dy * dir[0]);
        if (along < cell * 0.5 || perp > along * 1.3 + cell * 0.4) continue;
        const sc = along + perp * 2.2;
        if (sc < bs) { bs = sc; best = m; }
      }
      if (best) setLink(best);
    }
  });
  cv.addEventListener('focus', () => {
    if (!built || !cv.matches(':focus-visible')) return;
    acted(); kbd = true;
    if (!link) setLink(nearest(area.x + area.w / 2, area.y + area.h / 2, 1e5));
  });
  cv.addEventListener('blur', () => { if (kbd) { kbd = false; setLink(null); } });
  hero.addEventListener('keydown', e => { if (e.key === 'Escape') { if (link) setLink(null); else if (gathered >= 0) setGather(-1); } });

  btns.forEach(b => b.addEventListener('click', () => {
    acted();
    const p = +b.dataset.p;
    setGather(gathered === p ? -1 : p);
  }));

  /* ───── a quiet demonstration until someone touches the field ───── */
  function demoPick() {
    const tx = area.x + area.w * (0.3 + Math.random() * 0.4), ty = area.y + area.h * (0.3 + Math.random() * 0.4);
    let best = null, bs = -1;
    for (let i = 0; i < 10; i++) {
      const m = nearest(tx + (Math.random() - 0.5) * cell * 6, ty + (Math.random() - 0.5) * cell * 6, cell * 4);
      if (!m) continue;
      const n = pickRelatives(m).length;
      if (n > bs) { bs = n; best = m; }
    }
    return best;
  }
  function demo() {
    if (userActed || reduced) return;
    if (gathered < 0 && heroOn && !document.hidden && built) {
      const m = demoPick();
      if (m) {
        setLink(m, true);
        demoTimer = setTimeout(() => { if (!userActed && link && link.src === m) setLink(null, true); demoTimer = setTimeout(demo, 3200); }, 5200);
        return;
      }
    }
    demoTimer = setTimeout(demo, 3000);
  }
  function showStill() {
    // reduced motion: one connection is simply there, already drawn
    if (userActed || gathered >= 0) return;
    const R = rng(5);
    let best = null, bs = -1;
    for (let i = 0; i < 16; i++) {
      const m = nearest(area.x + area.w * (0.35 + R() * 0.3), area.y + area.h * (0.35 + R() * 0.3), cell * 4);
      if (!m) continue;
      const n = pickRelatives(m).length;
      if (n > bs) { bs = n; best = m; }
    }
    if (best) setLink(best, true);
  }

  /* ───── loop ───── */
  function frame(t) {
    raf = 0;
    if (!running) return;
    let dt = (t - last) / 1000; last = t;
    if (dt > 0.25) dt = 0.25; if (dt < 0) dt = 0;   // slow frames still advance in real time, in small sub-steps
    now += dt;
    if (!reduced) {
      const n = Math.max(1, Math.ceil(dt / 0.0125));
      for (let i = 0; i < n; i++) step(dt / n);
      if (gathered < 0 && now > nextMove) {
        idleMove(); if (Math.random() < 0.28) idleMove();
        nextMove = now + 0.5 + Math.random() * 1.5;
      }
    }
    render();
    if (!reduced) raf = requestAnimationFrame(frame);
  }
  function kick() {            // reduced motion renders on demand; otherwise the loop is already going
    if (reduced && built) { now += 1; render(); }
  }
  function setRunning() {
    const want = heroOn && !document.hidden && built;
    if (want && !running) { running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); }
    else if (!want) running = false;
  }

  new IntersectionObserver(es => { heroOn = es[0].isIntersecting; setRunning(); if (!heroOn && gathered >= 0) setGather(-1, true); }, { threshold: 0.02 }).observe(hero);
  document.addEventListener('visibilitychange', setRunning);

  let rzT = 0, lastW = 0, lastH = 0;
  new ResizeObserver(() => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      if (!built) return;       // the first build waits for the fonts (see start)
      const r = hero.getBoundingClientRect();
      if (Math.round(r.width) === lastW && Math.abs(r.height - lastH) < 70) return;
      lastW = Math.round(r.width); lastH = r.height;
      build(); setRunning();
    }, 140);
  }).observe(hero);

  mqReduce.addEventListener('change', e => {
    reduced = e.matches; clearTimeout(demoTimer);
    for (const m of marks) { m.x = m.tx = m.px; m.y = m.ty = m.py; m.vx = m.vy = 0; m.pt = 0; m.s = m.st = 1; m.born = 0; m.a = m.at; }
    running = false; setRunning(); if (reduced) { showStill(); render(); } else demoTimer = setTimeout(demo, 1500);
  });

  function start() {
    if (built) return;
    const r = hero.getBoundingClientRect(); lastW = Math.round(r.width); lastH = r.height;
    build(); setRunning();
    if (!reduced) demoTimer = setTimeout(demo, 1350);
  }
  if (noHover) { const v = $('#verb'); if (v) v.textContent = 'Tap'; }
  const fontsReady = document.fonts && document.fonts.ready
    ? Promise.all([document.fonts.load('600 100px "Space Grotesk"'), document.fonts.load('500 11px "JetBrains Mono"'), document.fonts.ready]).catch(() => {})
    : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1800))]).then(() => requestAnimationFrame(start));

  /* ───────────── what went into each: every method once, a column per project ───────────── */
  const NS = 'http://www.w3.org/2000/svg';
  const ORDER = ['visit', 'interviews', 'research', 'testing', 'sharing', 'prototype', 'interface', 'service', 'strategy', 'brand'];
  const SHORT = ['Lexafide', 'Sthir', 'Fermio', 'Indian Bank'];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function fillTable() {
    const tb = $('#mix-table'); if (!tb || tb.children.length) return;
    tb.innerHTML = ORDER.map(key => {
      const used = PROJECTS.filter(P => P.methods.includes(key)).map(P => P.name);
      return '<tr><th scope="row">' + esc(METHODS[key].label) + '</th><td>' + esc(used.join(', ')) + '</td></tr>';
    }).join('');
  }

  function buildMix() {
    const fig = $('.mix-fig'); if (!fig) return;
    const fw = Math.round(fig.clientWidth); if (!fw) return;
    if (fig.dataset.w && Math.abs(+fig.dataset.w - fw) < 12) return;
    fig.dataset.w = fw;
    const narrow = fw < 560;
    const labW = narrow ? 112 : Math.min(220, Math.round(fw * 0.2));
    const rowH = narrow ? 34 : 42, headH = narrow ? 40 : 48, ms = narrow ? 14 : 18;
    const colW = (fw - labW) / PROJECTS.length;
    const Hf = headH + ORDER.length * rowH + 8;
    const R = rng(2203);
    let s = '<svg xmlns="' + NS + '" viewBox="0 0 ' + fw + ' ' + Hf + '" width="' + fw + '" height="' + Hf + '" focusable="false">';
    // column heads
    PROJECTS.forEach((P, j) => {
      const x = labW + colW * (j + 0.5);
      s += '<text class="ph" x="' + x.toFixed(1) + '" y="' + (headH - 18) + '" text-anchor="middle">' + esc(narrow && P.name === 'Indian Bank' ? 'Ind. Bank' : SHORT[j]) + '</text>';
    });
    ORDER.forEach((key, i) => {
      const M = METHODS[key], y = headH + rowH * (i + 0.5), fill = COL[M.col];
      s += '<line class="rule" x1="0" y1="' + (y + rowH / 2).toFixed(1) + '" x2="' + fw + '" y2="' + (y + rowH / 2).toFixed(1) + '"/>';
      s += '<text class="lb" x="0" y="' + (y + 4.5).toFixed(1) + '">' + esc(M.label) + '</text>';
      const cols = PROJECTS.map((P, j) => (P.methods.includes(key) ? j : -1)).filter(j => j >= 0);
      if (cols.length > 1) {
        const x1 = labW + colW * (cols[0] + 0.5), x2 = labW + colW * (cols[cols.length - 1] + 0.5), len = x2 - x1;
        s += '<line class="ln" style="--len:' + len.toFixed(1) + ';--i:' + i + '" x1="' + x1.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
      }
      cols.forEach((j, n) => {
        const x = labW + colW * (j + 0.5);
        const sx = Math.round((R() - 0.5) * fw * 0.5), sy = Math.round((R() - 0.5) * Hf * 0.7), r = Math.round((R() - 0.5) * 120);
        const st = 'style="--sx:' + sx + 'px;--sy:' + sy + 'px;--r:' + r + 'deg;--d:' + Math.round(i * 45 + n * 30 + R() * 140) + 'ms"';
        s += M.sq
          ? '<rect class="m" ' + st + ' x="' + (x - ms / 2).toFixed(1) + '" y="' + (y - ms / 2).toFixed(1) + '" width="' + ms + '" height="' + ms + '" fill="' + fill + '"/>'
          : '<circle class="m" ' + st + ' cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + ms / 2 + '" fill="' + fill + '"/>';
      });
    });
    s += '</svg>';
    const was = fig.classList.contains('in');
    fig.innerHTML = s;
    if (was || reduced) fig.classList.add('in');
  }

  fillTable(); buildMix();
  let fzT = 0;
  addEventListener('resize', () => { clearTimeout(fzT); fzT = setTimeout(buildMix, 180); });
  addEventListener('load', buildMix);
  const mixFig = $('.mix-fig');
  if (mixFig) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.3 });
    io.observe(mixFig);
  }
})();
