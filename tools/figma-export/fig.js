// Reads a Figma .fig file (zip containing a kiwi-encoded canvas) and exposes
// the node tree with component instances expanded.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const kiwi = require('kiwi-schema');
const fzstd = require('fzstd');
const pako = require('pako');

const gid = g => (g ? g.sessionID + ':' + g.localID : null);

function inflate(chunk) {
  if (chunk[0] === 0x28 && chunk[1] === 0xb5) return Buffer.from(fzstd.decompress(chunk));
  try { return Buffer.from(pako.inflateRaw(chunk)); } catch { return Buffer.from(pako.inflate(chunk)); }
}

function load(figPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fig-'));
  execFileSync('unzip', ['-oq', figPath, '-d', dir]);
  const buf = fs.readFileSync(path.join(dir, 'canvas.fig'));
  let off = 12; // "fig-kiwi" + u32 version
  const chunks = [];
  while (off < buf.length) { const n = buf.readUInt32LE(off); off += 4; chunks.push(buf.subarray(off, off + n)); off += n; }
  const schema = kiwi.compileSchema(kiwi.decodeBinarySchema(inflate(chunks[0])));
  const msg = schema.decodeMessage(inflate(chunks[1]));
  const hex = h => Buffer.from(h).toString('hex');
  // normalise image/video hashes to hex strings
  const walkPaints = ps => (ps || []).forEach(p => { if (p.image && p.image.hash) p.image.hash = hex(p.image.hash); if (p.video && p.video.hash) p.video.hash = hex(p.video.hash); });
  const fixNode = n => {
    walkPaints(n.fillPaints); walkPaints(n.strokePaints);
    for (const s of ((n.textData && n.textData.styleOverrideTable) || [])) walkPaints(s.fillPaints);
    for (const o of ((n.symbolData && n.symbolData.symbolOverrides) || [])) fixNode(o);
    for (const o of (n.derivedSymbolData || [])) fixNode(o);
    for (const o of ((n.nodeGenerationData && n.nodeGenerationData.overrides) || [])) fixNode(o);
  };
  msg.nodeChanges.forEach(fixNode);
  return { dir, nodes: msg.nodeChanges, blobs: msg.blobs.map(b => Buffer.from(b.bytes)) };
}

function index(nodes) {
  const byId = {}, kids = {};
  for (const n of nodes) { byId[gid(n.guid)] = n; const p = n.parentIndex && gid(n.parentIndex.guid); if (p) (kids[p] = kids[p] || []).push(n); }
  for (const k in kids) kids[k].sort((a, b) => (a.parentIndex.position < b.parentIndex.position ? -1 : a.parentIndex.position > b.parentIndex.position ? 1 : 0));
  return { byId, kids };
}

const clone = o => JSON.parse(JSON.stringify(o));
const assign = (node, ov) => { for (const k in ov) if (k !== 'guidPath') node[k] = ov[k]; };

// Expands INSTANCE nodes into their component's children, applying
// overrides (symbolOverrides) and Figma's pre-computed layout (derivedSymbolData).
function buildTree(root, { byId, kids }) {
  const walk = (n, ctx) => {
    if (n.type === 'INSTANCE' && n.symbolData) {
      const sym = byId[gid(n.symbolData.symbolID)];
      const ovs = new Map(), der = new Map();
      const pre = ctx.path.join('/');
      if (pre) {
        for (const [k, list] of ctx.overrides) if (k.startsWith(pre + '/')) ovs.set(k.slice(pre.length + 1), [...list]);
        for (const [k, v] of ctx.derived) if (k.startsWith(pre + '/')) der.set(k.slice(pre.length + 1), v);
      }
      for (const ov of (n.symbolData.symbolOverrides || [])) { const k = ov.guidPath.guids.map(gid).join('/'); if (!ovs.has(k)) ovs.set(k, []); ovs.get(k).unshift(ov); }
      for (const ov of (n.derivedSymbolData || [])) { const k = ov.guidPath.guids.map(gid).join('/'); if (!der.has(k)) der.set(k, ov); }
      const scale = (ctx.scale || 1) * (n.symbolData.uniformScaleFactor || 1);
      const children = sym ? (kids[gid(sym.guid)] || []).map(c => walkChild(c, { overrides: ovs, derived: der, path: [], scale })) : [];
      return { node: n, children };
    }
    return { node: n, children: (kids[gid(n.guid)] || []).map(c => walkChild(c, ctx)) };
  };
  const walkChild = (c, ctx) => {
    if (!ctx.overrides.size && !ctx.derived.size && (ctx.scale || 1) === 1) return walk(c, ctx);
    const p = [...ctx.path, gid(c.overrideKey || c.guid)];
    const key = p.join('/');
    let cc = c;
    const ovl = ctx.overrides.get(key), dv = ctx.derived.get(key);
    if (ovl || dv) { cc = clone(c); if (ovl) for (const o of ovl) assign(cc, o); if (dv) assign(cc, dv); }
    const sc = ctx.scale || 1;
    if (Math.abs(sc - 1) > 1e-3 && c.type === 'TEXT' && !(dv && dv.fontSize)) {
      if (cc === c) cc = clone(c);
      cc.fontSize *= sc;
      if (cc.lineHeight && cc.lineHeight.units === 'PIXELS') cc.lineHeight = { ...cc.lineHeight, value: cc.lineHeight.value * sc };
      if (cc.letterSpacing && cc.letterSpacing.units === 'PIXELS') cc.letterSpacing = { ...cc.letterSpacing, value: cc.letterSpacing.value * sc };
      for (const st of ((cc.textData && cc.textData.styleOverrideTable) || [])) {
        if (st.fontSize) st.fontSize *= sc;
        if (st.lineHeight && st.lineHeight.units === 'PIXELS') st.lineHeight = { ...st.lineHeight, value: st.lineHeight.value * sc };
      }
      if (cc.derivedTextData && !(dv && dv.derivedTextData)) {
        cc.derivedTextData = { ...cc.derivedTextData, baselines: (cc.derivedTextData.baselines || []).map(b => ({ ...b, position: { x: b.position.x * sc, y: b.position.y * sc }, lineY: b.lineY * sc, lineHeight: b.lineHeight * sc, width: b.width * sc })), glyphs: (cc.derivedTextData.glyphs || []).map(g => ({ ...g, position: { x: g.position.x * sc, y: g.position.y * sc } })) };
      }
    }
    return walk(cc, { ...ctx, path: p });
  };
  return walk(root, { overrides: new Map(), derived: new Map(), path: [], scale: 1 });
}

module.exports = { load, index, buildTree, gid };
