// The strip of marks at the foot of every page (home and case studies): circles and squares in the five colours.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function build() {
    document.querySelectorAll('.strip').forEach(el => {
      const w = Math.round(el.clientWidth); if (!w) return;
      if (el.dataset.w && Math.abs(+el.dataset.w - w) < 12) return;
      el.dataset.w = w;
      const c = w >= 1100 ? 30 : w >= 700 ? 28 : 20, ms = Math.round(c * 0.86), n = Math.floor(w / c), rws = 4, off = (w - n * c) / 2;
      const R = rng(911), cols = ['#F5A8BC', '#EE4B2B', '#F7D038', '#2E64B5', '#ffffff'];
      let s = '<svg xmlns="' + NS + '" viewBox="0 0 ' + w + ' ' + rws * c + '" width="' + w + '" height="' + rws * c + '" focusable="false">';
      for (let y = 0; y < rws; y++) for (let x = 0; x < n; x++) {
        if (R() > (0.16 + y * 0.13) * 0.9) continue;
        const fill = cols[Math.floor(R() * 5)], px = off + x * c + c / 2, py = y * c + c / 2;
        s += R() < 0.5
          ? '<rect x="' + (px - ms / 2).toFixed(1) + '" y="' + (py - ms / 2) + '" width="' + ms + '" height="' + ms + '" fill="' + fill + '"/>'
          : '<circle cx="' + px.toFixed(1) + '" cy="' + py + '" r="' + ms / 2 + '" fill="' + fill + '"/>';
      }
      el.innerHTML = s + '</svg>';
    });
  }
  build();
  let t = 0;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 180); });
  addEventListener('load', build);
})();
