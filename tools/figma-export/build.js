#!/usr/bin/env node
// Generates the case-study pages (and all image/video/icon assets) from the Figma file.
//
//   cd tools/figma-export && npm install && node build.js [path/to/file.fig]
//
// Each case study is a 1440px-wide Figma frame with free-form layout, so it is
// exported as an absolutely positioned "canvas" that main.js scales to the
// viewport width. Header and footer come from partials.js (shared with index.html).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { load, index, buildTree, gid } = require('./fig');
const partials = require('./partials');

const ROOT = path.resolve(__dirname, '../..');
const FIG = process.argv[2] || path.join(ROOT, 'Portfolio from Figma.fig');
const OUT = {
  pages: path.join(ROOT, 'case-studies'),
  css: path.join(ROOT, 'assets/css/pages'),
  img: path.join(ROOT, 'assets/img'),
  video: path.join(ROOT, 'assets/video'),
  icons: path.join(ROOT, 'assets/icons'),
};

const PAGES = [
  { id: '1:2024', slug: 'indian-bank', title: 'Legacy to Loyalty: Reimagining Indian Bank', description: 'Converting a legacy brand into a loyal one: a business-backed rebrand and redesign of Indian Bank\'s core payments journey.' },
  { id: '1:3343', slug: 'sthir', title: 'Sthir: An assistive writing device for the elderly', description: 'A writing product that enhances confidence, independence, and ease of use for elderly people with hand tremors.' },
  { id: '1:1159', slug: 'fermio', title: 'Fermio: A user-centred battery disposal service', description: 'Transforming battery disposal into a seamless, rewarded family ritual that can increase collection rates to 60%.' },
];
// Mobile layout: force a treatment for specific nodes ('figure' | 'scroll' | 'scroll-center' | 'flow' | 'skip' | 'descend' | 'solo'),
// and `groups` to keep loose layers together ({ as: 'figure' | 'row', ids })
const MOBILE_OVERRIDES = {
  'indian-bank': {
    '1:2281': 'figure', // position mapping
    '1:2422': 'figure', // customer segmentation diagram
    '1:2371': 'figure', // iceberg
    '1:2353': 'figure', // blurred review screenshots
    '1:2175': 'figure', // mission statement pillars
  },
  sthir: {
    '1:3347': 'solo', // the wordmark sits above the product shot, not inside it
    '1:3382': 'scroll-center', // mind map: start on "Elderly" in the middle
    '1:3531': 'scroll', // AEIOU framework cards
    '1:3791': 'skip', '1:3804': 'skip', // collage arrows point at layers that are split up on mobile
    groups: [
      // Form experimentation collage: three people photos, the prototype blobs, the 3D-print grid
      { as: 'row', ids: ['1:3787', '1:3788', '1:3792', '1:3793', '1:3802', '1:3803'] },
      { as: 'figure', ids: ['1:3822', '1:3783', '1:3784', '1:3785', '1:3786', '1:3789', '1:3790'] },
      { as: 'figure', ids: ['1:3794', '1:3795', '1:3796', '1:3797', '1:3798', '1:3799', '1:3800', '1:3801', '1:3805', '1:3806', '1:3807', '1:3808', '1:3809', '1:3810', '1:3811', '1:3812'] },
    ],
  },
  fermio: {
    '1:1875': 'flow', // Hrithik: text, then the cut-out photo
    '1:1916': 'figure', // app screens collage
  },
};
// Figma frames -> site URLs (for prototype "navigate to" links)
const FRAME_LINKS = { '1:3056': '../index.html', '1:2024': 'indian-bank.html', '1:3343': 'sthir.html', '1:1159': 'fermio.html' };
// Shared chrome that is replaced by partials.js
const HEADER_NAME = 'Div [framer-lnfr45]';
const FOOTER_NAME = 'Div [framer-vAw4K]';
// Vector icons exported for the hand-written home page
const ICONS = {
  'id-card': '1:3073', 'linkedin-small': '1:3078', folder: '1:3086', 'task-alt': '1:3229',
  marketing: '1:3295', 'design-services': '1:3283', code: '1:3273', 'eye-tracking': '1:3263',
  'digital-wellbeing': '1:3250', handshake: '1:3240', email: '1:3323', linkedin: '1:3325',
};
// Images used by the home page (hash -> file name)
// crop = [x, y, w, h] as fractions of the source image (from the Figma image transform)
const HOME_IMAGES = {
  '0436d6fcd0c079aea299fd0ef61dee07e6675852': { name: 'logo', w: 226 },
  '6755c11586ff4ed945cbef41c30c99fc15844827': { name: 'card-indian-bank', w: 1074, crop: [0.42408, 0.00795, 0.53999, 0.60694] },
  '88916a97a53bf4d3affa4a9d926141731f10a07a': { name: 'card-sthir', w: 1078, crop: [0.31861, 0.08360, 0.63453, 0.56763] },
  'a85f94cd284f65db14ba557193a625929f438567': { name: 'card-fermio', w: 1070 },
};

