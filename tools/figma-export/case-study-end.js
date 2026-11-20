// The close of every case study: a reflection ("What I learned / What I'd do next") and a link to the
// next project. build.js writes this before </main>; edit the copy here, then re-run the exporter
// (or run `node case-study-end.js` to rewrite just these blocks in the existing pages).

const PROJECTS = {
  'indian-bank': {
    name: 'Indian Bank',
    title: 'Converting a legacy brand into a loyal one',
    learned: [
      'Starting from the business problem (revenue, market capital, youth appeal) gave every design decision a reason beyond looks.',
      'Sixteen customer interviews showed the gap was generational: the bank was speaking a language none of its key users understood.',
      'A rebrand only holds together as a system. The palette, type and imagery each speak to a generation.',
    ],
    next: [
      'Test the unified payment journey with Gen X, Gen Z and Gen Alpha users, comparing task time and errors with the current app.',
      'Run the brand perception test on the new identity before rolling it out.',
      'Prototype the highest-impact ideas from ideation, such as Split with Friends and smart defaults.',
    ],
  },
  sthir: {
    name: 'Sthir',
    title: 'An assistive writing device for the elderly',
    learned: [
      'Time at Krishna Prabhu Old Age Home showed the barrier was fear of failure, not ability, so the product had to build confidence as well as steady the hand.',
      'Testing surfaced a trade-off: prolonged vibration-based stabilisation may cause muscle fatigue over time.',
      'Exploring form in clay, foam, Blender and Fusion 360 taught us to judge ergonomics by hand before refining on screen.',
    ],
    next: [
      'Make the pen sleeker and lighter to reduce hand fatigue and improve portability.',
      'Add difficulty levels to the maze board for users with different dexterity.',
      'Build the standard writing grid with vibration feedback, and test the pen on any paper surface.',
    ],
  },
  fermio: {
    name: 'Fermio',
    title: 'User-centered battery disposal service',
    learned: [
      'People already feel responsible for their e-waste. What is missing is convenience, visibility and a reason to act: 7 in 10 did not know of a collection point nearby.',
      'Batteries fall through the gaps: take-back schemes and recyclers focus on larger appliances.',
      'Mapping the whole journey (it became very long) showed the breakdown happens at disposal, where a lack of convenience overrides good intent.',
    ],
    next: [
      'Pilot pickup-on-delivery with Blinkit and Fermio stations at kirana stores in one neighbourhood, to test the projected rise in collection rates from 5% to 40–60%.',
      'Prototype the USB-C Battery Health Checker and the rewards flow with families.',
      'Work out how battery tracking would connect manufacturers, government and recyclers.',
    ],
  },
  // generated from its own file (Lexafide from Figma.fig); the end of the page is hand-written (lexafide-tail.html)
  lexafide: {
    name: 'Lexafide',
    title: 'Designing for decisions, not automation',
    learned: [
      'Testing showed an AI can be capable and still wrong for the moment: the agent revealed a settlement offer before an attorney had framed it, so limits have to be designed in from the start.',
      'Working remotely, I understood US law-firm staff through other people, and learnt that even a label like "Party ID" or "Client ID" depends on how Litify structures its records.',
      'I held designs back until they felt finished. Earlier, rougher handovers to engineering would have surfaced PIP\'s technical limits sooner.',
    ],
    next: [
      'User-test the redesigned Comms Log, which was deprioritised before it could be validated.',
      'Talk to firm staff informally and early, instead of relying on two moderated sessions as the only source of truth.',
      'Measure whether self-serve onboarding reduces the manual setup Lexafide\'s team does for each new firm employee.',
    ],
  },
};
const ORDER = ['indian-bank', 'sthir', 'fermio', 'lexafide'];

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const list = items => `<ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;

function caseStudyEnd(slug) {
  const p = PROJECTS[slug];
  if (!p) return '';
  const nextSlug = ORDER[(ORDER.indexOf(slug) + 1) % ORDER.length];
  const n = PROJECTS[nextSlug];
  return `<!-- partial:case-end -->
<section class="cs-end cs-end--${slug}" aria-labelledby="cs-end-title">
  <div class="cs-end__inner">
    <p class="cs-end__eyebrow">Reflection</p>
    <h2 class="visually-hidden" id="cs-end-title">Reflection</h2>
    <div class="cs-end__cols">
      <div class="cs-end__col">
        <h3 class="cs-end__title">What I learned</h3>
        ${list(p.learned)}
      </div>
      <div class="cs-end__col">
        <h3 class="cs-end__title">What I’d do next</h3>
        ${list(p.next)}
      </div>
    </div>
    <a class="cs-end__next" href="${nextSlug}.html">
      <span class="cs-end__next-label">Next project</span>
      <span class="cs-end__next-title"><span class="cs-end__next-name">${esc(n.name)}</span> ${esc(n.title)}</span>
      <span class="cs-end__next-arrow" aria-hidden="true">→</span>
    </a>
  </div>
</section>
<!-- /partial:case-end -->`;
}

module.exports = { caseStudyEnd };

// node case-study-end.js  ->  rewrite the blocks in the existing case-study pages
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  for (const slug of ORDER) {
    const f = path.resolve(__dirname, '../../case-studies', slug + '.html');
    let s = fs.readFileSync(f, 'utf8');
    const block = caseStudyEnd(slug);
    const re = /<!-- partial:case-end -->[\s\S]*?<!-- \/partial:case-end -->/;
    s = re.test(s) ? s.replace(re, block) : s.replace('\n</main>', `\n${block}\n</main>`);
    fs.writeFileSync(f, s);
    console.log('updated', path.basename(f));
  }
}
