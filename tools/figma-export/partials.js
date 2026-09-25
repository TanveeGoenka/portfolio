// Shared header and footer markup. build.js writes these into every case study
// and into the marked regions of index.html, so edit links here, not in the pages.
const fs = require('fs');
const path = require('path');

const RESUME = 'https://drive.google.com/file/d/1UD4VUZrlYo9OeQtUUTLudmyZ5H4hwFkY/view?usp=sharing';
const EMAIL = 'goenka.tanvee@gmail.com';
const LINKEDIN = 'https://www.linkedin.com/in/tanvee-goenka';
const ICONS = path.resolve(__dirname, '../../assets/icons');

// inline an exported icon so it inherits `color`
function icon(name, cls = '') {
  const svg = fs.readFileSync(path.join(ICONS, name + '.svg'), 'utf8').trim();
  return svg.replace('<svg ', `<svg class="${cls}" aria-hidden="true" focusable="false" `).replace(' xmlns="http://www.w3.org/2000/svg"', '');
}

// base: '' on the home page, '../index.html' on case studies
function links(base) {
  return [
    ['Home', `${base}#top`],
    ['Case Studies', `${base}#case-studies`],
    ['About', `${base}#about`],
  ];
}

function header({ base = '' } = {}) {
  const assets = base ? '../' : '';
  const nav = links(base).map(([t, h]) => `<a href="${h}">${t}</a>`).join('\n      ');
  return `<header class="site-header">
    <a class="brand" href="${base}#top" aria-label="Tanvee Goenka, home">
      <img class="brand__mark" src="${assets}assets/img/logo.webp" alt="" width="113" height="113">
      <span class="brand__name">TANVEE GOENKA</span>
    </a>
    <nav class="site-nav" aria-label="Main">
      ${nav}
      <a href="${RESUME}" target="_blank" rel="noopener">Resume</a>
    </nav>
  </header>`;
}

function footer({ base = '' } = {}) {
  const nav = links(base).map(([t, h]) => `<a href="${h}">${t}</a>`).join('\n        ');
  return `<footer class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__id">
        <p class="site-footer__name">Tanvee Goenka</p>
        <p class="site-footer__role">Product and strategy designer (UX &amp; UI)</p>
      </div>
      <nav class="site-footer__nav" aria-label="Footer">
        ${nav}
        <a href="${RESUME}" target="_blank" rel="noopener">Resume</a>
      </nav>
      <div class="site-footer__bottom">
        <p class="site-footer__copy">© 2026 – Tanvee Goenka</p>
        <div class="site-footer__social">
          <a href="mailto:${EMAIL}" aria-label="Email Tanvee">${icon('email', 'icon-email')}</a>
          <a href="${LINKEDIN}" target="_blank" rel="noopener" aria-label="Tanvee on LinkedIn">${icon('linkedin', 'icon-linkedin')}</a>
        </div>
      </div>
    </div>
  </footer>`;
}

// Replaces <!-- partial:NAME --> ... <!-- /partial:NAME --> regions in a file
function inject(file, parts) {
  let html = fs.readFileSync(file, 'utf8');
  for (const [name, markup] of Object.entries(parts)) {
    const re = new RegExp(`(<!-- partial:${name} -->)[\\s\\S]*?(<!-- /partial:${name} -->)`);
    if (re.test(html)) html = html.replace(re, `$1\n  ${markup}\n  $2`);
  }
  fs.writeFileSync(file, html);
}

module.exports = { header, footer, inject, icon, RESUME, EMAIL, LINKEDIN };
