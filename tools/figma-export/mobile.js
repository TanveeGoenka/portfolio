// Mobile layout for the case studies.
//
// The Figma file only has 1440px desktop frames, so phones get a reflowed,
// single-column version of each page built from the same node tree:
//   - text is re-set at mobile sizes and flows naturally (lists become real lists)
//   - photos and videos go full width
//   - cards keep their fill, radius and border; rows of chips/cards wrap or form a grid
//   - diagrams that only make sense as a whole (overlapping layers, masks, tables,
//     connectors, rotated parts) stay intact as a scaled "figure", or become a
//     swipeable strip when scaling would make their text unreadable
//   - full-width background colours become the backgrounds of mobile sections
// MOBILE_OVERRIDES in build.js can force a node to a given treatment.

module.exports = function install(Exporter, H) {
  const { r2, px, esc, rgba, visible, IDENT, gid } = H;
  const CONTENT_W = 350; // a 390px phone minus 20px gutters

  // ---- geometry helpers
  const box = (n, ox = 0, oy = 0) => {
    const t = n.transform || IDENT, s = n.size || { x: 0, y: 0 };
    const pts = [[0, 0], [s.x, 0], [0, s.y], [s.x, s.y]].map(([x, y]) => [t.m00 * x + t.m01 * y + t.m02, t.m10 * x + t.m11 * y + t.m12]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x: ox + x, y: oy + y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };
  const intersect = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };
  // layers count as overlapping when a real share of the smaller one is covered
  const overlaps = (a, b) => { const i = intersect(a, b); return !!i && i.w > 6 && i.h > 6 && i.w * i.h >= 0.2 * Math.min(a.w * a.h, b.w * b.h); };
  const rotated = n => { const t = n.transform || IDENT; return Math.abs(t.m01) > 1e-3 || Math.abs(t.m10) > 1e-3 || t.m00 < 0 || t.m11 < 0; };
  const CONTAINERS = ['FRAME', 'INSTANCE', 'SYMBOL', 'GROUP', 'SECTION'];
  const isContainer = n => CONTAINERS.includes(n.type) && !n.derivedImmutableFrameData;
  const isShape = n => ['ROUNDED_RECTANGLE', 'RECTANGLE', 'ELLIPSE'].includes(n.type);
  const mediaPaint = n => { const f = visible(n.fillPaints); const p = f[f.length - 1]; return p && (p.type === 'IMAGE' || p.type === 'VIDEO') ? p : null; };
  const solidPaint = n => { const f = visible(n.fillPaints); const p = f[f.length - 1]; return p && p.type === 'SOLID' ? p : null; };
  // rules, connectors and big stroke-only curves (arrows) are dropped; small stroke icons are kept
  const isLine = n => n.type === 'LINE'
    || (n.type === 'VECTOR' && (Math.min(n.size.x, n.size.y) < 3 || (!visible(n.fillPaints).length && Math.max(n.size.x, n.size.y) > 48)))
    || (n.type === 'CONNECTOR' && Math.min(n.size.x, n.size.y) < 3);
  const isVector = n => ['VECTOR', 'LINE', 'REGULAR_POLYGON', 'STAR', 'BOOLEAN_OPERATION'].includes(n.type);
  const clips = n => isContainer(n) && n.type !== 'GROUP' && n.frameMaskDisabled !== true && !(n.frameMaskDisabled === undefined && n.resizeToFit);
  const kidsOf = tn => tn.children.filter(c => c.node.visible !== false);

  // Figma font size -> mobile font size
  const mfs = fs => (fs < 11 ? 12 : fs < 14 ? 13.5 : fs < 16 ? 15 : Math.min(40, 16 + (fs - 16) * 0.55));
  const gapFor = d => Math.round(Math.min(36, Math.max(8, d * 0.5)));

  // Everything below is installed on Exporter so it can reuse the desktop emitters.
  Object.assign(Exporter.prototype, {
    isHard(tn) {
      const n = tn.node;
      if ((n.derivedImmutableFrameData && !isLine(n)) || n.mask) return true;
      const kids = kidsOf(tn);
      // mostly drawn shapes: an illustration or diagram
      const vec = kids.filter(c => isVector(c.node)).length;
      if (vec >= 2 && vec >= 0.4 * kids.length) return true;
      for (const c of kids) {
        if (c.node.mask || (c.node.derivedImmutableFrameData && !isLine(c.node))) return true;
        if (rotated(c.node) && c.node.type !== 'TEXT') return true;
      }
      return false;
    },
    textLen(tn) { let n = 0; const w = t => { if (t.node.visible === false) return; if (t.node.textData) n += t.node.textData.characters.length; t.children.forEach(w); }; w(tn); return n; },
    hasText(tn) { return tn.node.type === 'TEXT' || !!tn.node.derivedImmutableFrameData || tn.children.some(c => c.node.visible !== false && this.hasText(c)); },
    minFont(tn) {
      let m = Infinity;
      const walk = t => { if (t.node.visible === false) return; if (t.node.type === 'TEXT' && t.node.fontSize) m = Math.min(m, t.node.fontSize); if (t.node.derivedImmutableFrameData) m = Math.min(m, 8); t.children.forEach(walk); };
      walk(tn);
      return m;
    },
    override(n) { const v = this.mobileCfg && this.mobileCfg[gid(n.guid)]; return typeof v === 'string' ? v : null; },
    // MOBILE_OVERRIDES groups: loose layers that belong together, { ids: [...], as: 'figure' | 'row' }
    groupOf(n) { return (this.mobileGroups || []).find(g => g.ids.includes(gid(n.guid))) || null; },

    // ------------------------------------------------------------ page
    mobilePage(top, cfg) {
      this.mobileCfg = cfg || {};
      this.mobileGroups = (cfg && cfg.groups) || [];
      this.hoisted = new Set();
      const blocks = [], bands = [];
      const rootBg = solidPaint(top.node);
      if (rootBg) bands.push({ x: 0, y: 0, w: 1440, h: 1e6, color: rgba(rootBg.color, rootBg.opacity ?? 1) });
      const collect = (tn, ox, oy, clip) => {
        const siblings = [];
        for (const c of kidsOf(tn)) {
          const n = c.node;
          if (n.name === H.HEADER_NAME || n.name === H.FOOTER_NAME) continue;
          if (this.override(n) === 'skip') continue;
          const b = box(n, ox, oy);
          const vis = clip ? intersect(b, clip) : b;
          if (!vis) continue;
          const sp = solidPaint(n);
          // full-width coloured shapes and frames become section backgrounds
          if (b.w >= 1000 && isShape(n) && !c.children.length && !mediaPaint(n)) { if (sp) bands.push({ ...vis, color: rgba(sp.color, sp.opacity ?? 1) }); continue; }
          if (['figure', 'scroll', 'scroll-center'].includes(this.override(n)) && sp && b.w >= 1000) bands.push({ ...vis, color: rgba(sp.color, sp.opacity ?? 1) });
          if (b.w >= 1000 && isContainer(n) && !kidsOf(c).some(k => k.node.mask) && !kidsOf(c).every(k => mediaPaint(k.node)) && !['figure', 'scroll', 'scroll-center', 'flow'].includes(this.override(n)) && (sp || b.h >= 700 || this.override(n) === 'descend')) {
            if (sp) bands.push({ ...vis, color: rgba(sp.color, sp.opacity ?? 1) });
            collect(c, b.x, b.y, clips(n) ? vis : clip);
            continue;
          }
          if (isLine(n) && !this.groupOf(n)) continue;
          if (b.w >= 1000 && isVector(n)) continue; // decorative section edge
          siblings.push({ tn: c, b, vis, ox, oy });
          // children placed entirely outside their frame are read where they appear
          if (isContainer(n) && !this.override(n)) for (const k of kidsOf(c)) {
            if (k.node.type !== 'TEXT') continue;
            const kb = box(k.node, b.x, b.y);
            if (kb.y + kb.h <= b.y || kb.y >= b.y + b.h) { this.hoisted.add(k.node); siblings.push({ tn: k, b: kb, vis: kb, ox: b.x, oy: b.y }); }
          }
        }
        const manual = new Map(), rest = [];
        for (const it of siblings) { const g = it.tn && this.groupOf(it.tn.node); if (g) { if (!manual.has(g)) manual.set(g, []); manual.get(g).push(it); } else rest.push(it); }
        blocks.push(...this.components(rest));
        for (const [g, members] of manual) {
          const x = Math.min(...members.map(i => i.b.x)), y = Math.min(...members.map(i => i.b.y));
          const b = { x, y, w: Math.max(...members.map(i => i.b.x + i.b.w)) - x, h: Math.max(...members.map(i => i.b.y + i.b.h)) - y };
          blocks.push({ group: members, b, vis: b, as: g.as });
        }
      };
      collect(top, 0, 0, { x: 0, y: 0, w: 1440, h: 1e6 });
      const ordered = this.readingOrder(blocks);
      // group consecutive blocks by background colour
      const bgAt = b => { let c = '#fff'; const cx = b.vis.x + b.vis.w / 2, cy = b.vis.y + Math.min(b.vis.h, 400) / 2; for (const band of bands) if (cy >= band.y && cy <= band.y + band.h && cx >= band.x && cx <= band.x + band.w) c = band.color; return c; };
      const sections = [];
      for (const bl of ordered) {
        const bg = bgAt(bl);
        const last = sections[sections.length - 1];
        if (last && last.bg === bg) last.items.push(bl); else sections.push({ bg, items: [bl] });
      }
      const html = sections.map(s => {
        let prev = null;
        const inner = s.items.map(bl => {
          const h = this.memit(bl);
          if (!h) return '';
          const mt = prev ? gapFor(bl.vis.y - (prev.vis.y + prev.vis.h)) * 1.4 : 0;
          prev = bl;
          return mt ? `<div class="m-block" style="margin-top:${Math.round(mt)}px">${h}</div>` : `<div class="m-block">${h}</div>`;
        }).join('\n');
        return `<section class="m-sec" style="background:${s.bg}">\n${inner}\n</section>`;
      }).join('\n');
      return `<div class="m-page">\n${html}\n</div>`;
    },

    // group overlapping siblings into one figure; everything else stays separate
    components(items) {
      const parent = items.map((_, i) => i);
      const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const solo = t => this.override(t.node) === 'solo' || (this.hoisted && this.hoisted.has(t.node));
        if (!a.tn || !b.tn || solo(a.tn) || solo(b.tn)) continue;
        const ta = a.tn.node.type === 'TEXT', tb = b.tn.node.type === 'TEXT';
        if (ta && tb) continue;
        // text only belongs to a picture when it sits (mostly) on top of it
        if (ta || tb) { const t = ta ? a.b : b.b, i2 = intersect(a.b, b.b); if (!i2 || i2.w * i2.h < 0.6 * t.w * t.h) continue; }
        if (overlaps(a.b, b.b)) parent[find(i)] = find(j);
      }
      const groups = new Map();
      items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
      return [...groups.values()].map(g => {
        if (g.length === 1) return g[0];
        const x = Math.min(...g.map(i => i.b.x)), y = Math.min(...g.map(i => i.b.y));
        const b = { x, y, w: Math.max(...g.map(i => i.b.x + i.b.w)) - x, h: Math.max(...g.map(i => i.b.y + i.b.h)) - y };
        const vx = Math.min(...g.map(i => i.vis.x)), vy = Math.min(...g.map(i => i.vis.y));
        const vis = { x: vx, y: vy, w: Math.max(...g.map(i => i.vis.x + i.vis.w)) - vx, h: Math.max(...g.map(i => i.vis.y + i.vis.h)) - vy };
        return { group: g, b, vis };
      });
    },

    // top-to-bottom, but items that sit beside each other read left-to-right
    readingOrder(items) {
      const a = items.slice().sort((p, q) => p.vis.y - q.vis.y || p.vis.x - q.vis.x);
      for (let pass = 0; pass < a.length; pass++) {
        let swapped = false;
        for (let i = 0; i + 1 < a.length; i++) {
          const p = a[i].vis, q = a[i + 1].vis;
          const ov = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
          if (ov > 0.5 * Math.min(p.h, q.h) && q.x + q.w / 2 < p.x + p.w / 2 - 4) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; swapped = true; }
        }
        if (!swapped) break;
      }
      // keep a caption right after the picture it sits under
      const isMedia = it => !it.group && it.tn && (mediaPaint(it.tn.node) || (isContainer(it.tn.node) && !this.hasText(it.tn)));
      const isCaption = it => !it.group && it.tn && it.tn.node.type === 'TEXT' && it.vis.h < 120;
      for (let i = 0; i < a.length; i++) {
        if (!isCaption(a[i])) continue;
        const t = a[i].vis;
        let best = -1;
        for (let j = 0; j < a.length; j++) {
          if (j === i || !isMedia(a[j])) continue;
          const m = a[j].vis, gap = t.y - (m.y + m.h), ox = Math.min(t.x + t.w, m.x + m.w) - Math.max(t.x, m.x);
          if (gap >= -4 && gap < 40 && ox > 0.5 * Math.min(t.w, m.w)) { best = j; break; }
        }
        if (best >= 0 && best !== i - 1) {
          const [cap] = a.splice(i, 1);
          const at = a.indexOf(a.find((_, k) => k === (best > i ? best - 1 : best)));
          a.splice(at + 1, 0, cap);
        }
      }
      return a;
    },

    // ------------------------------------------------------------ blocks
    memit(bl) {
      if (bl.group && bl.as === 'row') {
        // each overlapping cluster (e.g. photo + outline) becomes one tile of a row
        const tiles = this.readingOrder(this.components(bl.group)).map(t => this.memit(t)).filter(Boolean);
        return `<div class="m-grid m-grid--${Math.min(3, tiles.length)}">${tiles.join('')}</div>`;
      }
      if (bl.group) return this.mfigure(bl.group.map(g => g.tn), bl.b, bl.vis);
      const tn = bl.tn, n = tn.node;
      const mode = this.override(n);
      if (mode === 'figure' || mode === 'scroll' || mode === 'scroll-center') return this.mfigure([tn], bl.b, bl.vis, mode === 'scroll' || mode === 'scroll-center', mode === 'scroll-center');
      if (n.type === 'TEXT') return this.mtext(n);
      if (isShape(n) && !tn.children.length) {
        if (mediaPaint(n)) return this.mmedia(n, bl.b);
        if (Math.max(bl.b.w, bl.b.h) < 8) return '';
        return this.mfigure([tn], bl.b, bl.vis);
      }
      if (!isContainer(n)) {
        if (isLine(n)) return '';
        return this.mfigure([tn], bl.b, bl.vis);
      }
      // containers
      const kids = kidsOf(tn);
      if (!kids.length) return solidPaint(n) || mediaPaint(n) ? this.mfigure([tn], bl.b, bl.vis) : '';
      if (mode !== 'flow') {
        if (this.isHard(tn)) return this.mfigure([tn], bl.b, bl.vis);
        if (Math.max(bl.b.w, bl.b.h) <= 80 && !this.hasText(tn)) return this.mfigure([tn], bl.b, bl.vis); // icon
        if (mediaPaint(n)) return this.mfigure([tn], bl.b, bl.vis);
        // framed app screens (tall, rounded, filled) are mock-ups, not layout
        const r = n.cornerRadius || n.rectangleTopLeftCornerRadius || 0;
        if (bl.b.h / bl.b.w > 1.6 && bl.b.w >= 120 && bl.b.w <= 460 && r >= 12 && solidPaint(n)) return this.mfigure([tn], bl.b, bl.vis);
      }
      return this.mflow(tn, bl.b, mode === 'flow');
    },

    mflow(tn, b, forced) {
      const n = tn.node;
      const area = b.w * b.h;
      let bgPaint = null;
      const items = [];
      for (const c of kidsOf(tn)) {
        const cb = box(c.node, b.x, b.y);
        if (this.override(c.node) === 'skip' || this.hoisted.has(c.node)) continue;
        // a shape filling the frame is the card's background
        if (isShape(c.node) && !c.children.length && cb.w * cb.h >= 0.85 * area) {
          if (mediaPaint(c.node) && !forced) return this.mfigure([tn], b, b);
          bgPaint = solidPaint(c.node) || bgPaint; continue;
        }
        if (isLine(c.node)) continue;
        items.push({ tn: c, b: cb, vis: cb });
      }
      const comps = forced ? items : this.components(items);
      if (!forced && comps.length === 1 && comps[0].group) return this.mfigure([tn], b, b);
      const ordered = this.readingOrder(comps);
      // layout: chips wrap, similar cards/images form a grid, otherwise a column
      const cardLike = it => !it.group && (mediaPaint(it.tn.node) || (isContainer(it.tn.node) && (solidPaint(it.tn.node) || visible(it.tn.node.strokePaints).length)));
      const rows = [];
      for (const it of ordered) { const r = rows[rows.length - 1]; if (r && it.vis.y < r.bottom - 8) { r.items.push(it); r.bottom = Math.max(r.bottom, it.vis.y + it.vis.h); } else rows.push({ items: [it], bottom: it.vis.y + it.vis.h }); }
      const widest = Math.max(...ordered.map(i => i.vis.w));
      const multi = rows.some(r => r.items.length > 1);
      let layout = 'col';
      // a short horizontal run (icon + label, number + unit ...) stays on one line
      const lineW = ordered.reduce((w, i) => w + i.vis.w, 0) + (n.stackSpacing || 0) * (ordered.length - 1);
      if (n.stackMode === 'HORIZONTAL' && rows.length === 1 && ordered.length > 1 && lineW <= CONTENT_W && ordered.some(i => !i.group && i.tn && !this.hasText(i.tn))) layout = 'inline';
      const mock = it => !it.group && it.tn && isContainer(it.tn.node) && it.vis.h / it.vis.w > 1.6 && (it.tn.node.cornerRadius || it.tn.node.rectangleTopLeftCornerRadius || 0) >= 12;
      if (layout === 'inline') {}
      else if (ordered.length > 1 && multi && ordered.every(i => i.vis.w <= 320 && i.vis.h <= 90)) layout = 'row';
      else if (ordered.length > 1 && multi && ordered.every(mock)) layout = 'grid';
      else if (ordered.length > 2 && multi && ordered.every(i => i.vis.w <= 200 && i.tn && this.textLen(i.tn) <= 40)) layout = 'grid3';
      else if (layout === 'col' && ordered.length > 1 && multi && ordered.every(cardLike) && widest <= 560 && Math.min(...ordered.map(i => i.vis.w)) > widest / 2.2) layout = widest <= 200 && ordered.length >= 3 && ordered.every(i => !this.hasText(i.tn)) ? 'grid3' : widest <= 260 && ordered.some(i => this.hasText(i.tn) && this.textLen(i.tn) > 120) ? 'col' : 'grid';
      let prev = null;
      let style = '';
      const inner = ordered.map(it => {
        const h = this.memit(it);
        if (!h) return '';
        let st = '';
        if (layout === 'col' && prev) {
          const d = it.vis.y - (prev.vis.y + prev.vis.h);
          st = ` style="margin-top:${d < -4 ? 12 : gapFor(d)}px"`;
        }
        prev = it;
        return layout === 'col' ? `<div class="m-item"${st}>${h}</div>` : h;
      }).join('');
      if (!inner) return '';
      // card styling
      const own = solidPaint(n) || bgPaint;
      const stroke = visible(n.strokePaints).find(p => p.type === 'SOLID');
      if (layout === 'inline') style += `gap:${Math.round(Math.max(8, Math.min(16, n.stackSpacing || 8)))}px;`;
      let cls = layout === 'inline' ? 'm-inline' : layout === 'row' ? 'm-row' : layout === 'grid' ? 'm-grid' : layout === 'grid3' ? 'm-grid m-grid--3' : 'm-col';
      const isCard = (own && (own.color.a ?? 1) * (own.opacity ?? 1) > 0.02 && b.w < 1000) || (stroke && n.strokeWeight);
      if (isCard) {
        cls += ' m-card';
        if (own) style += `background:${rgba(own.color, own.opacity ?? 1)};`;
        if (stroke && n.strokeWeight) style += `border:${px(Math.min(2, n.strokeWeight))} ${n.dashPattern && n.dashPattern.length ? 'dashed' : 'solid'} ${rgba(stroke.color, stroke.opacity ?? 1)};`;
        const r = n.cornerRadius || n.rectangleTopLeftCornerRadius || 0;
        if (r) style += `border-radius:${px(Math.min(r, b.h / 2, 20))};`;
        const pad = Math.min(n.stackHorizontalPadding || 16, n.stackVerticalPadding || 16);
        style += `padding:${Math.round(Math.max(10, Math.min(20, pad * 0.75)))}px;`;
      }
      return `<div class="${cls}"${style ? ` style="${style}"` : ''}>${inner}</div>`;
    },

    // ------------------------------------------------------------ text
    mlook(s, base) {
      let l = this.textLook(s, 100, 20, true).replace(/font-size:[^;]+;/, '');
      const fs = s.fontSize || (base && base.fontSize);
      if (s.fontSize) l += `font-size:${px(r2(mfs(s.fontSize)))};`;
      return { look: l, fs };
    },
    mtext(n) {
      const td = n.textData; if (!td || !td.characters.trim()) return '';
      const chars = td.characters, ids = td.characterStyleIDs || [];
      const table = {}; for (const s of (td.styleOverrideTable || [])) table[s.styleID] = s;
      const { look } = this.mlook(n);
      const fs = mfs(n.fontSize);
      const lh = n.lineHeight;
      const ratio = lh && lh.units === 'PIXELS' ? lh.value / n.fontSize : lh && lh.units === 'RAW' ? lh.value : lh && lh.units === 'PERCENT' ? lh.value / 100 : 1.21;
      const lr = fs >= 20 ? Math.min(1.3, Math.max(1.1, ratio)) : Math.min(1.65, Math.max(1.4, ratio));
      const align = { CENTER: 'center', RIGHT: 'right' }[n.textAlignHorizontal] || 'left';
      const cls = this.sheet.cls('mt', `${look}line-height:${r2(lr)};text-align:${align};` + this.common(n));
      const runs = (s, e) => {
        let html = '', cur = null, buf = '';
        const flush = () => {
          if (!buf) return;
          const st = table[cur];
          let seg = esc(buf);
          if (st) {
            const c = this.sheet.cls('ms', this.mlook(st, n).look);
            if (c) seg = `<span class="${c}">${seg}</span>`;
            if (st.hyperlink && st.hyperlink.url) seg = `<a href="${esc(st.hyperlink.url)}" target="_blank" rel="noopener">${seg}</a>`;
          }
          if (!(st && st.hyperlink && st.hyperlink.url)) seg = seg.replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
          html += seg; buf = '';
        };
        for (let i = s; i < e; i++) { const id = ids[i] || 0; if (id !== cur) { flush(); cur = id; } buf += chars[i]; }
        flush();
        return html;
      };
      // paragraphs
      const paras = []; let start = 0;
      for (let i = 0; i <= chars.length; i++) if (i === chars.length || chars[i] === '\n') { paras.push([start, i]); start = i + 1; }
      const out = []; let list = null, gap = false;
      paras.forEach(([s, e], k) => {
        const text = chars.slice(s, e).replace(/\r/g, '');
        const lt = td.lines && td.lines[k] ? td.lines[k].lineType : 'PLAIN';
        if (!text.trim()) { if (list) { out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`); list = null; } gap = true; return; }
        const html = runs(s, e).replace(/\r/g, '');
        const sp = gap && out.length ? ' class="m-gap"' : ''; gap = false;
        if (lt === 'UNORDERED_LIST' || lt === 'ORDERED_LIST') {
          const tag = lt === 'ORDERED_LIST' ? 'ol' : 'ul';
          if (!list || list.tag !== tag) { if (list) out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`); list = { tag, items: [] }; }
          list.items.push(`<li${sp}>${html}</li>`);
        } else {
          if (list) { out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`); list = null; }
          out.push(`<span class="m-p${sp ? ' m-gap' : ''}">${html}</span>`);
        }
      });
      if (list) out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`);
      const hasList = out.some(o => /^<(ul|ol)>/.test(o));
      const tag = hasList ? 'div' : this.mHeadingTag(n);
      return `<${tag} class="m-text ${cls}">${out.join('')}</${tag}>`;
    },
    mHeadingTag(n) {
      const fs = n.fontSize || 0, w = n.fontName ? H.fontInfo(n.fontName).weight : 400;
      if (n.textData.characters.length > 120) return 'p';
      if (fs >= 44 && !this.mH1) { this.mH1 = true; return 'h1'; }
      if (fs >= 24 && w >= 500) return 'h2';
      if (fs >= 19 && w >= 600) return 'h3';
      return 'p';
    },

    // ------------------------------------------------------------ media
    mmedia(n, b) {
      const p = mediaPaint(n);
      const t = p.transform;
      const identity = !t || (Math.abs(t.m00 - 1) < 1e-4 && Math.abs(t.m11 - 1) < 1e-4 && Math.abs(t.m02) < 1e-4 && Math.abs(t.m12) < 1e-4);
      if (p.type === 'IMAGE' && !(identity || p.imageScaleMode === 'FILL' || p.imageScaleMode === 'FIT')) return this.mfigure([{ node: n, children: [] }], b, b);
      const W = n.size.x, Hh = n.size.y;
      const radius = n.type === 'ELLIPSE' ? '50%' : px(Math.min(n.cornerRadius || n.rectangleTopLeftCornerRadius || 0, 24));
      const fit = { FIT: 'contain', STRETCH: 'fill' }[p.imageScaleMode] || 'cover';
      const small = W < 200;
      const st = `aspect-ratio:${r2(W)}/${r2(Hh)};${small ? `width:${px(Math.max(W * 0.75, 40))};` : ''}${radius !== '0' ? `border-radius:${radius};` : ''}object-fit:${fit}`;
      if (p.type === 'VIDEO') {
        const src = this.video(p, W, n.name);
        const poster = p.image && p.image.hash ? this.image(p, W, Hh, n.name + '-poster') : '';
        return `<video class="m-img" style="${st}" data-src="${src}"${poster ? ` poster="${poster}"` : ''} muted loop playsinline preload="none"></video>`;
      }
      let dw = W, dh = Hh;
      if (fit === 'cover' && p.originalImageWidth) { const sc = Math.max(W / p.originalImageWidth, Hh / p.originalImageHeight); dw = p.originalImageWidth * sc; dh = p.originalImageHeight * sc; }
      const src = this.image(p, dw, dh, n.name);
      const href = this.link(n);
      const img = `<img class="m-img" style="${st}" src="${src}" alt="" loading="lazy" decoding="async">`;
      return href ? `<a ${href}>${img}</a>` : img;
    },

    // a group of nodes kept exactly as designed and scaled to the column
    mfigure(tns, b, vis, forceScroll, center) {
      vis = vis || b;
      const W = vis.w, Hh = vis.h;
      if (W < 1 || Hh < 1) return '';
      const ox = b.x - vis.x, oy = b.y - vis.y;
      // re-root the nodes so the visible box starts at 0,0
      const minX = Math.min(...tns.map(t => box(t.node).x)), minY = Math.min(...tns.map(t => box(t.node).y));
      const parts = tns.map(tn => {
        const t = tn.node.transform || IDENT;
        return { node: { ...tn.node, transform: { ...t, m02: t.m02 - minX + ox, m12: t.m12 - minY + oy } }, children: tn.children };
      });
      // same child loop as the desktop emitter, so masks still clip the layers after them
      let inner = '';
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].node.mask) { const g = []; let j = i + 1; while (j < parts.length && !parts[j].node.mask) g.push(parts[j++]); inner += this.mask(parts[i], g, 2); i = j - 1; continue; }
        inner += this.node(parts[i], 2);
      }
      const minFs = Math.min(...tns.map(t => this.minFont(t)));
      const fitScale = Math.min(1, CONTENT_W / W);
      const readable = minFs === Infinity || minFs * fitScale >= 8.5;
      const canvas = (extra, attrs) => `<div class="m-fig__canvas"${attrs} style="width:${px(W)};height:${px(Hh)};${extra}">${inner}</div>`;
      if (!forceScroll && (readable || W <= CONTENT_W)) {
        const small = W <= CONTENT_W;
        return `<div class="m-fig${small ? ' m-fig--natural' : ''}" style="aspect-ratio:${r2(W)}/${r2(Hh)};${small ? `width:${px(W)};` : ''}max-width:${small ? '100%' : px(W)}">${canvas('', ` data-fit="${r2(W)}"`)}</div>`;
      }
      // swipeable only when the strip stays a sensible height; otherwise fit the column
      const s = Math.min(0.75, Math.max(fitScale, 9 / minFs));
      if (W * s <= CONTENT_W + 10) return `<div class="m-fig m-fig--natural">${canvas(`zoom:${r2(s)}`, '')}</div>`;
      if (!forceScroll && Hh * s > 720) return `<div class="m-fig" style="aspect-ratio:${r2(W)}/${r2(Hh)};max-width:${px(W)}">${canvas('', ` data-fit="${r2(W)}"`)}</div>`;
      return `<div class="m-scroll"${center ? ' data-start="center"' : ''} tabindex="0" role="region" aria-label="Scrollable diagram">${canvas(`zoom:${r2(s)}`, '')}</div><p class="m-hint" aria-hidden="true">Swipe to explore →</p>`;
    },
  });
};
