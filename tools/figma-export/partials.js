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

// The site chrome from the Connect the Dots home page (styled by assets/css/chrome.css).
// base: '' on the home page, '../index.html' on case studies
function header({ base = '' } = {}) {
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header dots-head">
    <a class="id" href="${base}#top"><strong>Tanvee Goenka</strong><span>Strategy &amp; Product Designer</span></a>
    <nav class="dots-nav" aria-label="Main">
      <a href="${base}#work">Work</a>
      <a href="${base}#thinking">How I think</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>`;
}

function footer() {
  return `<footer class="site-footer dots-foot" id="contact" aria-labelledby="contact-h">
  <div class="dots-foot__in">
    <h2 class="dots-foot__h" id="contact-h">Draw a line to me.</h2>
    <p class="dots-foot__lede">I&rsquo;m looking for strategy and business design roles, and I&rsquo;m open to service design, UX and UI. Anywhere in India.</p>
    <a class="dots-foot__mail" href="mailto:${EMAIL}"><i class="mk c yellow"></i><span>${EMAIL}</span></a>
    <ul class="dots-foot__reach">
      <li><a href="${LINKEDIN}" target="_blank" rel="noopener"><i class="mk s pink"></i>LinkedIn <span aria-hidden="true">&nearr;</span></a></li>
      <li><a href="${RESUME}" target="_blank" rel="noopener"><i class="mk c red"></i>Resume <span aria-hidden="true">&nearr;</span></a></li>
      <li><a href="#top"><i class="mk s blue"></i>Back to the top <span aria-hidden="true">&uarr;</span></a></li>
    </ul>
  </div>
  <div class="strip" aria-hidden="true"></div>
  <p class="dots-foot__foot">&copy; 2026 Tanvee Goenka &middot; Strategy &amp; Product Designer</p>
</footer>`;
}

// fonts, styles and script the chrome needs on a case study
const HEAD = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="../assets/css/chrome.css">
<script src="../assets/js/dots-strip.js" defer></script>`;

// Swaps the header and footer of an already-built case study for the current ones
function apply(file) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/(?:<a class="skip-link"[^>]*>[^<]*<\/a>\s*)?<header class="site-header[^"]*">[\s\S]*?<\/header>/, () => header({ base: '../index.html' }));
  html = html.replace(/<footer class="site-footer[^"]*"[\s\S]*?<\/footer>/, () => footer());
  if (!html.includes('assets/css/chrome.css')) html = html.replace('<script src="../assets/js/main.js" defer></script>', HEAD + '\n<script src="../assets/js/main.js" defer></script>');
  html = html.replace('<body class="case-study">', '<body class="case-study" id="top">');
  fs.writeFileSync(file, html);
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

module.exports = { header, footer, inject, apply, HEAD, icon, RESUME, EMAIL, LINKEDIN };