// ---------------------------------------------------------------- utilities
const r2 = x => Math.round(x * 100) / 100;
const px = x => (Math.abs(x) < 0.005 ? '0' : r2(x) + 'px');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().replace(/\.(png|jpe?g|webp)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
const isNormal = b => !b || b === 'NORMAL' || b === 'PASS_THROUGH';
const blendCSS = b => b.toLowerCase().replace(/_/g, '-').replace('linear-burn', 'color-burn').replace('linear-dodge', 'color-dodge');
function rgba(c, op = 1) {
  const a = r2((c.a ?? 1) * op);
  const [r, g, b] = [c.r, c.g, c.b].map(v => Math.round(v * 255));
  if (a >= 1) return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  return `rgba(${r},${g},${b},${a})`;
}
const visible = ps => (ps || []).filter(p => p.visible !== false);

// ------------------------------------------------------------- style sheet
class Sheet {
  constructor() { this.byDecl = new Map(); this.rules = []; this.counts = {}; }
  cls(kind, decl, extra = []) {
    if (!decl && !extra.length) return '';
    // asset URLs are generated relative to the page; the stylesheet lives in assets/css/pages/
    const fix = d => d.replace(/url\(\.\.\/assets\//g, 'url(../../');
    decl = fix(decl); extra = extra.map(([sel, d]) => [sel, fix(d)]);
    const key = kind + '|' + decl + '|' + extra.map(e => e.join('{')).join('|');
    if (this.byDecl.has(key)) return this.byDecl.get(key);
    this.counts[kind] = (this.counts[kind] || 0) + 1;
    const name = kind + this.counts[kind];
    this.byDecl.set(key, name);
    if (decl) this.rules.push(`.${name}{${decl}}`);
    for (const [sel, d] of extra) this.rules.push(`.${name}${sel}{${d}}`);
    return name;
  }
  toString() { return this.rules.join('\n') + '\n'; }
}

// -------------------------------------------------------------------- fonts
const FONT_STACKS = {
  'SF Pro': "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
  'SF Compact Text': "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  'SF Compact Display': "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  'Product Sans': "'Product Sans', 'Google Sans', 'Poppins', sans-serif",
};
function fontInfo(fn) {
  const s = fn.style.toLowerCase().replace(/\s/g, '');
  const weight = s.includes('thin') ? 100 : /extralight|ultralight/.test(s) ? 200 : s.includes('light') ? 300 : s.includes('medium') ? 500 : /semibold|demibold/.test(s) ? 600 : /extrabold|ultrabold/.test(s) ? 800 : /black|heavy/.test(s) ? 900 : s.includes('bold') ? 700 : 400;
  return { family: fn.family, weight, italic: s.includes('italic') };
}

// ----------------------------------------------------------------- geometry
function blobPath(blobs, idx) {
  const b = blobs[idx]; if (!b) return '';
  let o = 0; const out = [];
  const f = () => { const v = b.readFloatLE(o); o += 4; return r2(v); };
  while (o < b.length) {
    const c = b[o++];
    if (c === 0) out.push('Z');
    else if (c === 1) out.push(`M${f()} ${f()}`);
    else if (c === 2) out.push(`L${f()} ${f()}`);
    else if (c === 3) out.push(`Q${f()} ${f()} ${f()} ${f()}`);
    else if (c === 4) out.push(`C${f()} ${f()} ${f()} ${f()} ${f()} ${f()}`);
    else break;
  }
  return out.join('');
}
const IDENT = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
function geom(n, { noSize } = {}) {
  const t = n.transform || IDENT, s = n.size || { x: 0, y: 0 };
  let c = noSize ? '' : `width:${px(s.x)};height:${px(s.y)};`;
  const plain = Math.abs(t.m00 - 1) < 1e-4 && Math.abs(t.m11 - 1) < 1e-4 && Math.abs(t.m01) < 1e-4 && Math.abs(t.m10) < 1e-4;
  if (plain) c += `left:${px(t.m02)};top:${px(t.m12)}`;
  else c += `left:0;top:0;transform-origin:0 0;transform:matrix(${[t.m00, t.m10, t.m01, t.m11, t.m02, t.m12].map(v => Math.round(v * 1e4) / 1e4).join(',')})`;
  return c;
}
function invMatrix(t) {
  const det = t.m00 * t.m11 - t.m01 * t.m10;
  const a = t.m11 / det, b = -t.m10 / det, c = -t.m01 / det, d = t.m00 / det;
  const e = -(a * t.m02 + c * t.m12), f = -(b * t.m02 + d * t.m12);
  return `matrix(${[a, b, c, d, e, f].map(v => Math.round(v * 1e4) / 1e4).join(',')})`;
}

// ================================================================ exporter
class Exporter {
  constructor(fig) {
    this.fig = fig; this.idx = index(fig.nodes);
    this.images = new Map(); // hash -> {file, w}
    this.videos = new Map();
  }

  // ---- assets
  image(p, dispW, dispH, name) {
    const hash = p.image.hash;
    // Figma's per-image colour adjustments (paintFilter) are not reproduced: the originals are exported
    let rec = this.images.get(hash);
    if (!rec) {
      rec = { hash, file: slugify(name) + '-' + hash.slice(0, 6) + '.webp', w: 0, iw: p.originalImageWidth, ih: p.originalImageHeight };
      this.images.set(hash, rec);
    }
    rec.w = Math.max(rec.w, dispW || 0);
    if (dispH && rec.iw && rec.ih) rec.w = Math.max(rec.w, dispH * rec.iw / rec.ih);
    return `${this.prefix}assets/img/${rec.file}`;
  }
  video(p, dispW, name) {
    const hash = p.video.hash;
    let rec = this.videos.get(hash);
    if (!rec) { rec = { hash, file: slugify(name) + '-' + hash.slice(0, 6) + '.mp4', w: 0 }; this.videos.set(hash, rec); }
    rec.w = Math.max(rec.w, dispW);
    return `${this.prefix}assets/video/${rec.file}`;
  }

  // ---- paints -> CSS
  imageLayer(p, W, H, name) {
    const iw = p.originalImageWidth || W, ih = p.originalImageHeight || H;
    const mode = p.imageScaleMode;
    const t = p.transform;
    let size, pos = 'center', rep = 'no-repeat', dw = W, dh = H;
    if (mode === 'FIT') size = 'contain';
    else if (mode === 'TILE') { const sc = p.scale || 1; size = `${px(iw * sc)} ${px(ih * sc)}`; pos = '0 0'; rep = 'repeat'; dw = iw * sc; }
    else if ((mode === 'STRETCH' || mode === 'CROP') && t && !(t.m00 === 1 && t.m11 === 1 && t.m02 === 0 && t.m12 === 0)) {
      dw = W / t.m00; dh = H / t.m11; size = `${px(dw)} ${px(dh)}`; pos = `${px(-t.m02 * dw)} ${px(-t.m12 * dh)}`;
    } else if (mode === 'STRETCH') size = '100% 100%';
    else { size = 'cover'; const sc = Math.max(W / iw, H / ih); dw = iw * sc; dh = ih * sc; }
    const url = this.image(p, dw, dh, name);
    return `url(${url}) ${pos} / ${size} ${rep}`;
  }
  gradient(p, W, H) {
    const t = p.transform || IDENT, op = p.opacity ?? 1;
    const det = t.m00 * t.m11 - t.m01 * t.m10;
    const ix = (x, y) => { const X = x - t.m02, Y = y - t.m12; return [(t.m11 * X - t.m01 * Y) / det, (-t.m10 * X + t.m00 * Y) / det]; };
    const stops = (p.stops || []).map(s => ({ c: rgba(s.color, op), pos: s.position }));
    if (p.type === 'GRADIENT_LINEAR') {
      const [x0, y0] = ix(0, 0.5), [x1, y1] = ix(1, 0.5);
      const P0 = [x0 * W, y0 * H], dx = (x1 - x0) * W, dy = (y1 - y0) * H;
      const ang = Math.atan2(dx, -dy);
      const u = [Math.sin(ang), -Math.cos(ang)];
      const L = Math.abs(W * Math.sin(ang)) + Math.abs(H * Math.cos(ang)) || 1;
      const s = stops.map(st => { const P = [P0[0] + st.pos * dx - W / 2, P0[1] + st.pos * dy - H / 2]; return `${st.c} ${r2(((P[0] * u[0] + P[1] * u[1]) / L + 0.5) * 100)}%`; });
      return `linear-gradient(${r2(ang * 180 / Math.PI)}deg, ${s.join(', ')})`;
    }
    const [cx, cy] = ix(0.5, 0.5), [ax, ay] = ix(1, 0.5), [bx, by] = ix(0.5, 1);
    const s = stops.map(st => `${st.c} ${r2(st.pos * 100)}%`);
    if (p.type === 'GRADIENT_ANGULAR') return `conic-gradient(from 90deg at ${r2(cx * 100)}% ${r2(cy * 100)}%, ${s.join(', ')})`;
    const rx = Math.hypot((ax - cx) * W, (ay - cy) * H), ry = Math.hypot((bx - cx) * W, (by - cy) * H);
    return `radial-gradient(${px(rx)} ${px(ry)} at ${r2(cx * 100)}% ${r2(cy * 100)}%, ${s.join(', ')})`;
  }
  // background CSS for a list of fills; returns {bg, layers:[extra divs css]}
  background(fills, W, H, name) {
    const layers = [], extra = [];
    for (const p of visible(fills)) {
      let css = null;
      if (p.type === 'SOLID') { const c = rgba(p.color, p.opacity ?? 1); css = `linear-gradient(${c},${c})`; }
      else if (p.type.startsWith('GRADIENT')) css = this.gradient(p, W, H);
      else if (p.type === 'IMAGE' && p.image) css = this.imageLayer(p, W, H, name);
      if (!css) continue;
      if (!isNormal(p.blendMode) || (p.type === 'IMAGE' && (p.opacity ?? 1) < 1)) extra.push(`background:${css};${(p.opacity ?? 1) < 1 && p.type === 'IMAGE' ? `opacity:${r2(p.opacity)};` : ''}${!isNormal(p.blendMode) ? `mix-blend-mode:${blendCSS(p.blendMode)};` : ''}`);
      else layers.push(css);
    }
    // a single solid colour reads better as background-color
    let bg = layers.reverse().join(', ');
    const m = /^linear-gradient\(([^(),]+|rgba\([^)]*\))\,\1\)$/.exec(bg);
    if (m) bg = m[1];
    return { bg, extra };
  }

  effects(n, kind) {
    const sh = [], filt = [], bf = [], ts = [];
    for (const e of (n.effects || [])) {
      if (e.visible === false) continue;
      const o = e.offset || { x: 0, y: 0 };
      if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
        const c = rgba(e.color);
        if (kind === 'box') sh.push(`${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(o.x)} ${px(o.y)} ${px(e.radius || 0)} ${px(e.spread || 0)} ${c}`);
        else if (kind === 'text') { if (e.type === 'DROP_SHADOW') ts.push(`${px(o.x)} ${px(o.y)} ${px(e.radius || 0)} ${c}`); }
        else if (e.type === 'DROP_SHADOW') filt.push(`drop-shadow(${px(o.x)} ${px(o.y)} ${px((e.radius || 0) / 2)} ${c})`);
      } else if (e.type === 'FOREGROUND_BLUR' || e.type === 'LAYER_BLUR') filt.push(`blur(${px((e.radius || 0) / 2)})`);
      else if (e.type === 'BACKGROUND_BLUR') bf.push(`blur(${px((e.radius || 0) / 2)})`);
    }
    let s = '';
    if (sh.length) s += `box-shadow:${sh.join(',')};`;
    if (ts.length) s += `text-shadow:${ts.join(',')};`;
    if (filt.length) s += `filter:${filt.join(' ')};`;
    if (bf.length) s += `backdrop-filter:${bf.join(' ')};-webkit-backdrop-filter:${bf.join(' ')};`;
    return s;
  }
  radius(n) {
    if (n.type === 'ELLIPSE') return 'border-radius:50%;';
    const c = [n.rectangleTopLeftCornerRadius, n.rectangleTopRightCornerRadius, n.rectangleBottomRightCornerRadius, n.rectangleBottomLeftCornerRadius];
    if (n.rectangleCornerRadiiIndependent && c.some(v => v)) {
      if (c.every(v => Math.abs((v || 0) - (c[0] || 0)) < 0.01)) return `border-radius:${px(c[0])};`;
      return `border-radius:${c.map(v => px(v || 0)).join(' ')};`;
    }
    return n.cornerRadius ? `border-radius:${px(n.cornerRadius)};` : '';
  }
  common(n) {
    let s = '';
    if (n.opacity != null && n.opacity < 0.999) s += `opacity:${r2(n.opacity)};`;
    if (!isNormal(n.blendMode)) s += `mix-blend-mode:${blendCSS(n.blendMode)};`;
    return s;
  }
  // stroke for boxes: [decl, pseudo-rules]
  stroke(n, W, H, canPseudo) {
    const sp = visible(n.strokePaints).filter(p => p.type === 'SOLID' || p.type.startsWith('GRADIENT'));
    if (!sp.length) return ['', []];
    const p = sp[sp.length - 1];
    const color = p.type === 'SOLID' ? rgba(p.color, p.opacity ?? 1) : rgba(p.stops[0].color, p.opacity ?? 1);
    const style = n.dashPattern && n.dashPattern.length ? 'dashed' : 'solid';
    const k = n.strokeAlign === 'OUTSIDE' ? 1 : n.strokeAlign === 'CENTER' ? 0.5 : 0;
    if (n.borderStrokeWeightsIndependent) {
      const w = [n.borderTopWeight, n.borderRightWeight, n.borderBottomWeight, n.borderLeftWeight].map(v => v || 0);
      if (!w.some(v => v) || !canPseudo) return ['', []];
      return ['', [['::after', `content:"";position:absolute;pointer-events:none;inset:${w.map(v => px(-v * k)).join(' ')};border-style:${style};border-color:${color};border-width:${w.map(px).join(' ')};border-radius:inherit`]]];
    }
    const w = n.strokeWeight || 0; if (!w) return ['', []];
    return [`outline:${px(w)} ${style} ${color};outline-offset:${px(-w * (1 - k))};`, []];
  }

  // ---- text
  fontDecl(fn, used) {
    const f = fontInfo(fn);
    if (!FONT_STACKS[f.family]) { if (!used.has(f.family)) used.set(f.family, new Set()); used.get(f.family).add((f.italic ? 'i' : '') + f.weight); }
    const stack = FONT_STACKS[f.family] || `'${f.family}', sans-serif`;
    return `font-family:${stack};font-weight:${f.weight};${f.italic ? 'font-style:italic;' : ''}`;
  }
  textLook(s, W, H, run) {
    let o = '';
    if (s.fontName) o += this.fontDecl(s.fontName, this.fonts);
    if (s.fontSize != null) o += `font-size:${px(s.fontSize)};`;
    const lh = s.lineHeight;
    if (lh && !run) o += `line-height:${lh.units === 'PIXELS' ? px(lh.value) : lh.units === 'PERCENT' ? r2(lh.value / 100) : lh.units === 'RAW' ? r2(lh.value) : 'normal'};`;
    const ls = s.letterSpacing;
    if (ls && ls.value) o += `letter-spacing:${ls.units === 'PIXELS' ? px(ls.value) : r2(ls.value / 100) + 'em'};`;
    else if (ls) o += 'letter-spacing:0;';
    if (s.textDecoration) o += `text-decoration:${{ UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' }[s.textDecoration] || 'none'};`;
    if (s.textCase) o += `text-transform:${{ UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' }[s.textCase] || 'none'};`;
    const vis = visible(s.fillPaints);
    const p = vis[vis.length - 1];
    if (p) {
      if (p.type === 'SOLID') o += `color:${rgba(p.color, p.opacity ?? 1)};`;
      else if (p.type.startsWith('GRADIENT')) o += `background:${this.gradient(p, W || 100, H || 20)};-webkit-background-clip:text;background-clip:text;color:transparent;`;
    } else if (s.fillPaints) o += 'color:transparent;';
    return o;
  }
  text(n, g, tag) {
    const td = n.textData; if (!td) return '';
    const chars = td.characters;
    const ids = td.characterStyleIDs || [];
    const table = {}; for (const s of (td.styleOverrideTable || [])) table[s.styleID] = s;
    const W = n.size.x, H = n.size.y;
    const align = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' }[n.textAlignHorizontal || 'LEFT'];
    let look = this.textLook(n, W, H) + `text-align:${align};` + this.effects(n, 'text') + this.common(n);
    const cls = this.sheet.cls('t', look);
    const base = n.lineHeight;
    const nominal = base && base.units === 'PIXELS' ? base.value : base && base.units === 'RAW' ? base.value * n.fontSize : base && base.units === 'PERCENT' ? base.value / 100 * n.fontSize : n.fontSize * 1.21;
    const fsOf = id => (table[id] && table[id].fontSize) || n.fontSize;
    // resolved line height (px) of a style run, following Figma's units
    const lhOf = (id, fs_) => {
      const lh = (table[id] && table[id].lineHeight) || n.lineHeight;
      if (!lh || lh.units === 'AUTO' || lh.units === undefined) return fs_ * 1.21;
      return lh.units === 'PIXELS' ? lh.value : lh.units === 'PERCENT' ? lh.value / 100 * fs_ : lh.value * fs_;
    };
    const runs = (s, e, lineFs) => {
      let html = '', cur = null, buf = '';
      const flush = () => {
        if (!buf) return;
        const st = table[cur];
        let seg = esc(buf);
        if (lineFs && !(st && st.fontSize)) seg = `<span style="font-size:${px(n.fontSize)}">${seg}</span>`;
        if (st) {
          const c = this.sheet.cls('s', this.textLook(st, W, H, true));
          if (c) seg = `<span class="${c}">${seg}</span>`;
          if (st.hyperlink && st.hyperlink.url) seg = `<a href="${esc(st.hyperlink.url)}" target="_blank" rel="noopener">${seg}</a>`;
        }
        // bare URLs typed into the design become real links
        if (!(st && st.hyperlink && st.hyperlink.url)) seg = seg.replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
        html += seg; buf = '';
      };
      for (let i = s; i < e; i++) { const id = ids[i] || 0; if (id !== cur) { flush(); cur = id; } buf += chars[i]; }
      flush();
      return html;
    };
    let bl = n.derivedTextData && n.derivedTextData.baselines;
    // Figma keeps stale layout data when an instance overrides the text; fall back to flowing text
    if (bl && bl.length && bl[bl.length - 1].endCharacter !== chars.length) bl = null;
    let inner = '', pad = '';
    if (bl && bl.length) {
      const glyphs = (n.derivedTextData.glyphs || []);
      const paraOf = i => { let c = 0; for (let k = 0; k < i; k++) if (chars[k] === '\n') c++; return c; };
      const counters = {};
      if (bl[0].lineY > 0.5) pad = `padding-top:${px(bl[0].lineY)};`;
      const lift = bl[0].lineY < -0.5 ? `margin-top:${px(bl[0].lineY)};` : '';
      bl.forEach((b, i) => {
        let s = b.firstCharacter, e = b.endCharacter;
        while (e > s && (chars[e - 1] === '\n' || chars[e - 1] === '\r')) e--;
        // Figma lays out each line with the metrics of its largest run
        let lineFs = 0, lineLH = 0;
        for (let k = s; k < e; k++) {
          const id = ids[k] || 0, fs_ = fsOf(id);
          if (fs_ >= lineFs) { lineLH = fs_ > lineFs ? lhOf(id, fs_) : Math.max(lineLH, lhOf(id, fs_)); lineFs = fs_; }
        }
        if (!lineFs) { lineFs = fsOf(ids[s] || 0); lineLH = lhOf(ids[s] || 0, lineFs); }
        const refit = Math.abs(lineFs - n.fontSize) > 0.01;
        let txt = runs(s, e, refit).replace(/[ \u2028]+(<\/[^>]+>)*$/, '$1');
        const next = bl[i + 1];
        const empty = !chars.slice(s, e).trim();
        const h = next ? next.lineY - b.lineY : empty ? b.lineHeight : lineLH;
        let st = '';
        if (refit) st += `font-size:${px(lineFs)};`;
        if (Math.abs(lineLH - nominal) > 0.05) st += `line-height:${px(lineLH)};`;
        if (empty || Math.abs(h - lineLH) > 0.05) st += `height:${px(h)};`;
        if (i === 0) st += lift;
        const para = paraOf(s);
        const lt = td.lines && td.lines[para] ? td.lines[para].lineType : 'PLAIN';
        const paraStart = s === 0 || chars[s - 1] === '\n';
        if ((align === 'left' || align === 'justify') && b.position.x > 0.5) st += `padding-left:${px(b.position.x)};`;
        if (align === 'justify' && next && !(chars[b.endCharacter - 1] === '\n')) st += 'text-align-last:justify;';
        let marker = '';
        if (lt !== 'PLAIN' && paraStart && !empty) {
          const gl = glyphs.find(q => q.firstCharacter === undefined && Math.abs(q.position.y - b.position.y) < 1);
          const mx = gl ? gl.position.x : Math.max(0, b.position.x - n.fontSize);
          let sym = '•';
          if (lt === 'ORDERED_LIST') { counters[td.lines[para].indentationLevel] = (counters[td.lines[para].indentationLevel] || 0) + 1; sym = counters[td.lines[para].indentationLevel] + '.'; }
          marker = `<span class="li" style="left:${px(mx)}" aria-hidden="true">${sym}</span>`;
        }
        inner += `<span class="ln"${st ? ` style="${st}"` : ''}${process.env.DEBUG_BASELINES ? ` data-by="${r2(b.position.y)}"` : ''}>${marker}${txt || ''}</span>`;
      });
    } else {
      inner = runs(0, chars.length).replace(/\n/g, '<br>');
      pad = 'white-space:pre-wrap;';
    }
    return `<${tag} class="${cls}" style="${g};${pad}">${inner}</${tag}>`;
  }
  headingTag(n) {
    const fs_ = n.fontSize || 0, w = n.fontName ? fontInfo(n.fontName).weight : 400;
    const oneLine = !n.textData.characters.trim().includes('\n') && n.textData.characters.length < 90;
    if (!oneLine) return 'p';
    if (fs_ >= 44 && !this.h1Done) { this.h1Done = true; return 'h1'; }
    if (fs_ >= 24 && w >= 500) return 'h2';
    if (fs_ >= 19 && w >= 600) return 'h3';
    return 'p';
  }

  // ---- vectors
  svg(n, W, H, g, cls) {
    const defs = [], paths = [];
    let gi = 0;
    const id = () => 'g' + gid(n.guid).replace(':', '_') + '_' + this.uid++ + '_' + (gi++);
    const fill = p => {
      if (p.type === 'SOLID') return [rgba(p.color), r2((p.color.a ?? 1) * (p.opacity ?? 1))];
      if (p.type.startsWith('GRADIENT')) {
        const t = p.transform || IDENT; const det = t.m00 * t.m11 - t.m01 * t.m10;
        const ix = (x, y) => { const X = x - t.m02, Y = y - t.m12; return [r2((t.m11 * X - t.m01 * Y) / det * W), r2((-t.m10 * X + t.m00 * Y) / det * H)]; };
        const stops = p.stops.map(s => `<stop offset="${r2(s.position)}" stop-color="${rgba({ ...s.color, a: 1 })}"${(s.color.a ?? 1) * (p.opacity ?? 1) < 1 ? ` stop-opacity="${r2((s.color.a ?? 1) * (p.opacity ?? 1))}"` : ''}/>`).join('');
        const i = id();
        if (p.type === 'GRADIENT_LINEAR') { const [x1, y1] = ix(0, 0.5), [x2, y2] = ix(1, 0.5); defs.push(`<linearGradient id="${i}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`); }
        else { const [cx, cy] = ix(0.5, 0.5), [ax, ay] = ix(1, 0.5), [bx, by] = ix(0.5, 1); defs.push(`<radialGradient id="${i}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(${cx} ${cy}) rotate(${r2(Math.atan2(ay - cy, ax - cx) * 180 / Math.PI)}) scale(${r2(Math.hypot(ax - cx, ay - cy))} ${r2(Math.hypot(bx - cx, by - cy))})">${stops}</radialGradient>`); }
        return [`url(#${i})`, 1];
      }
      if (p.type === 'IMAGE' && p.image) {
        const i = id();
        const url = this.image(p, W, H, n.name);
        defs.push(`<pattern id="${i}" patternUnits="userSpaceOnUse" width="${r2(W)}" height="${r2(H)}"><image href="${url}" width="${r2(W)}" height="${r2(H)}" preserveAspectRatio="${p.imageScaleMode === 'FIT' ? 'xMidYMid meet' : p.imageScaleMode === 'STRETCH' ? 'none' : 'xMidYMid slice'}"/></pattern>`);
        return [`url(#${i})`, p.opacity ?? 1];
      }
      return null;
    };
    const add = (geo, paints, rule) => {
      for (const gm of (geo || [])) {
        const d = blobPath(this.fig.blobs, gm.commandsBlob); if (!d) continue;
        for (const p of visible(paints)) {
          const f = fill(p); if (!f) continue;
          paths.push(`<path d="${d}" fill="${f[0]}"${f[1] < 1 ? ` fill-opacity="${f[1]}"` : ''}${(rule || gm.windingRule) === 'EVENODD' ? ' fill-rule="evenodd"' : ''}${!isNormal(p.blendMode) ? ` style="mix-blend-mode:${blendCSS(p.blendMode)}"` : ''}/>`);
        }
      }
    };
    add(n.fillGeometry, n.fillPaints);
    add(n.strokeGeometry, n.strokePaints, 'NONZERO');
    if (!paths.length) return '';
    return `<svg class="v${cls ? ' ' + cls : ''}" style="${g}" width="${r2(W)}" height="${r2(H)}" viewBox="0 0 ${r2(W)} ${r2(H)}" aria-hidden="true">${defs.length ? '<defs>' + defs.join('') + '</defs>' : ''}${paths.join('')}</svg>`;
  }

  // ---- links from prototype interactions
  link(n) {
    if (n.hyperlink && n.hyperlink.url) return `href="${esc(n.hyperlink.url)}" target="_blank" rel="noopener"`;
    for (const pi of (n.prototypeInteractions || [])) {
      if (pi.isDeleted || !pi.event || pi.event.interactionType !== 'ON_CLICK') continue;
      for (const a of (pi.actions || [])) {
        if (a.connectionType === 'URL' && a.connectionURL) {
          const u = a.connectionURL.includes('@') && !a.connectionURL.includes('://') ? 'mailto:' + a.connectionURL : a.connectionURL;
          return u.startsWith('mailto:') ? `href="${esc(u)}"` : `href="${esc(u)}" target="_blank" rel="noopener"`;
        }
        if (a.connectionType === 'INTERNAL_NODE' && a.navigationType === 'NAVIGATE' && a.transitionNodeID && FRAME_LINKS[gid(a.transitionNodeID)]) return `href="${FRAME_LINKS[gid(a.transitionNodeID)]}"`;
      }
    }
    return '';
  }

  // ---- FigJam-style nodes (tables, connectors, shapes with text)
  immutable(n, g) {
    const P = o => o.guidPath.guids.map(gid).join('/');
    const der = n.derivedImmutableFrameData.overrides, ngd = (n.nodeGenerationData && n.nodeGenerationData.overrides) || [];
    const ng = {}; for (const o of ngd) ng[P(o)] = Object.assign(ng[P(o)] || {}, o);
    const role = o => o.guidPath.guids[0].localID, rest = o => o.guidPath.guids.slice(1).map(gid).join('/');
    const rowY = {}, cellPos = {};
    if (n.type === 'TABLE') {
      const rows = n.tableRowPositions.entries.slice().sort((a, b) => (a.position < b.position ? -1 : 1)).map(e => gid(e.id));
      const h = {}; for (const o of der) if (role(o) === 0) { const r = gid(o.guidPath.guids[1]); h[r] = Math.max(h[r] || 0, o.size.y); }
      let y = 0; for (const r of rows) { rowY[r] = y; y += h[r] || 0; }
    }
    let html = '';
    if (n.type === 'TABLE') { const { bg } = this.background(n.fillPaints, n.size.x, n.size.y, n.name); html += `<div class="${this.sheet.cls('b', `background:${bg};${this.radius(n)}`)}" style="inset:0"></div>`; }
    for (const o of der) {
      const r = role(o), key = rest(o);
      const style = Object.assign({}, ng['40000000:' + r] || {}, ng[P(o)] || {});
      let x = o.transform ? o.transform.m02 : 0, y = o.transform ? o.transform.m12 : 0;
      if (n.type === 'TABLE') { const row = gid(o.guidPath.guids[1]); if (r === 0) { y += rowY[row] || 0; cellPos[key] = [x, y]; } else { const c = cellPos[key] || [0, rowY[row] || 0]; x += c[0]; y += c[1]; } }
      const node = Object.assign({ guid: { sessionID: 9, localID: this.uid++ }, name: n.name }, style, { size: o.size, transform: Object.assign({}, o.transform || IDENT, { m02: x, m12: y }), fillGeometry: o.fillGeometry, strokeGeometry: o.strokeGeometry });
      if (o.derivedTextData) {
        if (!style.textData) continue;
        node.type = 'TEXT'; node.derivedTextData = o.derivedTextData;
        node.fontName = node.fontName || { family: 'Inter', style: 'Regular' };
        node.fillPaints = node.fillPaints || [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1 }];
        if (!node.lineHeight && o.derivedTextData.baselines && o.derivedTextData.baselines[0]) node.lineHeight = { units: 'PIXELS', value: o.derivedTextData.baselines[0].lineHeight };
        html += this.text(node, geom(node), 'p');
      } else {
        if (n.type === 'TABLE' && !node.strokePaints) node.strokePaints = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0.1 }, opacity: 1 }];
        if (r === 2 && !node.fillPaints) node.fillPaints = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }];
        if (!node.fillPaints) node.fillPaints = [];
        html += this.svg(node, o.size.x, o.size.y, geom(node), this.sheet.cls('e', this.effects(node, 'svg')));
      }
    }
    return `<div class="${this.sheet.cls('b', this.common(n))}" style="${g}">${html}</div>`;
  }

  // ---- main node emitter
  node(tn, depth) {
    const n = tn.node;
    if (n.visible === false || n.type === 'SLICE') return '';
    if (n.name === HEADER_NAME || n.name === FOOTER_NAME) return '';
    const g = geom(n);
    const W = n.size ? n.size.x : 0, H = n.size ? n.size.y : 0;
    if (n.derivedImmutableFrameData && ['TABLE', 'CONNECTOR', 'SHAPE_WITH_TEXT'].includes(n.type)) return this.immutable(n, g);
    if (n.type === 'TEXT') {
      const tag = this.headingTag(n);
      const href = this.link(n);
      const t = this.text(n, g, tag);
      return href ? `<a ${href} class="lnk" style="${g}">${t.replace(/style="[^"]*"/, 'style="left:0;top:0;width:100%;height:100%"')}</a>` : t;
    }
    const container = ['FRAME', 'INSTANCE', 'SYMBOL', 'GROUP', 'SECTION'].includes(n.type);
    const arc = n.type === 'ELLIPSE' && n.arcData && (n.arcData.innerRadius || Math.abs((n.arcData.endingAngle - n.arcData.startingAngle) - 2 * Math.PI) > 1e-3);
    const boxish = container || (['ROUNDED_RECTANGLE', 'RECTANGLE', 'ELLIPSE'].includes(n.type) && !arc);
    const href = this.link(n);
    if (!boxish) {
      const cls = this.sheet.cls('e', this.effects(n, 'svg') + this.common(n));
      const s = this.svg(n, W, H, g, cls);
      return href && s ? `<a ${href} class="lnk" style="${g}">${s.replace(/style="[^"]*"/, 'style="left:0;top:0"')}</a>` : s;
    }
    const fills = visible(n.fillPaints);
    const leaf = !tn.children.length;
    const [strokeDecl, strokePseudo] = this.stroke(n, W, H, true);
    const fx = this.effects(n, 'box') + this.common(n) + this.radius(n);
    // video
    const vid = fills.find(p => p.type === 'VIDEO' && p.video);
    if (vid && leaf) {
      const src = this.video(vid, W, n.name);
      const poster = vid.image && vid.image.hash ? this.image({ ...vid, image: vid.image }, W, H, n.name + '-poster') : '';
      const cls = this.sheet.cls('i', `object-fit:${vid.imageScaleMode === 'FIT' ? 'contain' : 'cover'};${fx}${strokeDecl}`);
      return `<video class="${cls}" style="${g}" data-src="${src}"${poster ? ` poster="${poster}"` : ''} muted loop playsinline preload="none"></video>`;
    }
    // plain image -> <img>
    const img = fills.length && fills[fills.length - 1].type === 'IMAGE' ? fills[fills.length - 1] : null;
    const t = img && img.transform;
    const identity = !t || (Math.abs(t.m00 - 1) < 1e-4 && Math.abs(t.m11 - 1) < 1e-4 && Math.abs(t.m02) < 1e-4 && Math.abs(t.m12) < 1e-4);
    if (img && leaf && !container && fills.slice(0, -1).every(p => p.type === 'SOLID') && (img.opacity ?? 1) >= 0.999 && isNormal(img.blendMode) && (img.imageScaleMode === 'FILL' || img.imageScaleMode === 'FIT' || (img.imageScaleMode === 'STRETCH' && identity))) {
      const fit = { FILL: 'cover', FIT: 'contain', STRETCH: 'fill' }[img.imageScaleMode];
      let dw = W, dh = H;
      if (fit === 'cover' && img.originalImageWidth) { const sc = Math.max(W / img.originalImageWidth, H / img.originalImageHeight); dw = img.originalImageWidth * sc; dh = img.originalImageHeight * sc; }
      const src = this.image(img, dw, dh, n.name);
      const under = fills.slice(0, -1).pop();
      const cls = this.sheet.cls('i', `object-fit:${fit};${under ? `background:${rgba(under.color, under.opacity ?? 1)};` : ''}${fx}${strokeDecl}`);
      const tag = `<img class="${cls}" style="${g}" src="${src}" alt="" loading="lazy" decoding="async">`;
      return href ? `<a ${href} class="lnk" style="${g}">${tag.replace(/style="[^"]*"/, 'style="left:0;top:0;width:100%;height:100%"')}</a>` : tag;
    }
    // generic box
    const { bg, extra } = this.background(n.fillPaints, W, H, n.name);
    // frames clip by default (the flag is omitted when false); groups never clip
    const clips = container && n.type !== 'GROUP' && n.frameMaskDisabled !== true && !(n.frameMaskDisabled === undefined && n.resizeToFit);
    const cls = this.sheet.cls('b', `${bg ? `background:${bg};` : ''}${fx}${strokeDecl}${clips ? 'overflow:hidden;' : ''}`, strokePseudo);
    let inner = extra.map(e => `<div class="${this.sheet.cls('b', e + 'border-radius:inherit;')}" style="inset:0"></div>`).join('');
    const ch = tn.children;
    for (let i = 0; i < ch.length; i++) {
      const c = ch[i].node;
      if (c.mask && c.visible !== false) {
        const group = []; let j = i + 1;
        while (j < ch.length && !ch[j].node.mask) group.push(ch[j++]);
        inner += this.mask(ch[i], group, depth);
        i = j - 1; continue;
      }
      inner += this.node(ch[i], depth + 1);
    }
    const tag = href ? 'a' : depth === 1 ? 'section' : 'div';
    const comment = depth === 1 ? `\n<!-- ${esc(n.name).replace(/--/g, '')} -->\n` : '';
    return `${comment}<${tag}${href ? ' ' + href : ''}${cls ? ` class="${cls}"` : ''} style="${g}">${inner}</${tag}>`;
  }
  mask(mtn, group, depth) {
    const m = mtn.node, W = m.size.x, H = m.size.y;
    const inner = group.map(gn => this.node(gn, depth + 1)).join('');
    const alpha = visible(m.fillPaints).find(p => p.type === 'IMAGE');
    const counter = `<div style="left:0;top:0;transform-origin:0 0;transform:${invMatrix(m.transform || IDENT)}">${inner}</div>`;
    if (alpha) {
      const layer = this.imageLayer(alpha, W, H, m.name);
      const cls = this.sheet.cls('m', `-webkit-mask:${layer};mask:${layer};${this.radius(m)}`);
      return `<div class="${cls}" style="${geom(m)}">${counter}</div>`;
    }
    let clip;
    if (['ROUNDED_RECTANGLE', 'RECTANGLE', 'FRAME'].includes(m.type)) clip = `inset(0${this.radius(m) ? ' round ' + this.radius(m).replace('border-radius:', '').replace(';', '') : ''})`;
    else if (m.type === 'ELLIPSE') clip = 'ellipse(50% 50% at 50% 50%)';
    else { const d = m.fillGeometry && m.fillGeometry[0] ? blobPath(this.fig.blobs, m.fillGeometry[0].commandsBlob) : `M0 0H${W}V${H}H0Z`; clip = `path('${d}')`; }
    return `<div style="${geom(m)};clip-path:${clip}">${counter}</div>`;
  }

  // ---- page
  page(cfg) {
    this.sheet = new Sheet(); this.fonts = new Map(); this.h1Done = false; this.uid = 0; this.prefix = '../';
    const root = this.idx.byId[cfg.id];
    const tree = buildTree(root, this.idx);
    // the page frame usually wraps a single full-size frame; unwrap it
    let top = tree;
    while (top.children.length === 1 && top.children[0].node.size && Math.abs(top.children[0].node.size.y - root.size.y) < 1 && ['FRAME'].includes(top.children[0].node.type)) top = top.children[0];
    // canvas ends where the footer starts
    let height = root.size.y;
    const findFooter = (tn, y) => { for (const c of tn.children) { const cy = y + ((c.node.transform || IDENT).m12); if (c.node.name === FOOTER_NAME && c.node.visible !== false) return cy; const r = findFooter(c, cy); if (r != null) return r; } return null; };
    const fy = findFooter(top, 0);
    // footer is wrapped in a frame directly under the page; drop the wrapper too
    const bodyKids = top.children.filter(c => !(fy != null && Math.abs((c.node.transform || IDENT).m12 - fy) < 1 && c.node.size.y <= 300));
    if (fy != null) height = fy;
    const rootBg = this.background(top.node.fillPaints, 1440, height, top.node.name).bg || '#fff';
    const body = bodyKids.map(c => this.node(c, 1)).join('');
    this.mH1 = false;
    const mobile = this.mobilePage({ node: top.node, children: bodyKids }, MOBILE_OVERRIDES[cfg.slug]);
    const fontsURL = googleFonts(this.fonts);
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cfg.title)} | Tanvee Goenka</title>
<meta name="description" content="${esc(cfg.description)}">
<link rel="icon" href="../assets/img/logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsURL}">
<link rel="stylesheet" href="../assets/css/site.css">
<link rel="stylesheet" href="../assets/css/case-study.css">
<link rel="stylesheet" href="../assets/css/pages/${cfg.slug}.css">
<script src="../assets/js/main.js" defer></script>
</head>
<body class="case-study">
${partials.header({ base: '../index.html' })}
<!-- Generated from Figma by tools/figma-export/build.js. Re-run the script instead of editing layout by hand. -->
<main>
<div class="canvas-wrap">
<div class="canvas" style="height:${px(height)};background:${rootBg}" data-width="1440">
${body}
</div>
</div>
<!-- Mobile layout (reflowed from the same Figma frames, see tools/figma-export/mobile.js) -->
${mobile}
</main>
${partials.footer({ base: '../index.html' })}
</body>
</html>
`;
    fs.writeFileSync(path.join(OUT.pages, cfg.slug + '.html'), html);
    fs.writeFileSync(path.join(OUT.css, cfg.slug + '.css'), `/* Generated from Figma: ${cfg.title} */\n` + this.sheet.toString());
    console.log(`page ${cfg.slug}: ${(html.length / 1024).toFixed(0)} KB html, ${this.sheet.rules.length} css rules`);
  }

  // ---- icons for the hand-written pages
  icons() {
    for (const [name, id] of Object.entries(ICONS)) {
      const tn = buildTree(this.idx.byId[id], this.idx);
      const W = tn.node.size.x, H = tn.node.size.y;
      const paths = [];
      const walk = (t, ox, oy) => {
        const n = t.node; if (n.visible === false) return;
        const tr = n.transform || IDENT;
        const x = t === tn ? 0 : ox + tr.m02, y = t === tn ? 0 : oy + tr.m12;
        for (const gm of (n.fillGeometry || [])) if (visible(n.fillPaints).length && n.type !== 'FRAME' && n.type !== 'INSTANCE') paths.push(`<path transform="translate(${r2(x)} ${r2(y)})" d="${blobPath(this.fig.blobs, gm.commandsBlob)}"${gm.windingRule === 'EVENODD' ? ' fill-rule="evenodd"' : ''}/>`);
        for (const gm of (n.strokeGeometry || [])) if (visible(n.strokePaints).length) paths.push(`<path transform="translate(${r2(x)} ${r2(y)})" d="${blobPath(this.fig.blobs, gm.commandsBlob)}"/>`);
        t.children.forEach(c => walk(c, x, y));
      };
      walk(tn, 0, 0);
      fs.writeFileSync(path.join(OUT.icons, name + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(W)}" height="${r2(H)}" viewBox="0 0 ${r2(W)} ${r2(H)}" fill="currentColor">${paths.join('')}</svg>\n`);
    }
  }

  // ---- write optimised assets
  assets() {
    const src = path.join(this.fig.dir, 'images');
    for (const [hash, o] of Object.entries(HOME_IMAGES)) this.images.set('home:' + hash, { hash, file: o.name + '.webp', w: o.w / 2, iw: 99999, crop: o.crop });
    let n = 0;
    for (const rec of this.images.values()) {
      const out = path.join(OUT.img, rec.file);
      if (fs.existsSync(out)) continue;
      const target = Math.min(rec.iw || 99999, Math.ceil(rec.w * 2 / 10) * 10 || 1600, 2880);
      let crop = [];
      if (rec.crop) {
        const [w, h] = execFileSync('magick', ['identify', '-format', '%w %h', path.join(src, rec.hash)]).toString().split(' ').map(Number);
        const [x, y, cw, ch] = rec.crop;
        crop = ['-crop', `${Math.round(cw * w)}x${Math.round(ch * h)}+${Math.round(x * w)}+${Math.round(y * h)}`, '+repage'];
      }
      const args = [path.join(src, rec.hash), '-auto-orient', ...crop, '-resize', `${target}x>`, '-quality', '80', '-define', 'webp:method=6', out];
      try { execFileSync('magick', args); n++; } catch (e) { console.warn('image failed', rec.hash, e.message); }
    }
    for (const rec of this.videos.values()) {
      const out = path.join(OUT.video, rec.file);
      if (fs.existsSync(out)) continue;
      const w = Math.min(1440, Math.ceil(rec.w * 1.25 / 2) * 2);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(this.fig.dir, 'videos', rec.hash), '-map', '0:v:0', '-an', '-vf', `scale=${w}:-2`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
      n++;
    }
    console.log(`assets: ${n} files written (${this.images.size} images, ${this.videos.size} videos referenced)`);
  }
}

function googleFonts(fonts) {
  const fam = [...fonts.entries()].sort().map(([f, ws]) => {
    const list = [...ws];
    const weights = [...new Set(list.map(w => +w.replace('i', '')))].sort((a, b) => a - b);
    const italic = list.some(w => w.startsWith('i'));
    return `family=${f.replace(/ /g, '+')}:${italic ? 'ital,wght@' + [...weights.map(w => '0,' + w), ...weights.map(w => '1,' + w)].join(';') : 'wght@' + weights.join(';')}`;
  });
  return `https://fonts.googleapis.com/css2?${fam.join('&')}&display=swap`;
}

require('./mobile')(Exporter, { r2, px, esc, rgba, visible, IDENT, gid, fontInfo, HEADER_NAME, FOOTER_NAME });

// ---------------------------------------------------------------------- run
Object.values(OUT).forEach(d => fs.mkdirSync(d, { recursive: true }));
const fig = load(FIG);
const ex = new Exporter(fig);
ex.icons();
for (const p of PAGES) ex.page(p);
const home = path.join(ROOT, 'index.html');
if (fs.existsSync(home)) partials.inject(home, { header: partials.header(), footer: partials.footer() });
ex.assets();
fs.rmSync(fig.dir, { recursive: true, force: true });
