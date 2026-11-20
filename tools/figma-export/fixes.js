// Corrections to the exported case-study pages: copy errors, leftover design artefacts, contradictory
// labels, alt text, heading levels and a few mobile layouts the generator gets wrong.
//
// build.js applies these to every page it writes, so they survive a re-export. They live here rather than in
// the Figma files because the source for Indian Bank, Sthir and Fermio (Portfolio from Figma.fig) isn't always
// at hand; once a fix is also made in Figma, its entry can be deleted (a find that no longer matches is skipped).
//
//   node fixes.js   apply everything to the pages already in case-studies/ (safe to run more than once)
//
// Entry types, applied in order:
//   { find, replace }        replace every occurrence of a literal string
//   { block, replace }       replace the whole <div> element that starts with the literal `block` ('' removes it)
// Plus, per page: ALTS (image file -> alt text), DEMOTE (headings that are really labels -> <p>),
// PROMOTE (text -> heading tag); EYEBROW_CLASSES fixes the eyebrow colour in the generated stylesheet.

const SITE = 'https://tanveegoenka.github.io/portfolio/';

// Section eyebrows ("Methodology", "Context", ...) were #90a7af on white, 2.5:1. Same hue, 5.2:1.
const EYEBROW = ['color:#90a7af', 'color:#587178'];

// overview table rows on phones: label + value stacked, instead of the desktop table scaled to 8–10px text
const mobileTable = (rows, label, value) => `<div class="m-col">${rows.map(([k, v], i) =>
  `<div class="m-item" style="padding:12px 0;border-top:1px solid #90a7af${i === rows.length - 1 ? ';border-bottom:1px solid #90a7af' : ''}"><p class="m-text ${label}"><span class="m-p">${k}</span></p><p class="m-text ${value}" style="margin-top:4px"><span class="m-p">${v}</span></p></div>`).join('')}</div>`;

const PAGES = {
  'indian-bank': {
    fixes: [
      { find: 'The new taglise symbolises', replace: 'The new tagline symbolises' },
      { find: 'I ideated a strategies for Indian Bank', replace: 'I ideated strategies for Indian Bank' },
      { find: 'four pillar. These initiatives', replace: 'four pillars. These initiatives' },
      { find: 'holds market capital of 0.78.', replace: 'holds market capital of ₹0.78 lakh crore.' },
      // a stray "Create Link" button component left under the brand photography
      { block: '<div class="b83" style="width:334.43px;height:40.36px;left:801.57px;top:1559.73px">', replace: '' },
      { block: '<div class="m-block" style="margin-top:11px"><div class="m-inline m-card" style="gap:8px;background:#0a2a72;border-radius:20px;padding:10px;">', replace: '' },
      // mobile: the strategy ring diagram left a detached blue bar (part of its arrow) between two labels
      { block: '<div class="m-item" style="margin-top:36px"><div class="m-fig" style="aspect-ratio:531/58;max-width:531px">', replace: '' },
      // mobile: the persona details are hover tooltips on the desktop canvas, which phones never show
      {
        find: '<p class="m-text mt20"><span class="m-p">Hover to view the personas</span></p>',
        replace: '<div class="m-text mt7"><ul><li><strong>Rajesh, Gen X Loyalist:</strong> He values trust and security above all. He prefers the branch because the app is confusing and he fears making a mistake.</li><li><strong>Riya, Gen Z Freelancer:</strong> Tech-savvy and impatient, she needs a fast, flexible app but finds it clunky, outdated, and lacking real-time support.</li><li><strong>Aarav, Gen Alpha Learner:</strong> He’s a child learning about money. He finds banking apps “boring” and doesn’t understand the jargon.</li></ul></div>',
      },
      {
        block: '<div class="m-fig" style="aspect-ratio:555/379.5;max-width:555px">',
        replace: mobileTable([
          ['ROLE', 'Product Designer, UX Researcher, Brand Strategist'],
          ['TIMELINE', '10-Week Academic Mentorship'],
          ['CHALLENGE', 'A legacy public sector bank\'s digital products were seen as &quot;old-fashioned&quot; and &quot;frustrating,&quot; causing it to lag in revenue and lose the youth market.'],
          ['GOAL', 'How might we reimagine the bank as a trusted digital brand that bridges generations through simplicity and innovation?'],
          ['OUTCOME', 'A full business-backed visual rebrand and a strategic redesign of the core &quot;Funds Transfer&quot; journey, ideating to increase user trust and capture new demographics.'],
        ], 't8', 'mt7'),
      },
    ],
    // the subtitle sits above the title in the source order; logo lockups, numerals and type specimens aren't headings
    DEMOTE: ['Reimagining The Indian Bank', '01', '02', '03', '04', 'Indian Bank', 'इंडियन बैंक', 'Aa', 'अआ', 'GenZ', 'GenX', 'GenAlpha', 'Gen Alpha'],
    ALTS: {
      'iphone-11-pro-max-34-': 'Redesigned payment journey: entering the TPIN to confirm the transfer.',
      'iphone-11-pro-max-35-': 'The redesigned Indian Bank logo mark.',
      'iphone-11-pro-max-36-': 'Redesigned payment journey: choosing a payee by UPI ID, mobile number or account number.',
      'iphone-11-pro-max-39-': 'Redesigned payment journey: the payment confirmation, with an option to split with friends.',
      'iphone-11-pro-max-42-': 'Redesigned payment journey: entering the amount and choosing the payment method.',
      'screenshot-2025-06-03-122259-': 'A one-star review of the IndSMART app: it needs a newer iOS version than the reviewer\'s phone runs.',
      'screenshot-2025-06-24-100805-': 'YouTube comment: only one of several linked accounts can send money, with the bank\'s reply.',
      'image-105-': 'Play Store review: transfers to another bank fail and take hours.',
      'screenshot-2025-06-16-183544-': 'Reddit post: an account holder charged for a minimum balance they were never told about.',
      'screenshot-2025-06-24-100656-': 'YouTube comment asking Indian Bank to fix the app\'s network and loading problems, with the bank\'s reply.',
      'image-427-': 'Illustration: a frustrated user at a laptop surrounded by notifications.',
      'avatars-3d-avatar-7-': 'Riya, the Gen Z persona.',
      'avatars-3d-avatar-1-': 'Rajesh, the Gen X persona.',
      'artboard-1-08-': 'Brand imagery: a young woman shopping, holding up her phone.',
      'artboard-1-32-': 'Brand imagery: three generations of a family going through their finances together.',
      'image-43-dcd70e': 'The old logo variation after the merger: Indian Bank and Allahabad Bank lockups side by side, in Hindi and English.',
      'image-433-': 'The five TRUST principles drawn as temple pillars: transparency, equality, sensitivity, receptivity and simplicity.',
      'screenshot-2025-07-19-083425-': 'Illustration: a phone showing a completed payment, with coins around it.',
    },
  },

  sthir: {
    fixes: [
      // words split across two lines by the Figma text box
      { find: '<p class="t22" style="width:161px;height:82px;left:33.16px;top:69px;"><span class="ln" style="height:41px;">Intervi</span> <span class="ln">ews</span></p>', replace: '<p class="t22" style="width:200px;height:41px;left:13.66px;top:89.5px;"><span class="ln">Interviews</span></p>' },
      { find: '<span class="ln" style="height:20px;">Healthcare</span> <span class="ln" style="height:20px;">profession</span> <span class="ln">als</span>', replace: '<span class="ln" style="height:20px;">Healthcare</span> <span class="ln" style="font-size:12px;">professionals</span>' },
      { find: 'left:168.41px;top:291.17px;"><span class="ln" style="height:20px;">Healthcare', replace: 'left:168.41px;top:301.17px;"><span class="ln" style="height:20px;">Healthcare' },
      { find: 'Accupressure', replace: 'Acupressure' },
      { find: 'Accupoints', replace: 'Acupoints' },
      { find: 'Interchangable', replace: 'Interchangeable' },
      // the board link was printed as a bare URL
      {
        find: '<span class="ln" style="height:16px;">Click to view Figma link -</span> <span class="ln"> <a href="https://www.figma.com/board/tKoQnJNhhRgerLE5Ty0awW/Design-Thinking?node-id=0-1&amp;t=n3Kr6M2xjI5e69p5-1" target="_blank" rel="noopener">https://www.figma.com/board/tKoQnJNhhRgerLE5Ty0awW/Design-Thinking?node-id=0-1&amp;t=n3Kr6M2xjI5e69p5-1</a></span>',
        replace: '<span class="ln"><a href="https://www.figma.com/board/tKoQnJNhhRgerLE5Ty0awW/Design-Thinking?node-id=0-1&amp;t=n3Kr6M2xjI5e69p5-1" target="_blank" rel="noopener" style="text-decoration:underline;text-underline-offset:2px">Click to view the affinity map in Figma</a></span>',
      },
      {
        find: '<span class="m-p">Click to view Figma link -</span><span class="m-p"> <a href="https://www.figma.com/board/tKoQnJNhhRgerLE5Ty0awW/Design-Thinking?node-id=0-1&amp;t=n3Kr6M2xjI5e69p5-1" target="_blank" rel="noopener">https://www.figma.com/board/tKoQnJNhhRgerLE5Ty0awW/Design-Thinking?node-id=0-1&amp;t=n3Kr6M2xjI5e69p5-1</a></span>',
        replace: '<span class="m-p"><a href="https://www.figma.com/board/tKoQnJNhhRgerLE5Ty0awW/Design-Thinking?node-id=0-1&amp;t=n3Kr6M2xjI5e69p5-1" target="_blank" rel="noopener">Click to view the affinity map in Figma</a></span>',
      },
    ],
    // AEIOU letters, Double Diamond and empathy-map labels are diagram labels; the wordmark is drawn, so the
    // tagline carries the page's h1 with the project name for screen readers
    DEMOTE: ['A', 'E', 'I', 'O', 'U', 'Discover', 'Define', 'Develop', 'Deliver', 'Diverge', 'Converge', 'Says', 'Thinks', 'Does', 'Feels', 'Insight', 'User', 'Need'],
    PROMOTE: { 'For Hands That Tell Stories': ['h1', 'Sthir: '] },
    ALTS: {
      'img-1927-2-': 'The Sthir ergonomic pen.',
      'image-356-': 'A resident of Krishna Prabhu Old Age Home greeting the team.',
      'image-354-': 'Residents in a shared room at the old age home.',
      'image-355-': 'Team members looking at a resident\'s artwork.',
      'img-6106-': 'A notebook page of handwritten ideas and sketches.',
      '6-02a658': 'Concept board 03, Step Easey: sketches of a foot-support aid.',
      '5-e668c3': 'Concept board 02, Ease A Way: a storyboard of elderly people out walking.',
      'screenshot-2024-12-09-at-6-23-29-am-remo-': 'Exploded sketch of the interactive writing board.',
      'rectangle-31-': 'A clay form study held in the hand.',
      'ellipse-36-': 'A team member modelling the pen in 3D on a tablet.',
      'rectangle-32-': 'Foam form studies of the pen grip.',
      'rectangle-33-': 'A clay grip prototype held between the fingers.',
      'ellipse-37-': 'A team member shaping a clay prototype.',
      'ellipse-42-': 'A team member trying a prototype on a drawing tablet.',
      'photo-2024-12-07-14-07-03-': 'Pencil sketches of the final pen forms.',
      'screenshot-2024-12-09-at-1-10-01-pm-': 'Early sketches of pen grips.',
      'screenshot-2024-12-08-at-4-50-50-pm-': 'Outline sketches of pen grip variations.',
      'img-1937-removebg-': 'The final Sthir ergonomic pen.',
      'image-353-': 'The interactive writing board prototype with a red maze.',
      'whatsapp-image-2025-03-07-': 'The Sthir team at their exhibition stand.',
    },
  },

  fermio: {
    fixes: [
      { find: 'government affliated formal recycler', replace: 'government-affiliated formal recycler' },
      { find: 'Formal E-wwaste Recycling Center', replace: 'Formal E-waste Recycling Center' },
      { find: '>Soceity<', replace: '>Society<' },
      { find: 'Hrithik as the brand ambassador ?', replace: 'Hrithik as the brand ambassador?' },
      // one projection, stated the same way everywhere (it was "to 60%", "from 5% to 60%" in the past tense, and "40–60%")
      { find: '<span class="ln">family ritual that can increase collection rates to 60%.</span>', replace: '<span class="ln">family ritual projected to raise collection rates to 40–60%.</span>' },
      { find: 'family ritual that can increase collection rates to 60%.', replace: 'family ritual projected to raise collection rates from 5% to 40–60%.' },
      { find: '<span class="ln" style="height:20px;">and creating a digital loop for 100% traceability, we’ve</span> <span class="ln" style="height:20px;">cleared a path to take collection rates from 5% to 60%,</span> <span class="ln">reducing toxic waste in our cities by 25%.</span>', replace: '<span class="ln" style="height:20px;">and creating a digital loop for 100% traceability, we</span> <span class="ln" style="height:20px;">project collection rates rising from 5% to 40–60%,</span> <span class="ln">with hazardous battery leakage down by about 25%.</span>' },
      { find: 'rates can increase from 5% to', replace: 'rates could increase from 5% to' },
      { find: '<span class="ln">collection rates can increase</span>', replace: '<span class="ln">collection rates could increase</span>' },
      {
        block: '<div class="m-fig" style="aspect-ratio:555/317.5;max-width:555px">',
        replace: mobileTable([
          ['ROLE', 'Systems Thinking, Deep Research, Strategy &amp; Prototyping'],
          ['TIMELINE', '10-Weeks'],
          ['CHALLENGE', 'Recycling today is a chore. Individuals want to help, but they’re stuck because of unawareness and distrust in existing systems without incentives.'],
          ['GOAL', 'How might we make e-waste recycling feel as simple and trustworthy, encouraging families to recycle even their smallest electronics?'],
          ['OUTCOME', 'By partnering with Blinkit for effortless pickup-on-delivery and creating a digital loop for 100% traceability, we project collection rates rising from 5% to 40–60%, with hazardous battery leakage down by about 25%.'],
        ], 'mt4', 'mt10'),
      },
      // mobile: the six app screens were one 1437px collage scaled to 350px (phones about 50px wide)
      {
        block: '<div class="m-fig" style="aspect-ratio:1437/737;max-width:1437px">',
        replace: `<div class="m-grid">${[
          ['mobile-screen-6dca44', 'Fermio app home: “Hello, Arjun”, battery levels and the recycling port.'],
          ['mobile-screen-8bad37', 'Fermio app multimeter: a battery voltage reading of 1.25 V.'],
          ['mobile-screen-18872c', 'Fermio app shop: rechargeable batteries priced in money or points, powered by Blinkit.'],
          ['mobile-screen-273b2d', 'Fermio app learning videos about batteries and recycling.'],
          ['mobile-screen-648173', 'Fermio app profile: rewards, savings, impact and devices.'],
          ['mobile-screen-01449d', 'Fermio app Battery Explorer: badges for children who watch videos and scan batteries.'],
        ].map(([f, alt]) => `<img class="m-img" style="aspect-ratio:214.39/463.09;object-fit:cover;border-radius:16px;outline:3px solid #422307;outline-offset:-3px" src="../assets/img/${f}.webp" alt="${alt}" loading="lazy" decoding="async">`).join('')}</div>`,
      },
    ],
    DEMOTE: ['“'],
    ALTS: {
      'image-406-': 'Research board: the social factors in India\'s e-waste ecosystem.',
      'image-407-': 'Research board: the technology factors in India\'s e-waste ecosystem.',
      'screenshot-2025-12-16-at-6-24-13-pm-': 'Jars of recovered materials at the recycling centre.',
      'image-456-': 'Dismantled appliances piled up at the recycling centre.',
      'image-455-': 'Used lead-acid batteries on the recycling centre floor.',
      'screenshot-2025-12-16-at-6-25-23-pm-': 'Scrap appliances and bundled e-waste waiting to be processed.',
      'screenshot-2025-12-16-at-6-24-41-pm-': 'A repair workbench with tools and battery cells.',
      'image-454-': 'Sorted e-waste and cables at the recycling centre.',
      'whatsapp-image-2025-12-16-at-17-23-59-': 'The formal recycling centre in Pimpri Chinchwad, Maharashtra.',
      'image-63-': 'Feature concept: a father and daughter learning about batteries through a cartoon.',
      'frame-6-1-': 'Social media ad: “Hrithik disposes batteries with Fermio”.',
      'whatsapp-image-2025-12-16-at-13-36-19-': 'In-app ad in Blinkit\'s battery search results.',
      'mobile-screen-18872c': 'Fermio app shop: rechargeable batteries priced in money or points, powered by Blinkit.',
      'whatsapp-image-2025-12-16-at-22-44-12-': 'Chart: India\'s e-waste generation projected to rise from 3.2 to 5.7 million tonnes a year between 2022 and 2030.',
    },
  },

  lexafide: {
    fixes: [
      { find: 'Two protypes tested', replace: 'Two prototypes tested' },
      { find: 'How to controls for AI summaries, information extraction,', replace: 'How to control AI summaries, information extraction,' },
      { find: 'The functionality are', replace: 'The functionality is' },
      { find: 'The firm\'s logo is with an example placeholder.', replace: 'The firm\'s logo is replaced with an example placeholder.' },
      // ownership: PIP was co-created and the Comms Log was led, in the chapter overview and the chapter headers alike;
      // one vocabulary (LED / SOLO / CO-CREATED / CONTRIBUTED) across the page
      { find: 'users work elsewhere?</span></p></div><div style="width:214.33px;height:33.63px;left:7.5px;top:216px"><div class="b20" style="width:44.33px;height:23.63px;left:0;top:10px"><p class="t27" style="width:23px;height:15px;left:10.67px;top:4.31px;"><span class="ln">LED</span></p></div><div class="b21" style="width:139.33px;height:23.63px;left:50.33px;top:10px">', replace: 'users work elsewhere?</span></p></div><div style="width:214.33px;height:33.63px;left:7.5px;top:216px"><div class="b20" style="width:100.33px;height:23.63px;left:0;top:10px"><p class="t27" style="width:79px;height:15px;left:10.67px;top:4.31px;"><span class="ln">Co-created</span></p></div><div class="b21" style="width:139.33px;height:23.63px;left:0;top:39.63px">' },
      { find: 'How does it stay useful while users work elsewhere?</span></p></div></div></div><div class="m-item" style="margin-top:8px"><div class="m-row"><div class="m-col m-card" style="background:#e5f2fd;border:1px solid #e5f2fd;border-radius:11.81px;padding:10px;"><div class="m-item"><p class="m-text mt27"><span class="m-p">LED</span>', replace: 'How does it stay useful while users work elsewhere?</span></p></div></div></div><div class="m-item" style="margin-top:8px"><div class="m-row"><div class="m-col m-card" style="background:#e5f2fd;border:1px solid #e5f2fd;border-radius:11.81px;padding:10px;"><div class="m-item"><p class="m-text mt27"><span class="m-p">Co-created</span>' },
      { find: '<div class="b20" style="width:143.33px;height:23.63px;left:89.67px;top:0"><p class="t27" style="width:122px;height:15px;left:10.67px;top:4.31px;"><span class="ln">Owned end to end</span>', replace: '<div class="b20" style="width:44.33px;height:23.63px;left:188.67px;top:0"><p class="t27" style="width:23px;height:15px;left:10.67px;top:4.31px;"><span class="ln">Led</span>' },
      { find: '<span class="m-p">Owned end to end</span>', replace: '<span class="m-p">Led</span>' },
      { find: '<div class="b94" style="width:100.33px;height:23.63px;left:-31.39px;top:0"><p class="t123" style="width:79px;height:15px;left:10.67px;top:4.31px;"><span class="ln">Co-created</span>', replace: '<div class="b94" style="width:44.33px;height:23.63px;left:24.61px;top:0"><p class="t123" style="width:23px;height:15px;left:10.67px;top:4.31px;"><span class="ln">Led</span>' },
      { find: '<p class="m-text mt117"><span class="m-p">Co-created</span>', replace: '<p class="m-text mt117"><span class="m-p">Led</span>' },
    ],
    ALTS: {
      'lx-hero-workspace': 'The Lexafide workspace: conversation list, a call summary and the caller\'s details.',
      'lx-pip-call': 'The picture-in-picture call window during a live call.',
      'lx-ob-p2-welcome': 'Onboarding welcome card: “We\'ve been waiting for you. Welcome to Lexafide.”',
      'lx-ac-guidance': 'Active Call: the live transcript with Lexa\'s guidance panel.',
      'lx-ci-generate-mm': 'The Generate intelligence report dialog over the workspace.',
      'lx-mm-workspace': 'A call about several matters in the workspace.',
      'image-491-': 'A grid of onboarding screen iterations.',
      'image-496-': 'Onboarding prototype 1, split screen: tell us about your role.',
      'image-497-': 'Onboarding prototype 1, split screen: phone line setup.',
      'image-498-': 'Onboarding prototype 1, split screen: connect your Litify workspace.',
      'image-493-': 'Onboarding prototype 2, card: what best describes your role.',
      'image-494-': 'Onboarding prototype 2, card: get your phone connected.',
      'image-495-': 'Onboarding prototype 2, card: connect your workspace.',
      'lx-ac-handoff': 'Active Call: the handoff brief shown before a transferred call is accepted.',
      'lx-ac-settlement': 'Active Call: the agent disclosing a settlement offer.',
      'lx-old-app': 'The old Comms Log, before the redesign (names and numbers blurred).',
      'image-99-': 'The redesigned Comms Log.',
      'image-97-': 'The component-by-component critique of the Comms Log.',
      'lx-cl-s-default': 'Search panel: the default conversation list, grouped by day.',
      'lx-cl-s-scrolled': 'Search panel scrolled down, with "Load 20 more".',
      'lx-cl-s-empty': 'Search panel: no conversations found.',
      'lx-cl-s-filters-closed': 'Filter panel with the advanced filters collapsed.',
      'lx-cl-s-filters': 'Filter panel open.',
      'lx-cl-s-dates': 'Filter panel with a date range picker.',
      'lx-cl-s-loading': 'Search panel loading.',
      'lx-cl-llm-old': 'LLM Mapping before: one form pushed to Salesforce.',
      'lx-cl-llm': 'LLM Mapping after: extracted fields shown next to the existing CRM values, with confidence.',
      'lx-pip-glance': 'PIP: today at a glance.',
      'lx-pip-incoming': 'PIP: an incoming call with its matter and the previous call summary.',
    },
  },
};

// eyebrow colour, per page: the generated class names that carry it (see EYEBROW)
const EYEBROW_CLASSES = { 'indian-bank': ['t9', 'mt8'], fermio: ['t20', 'mt15'], lexafide: ['t9', 'mt9', 't67', 'mt64'], sthir: [] };


// Section index (bottom-right on the case studies while scrolling; main.js, case-study.css).
// Each entry is [label, target]: the target is the start of a visible text in the page (found in whichever
// layout is showing, desktop canvas or mobile), or a CSS selector starting with # or .
const INDEX = {
  // one structure across every case study: the overarching acts only (methods such as personas, journey
  // maps or blueprints sit inside them); an act a project doesn't have is left out
  'indian-bank': [
    ['Overview', 'Overview'], ['Research', 'Reclaiming Digital Trust'], ['How might we', 'How Might We reimagine'],
    ['Ideation', 'From Insight to Action'], ['Solution', 'A New Brand and a Smarter Bank'], ['Reflection', '.cs-end'],
  ],
  sthir: [
    ['Overview', 'Project Brief'], ['Research', 'Mind Map'], ['Ideation', 'Ideation'], ['How might we', 'Design Question'],
    ['Solution', 'Features and Components'], ['Testing', 'Testing and Feedback'], ['Reflection', '.cs-end'],
  ],
  fermio: [
    ['Overview', 'OVERVIEW'], ['Research', 'The e-waste ecosystem'], ['How might we', 'How Might We'],
    ['Ideation', 'Having fun ideating!'], ['Solution', 'Key features for intervention'], ['Impact', 'Closing the loop'], ['Reflection', '.cs-end'],
  ],
  lexafide: [
    ['Overview', 'Overview'], ['Research', 'Every screen had two audiences'], ['Solution', 'Designing the evolving product'],
    ['Building it', '#lx-after'], ['Outcomes', '#lx-out'], ['Reflection', '.cs-end'],
  ],
};
const attr = t => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function sectionIndex(slug) {
  const items = INDEX[slug];
  if (!items) return '';
  return `<!-- partial:cs-index -->
<nav class="cs-index" aria-label="Sections in this case study" data-cs-index>
  <button class="cs-index__toggle" type="button" aria-expanded="false" aria-controls="cs-index-list"><span class="cs-index__count" data-cs-count>1/${items.length}</span> <span class="cs-index__current" data-cs-current>${attr(items[0][0])}</span></button>
  <ol class="cs-index__list" id="cs-index-list">
${items.map(([label, target]) => `    <li><button type="button" data-target="${attr(target)}">${attr(label)}</button></li>`).join('\n')}
  </ol>
</nav>
<!-- /partial:cs-index -->`;
}
// ---------------------------------------------------------------------------------------------------------------
const decode = t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/\s+/g, ' ').trim();

function elementEnd(html, start) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[0] === '</div>' ? -1 : 1; if (depth === 0) return m.index + 6; }
  return -1;
}

// the line spans of a canvas text block, with a space between them (as build.js writes them now)
const spaceLines = html => html.replace(/<\/span><span class="ln"/g, '</span> <span class="ln"');

function fixHTML(slug, html, log = () => {}) {
  const p = PAGES[slug];
  if (!p) return html;
  html = spaceLines(html);
  for (const f of p.fixes || []) {
    if (f.find != null) {
      const n = html.split(f.find).length - 1;
      if (!n) { log(`  skip (not found): ${f.find.slice(0, 70)}`); continue; }
      html = html.split(f.find).join(f.replace);
      log(`  ${n}× ${f.find.slice(0, 70)}`);
    } else if (f.block != null) {
      let n = 0, at;
      while ((at = html.indexOf(f.block)) >= 0) {
        const end = elementEnd(html, at);
        if (end < 0) break;
        html = html.slice(0, at) + f.replace + html.slice(end);
        n++;
      }
      log(n ? `  ${n}× block ${f.block.slice(0, 70)}` : `  skip (not found): block ${f.block.slice(0, 70)}`);
    }
  }
  // headings
  const demote = new Set(p.DEMOTE || []);
  const promote = p.PROMOTE || {};
  let dn = 0, pn = 0;
  html = html.replace(/<(h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrs, inner) => {
    const t = decode(inner);
    if (demote.has(t)) { dn++; return `<p${attrs}>${inner}</p>`; }
    if (promote[t] && tag !== promote[t][0]) { pn++; const [to, prefix] = promote[t]; return `<${to}${attrs}>${prefix ? `<span class="visually-hidden">${prefix}</span>` : ''}${inner}</${to}>`; }
    return all;
  });
  if (dn || pn) log(`  headings: ${dn} demoted, ${pn} promoted`);
  // alt text
  let an = 0;
  html = html.replace(/<img\b[^>]*>/g, tag => {
    if (!/\salt=""/.test(tag)) return tag;
    const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1] || '';
    const key = Object.keys(p.ALTS || {}).find(k => src.includes(k));
    if (!key) return tag;
    an++;
    return tag.replace(/\salt=""/, ` alt="${p.ALTS[key].replace(/"/g, '&quot;')}"`);
  });
  if (an) log(`  alt text: ${an} images`);
  // section index, just before the close (replaced if it is already there)
  html = html.replace(/<!-- partial:cs-index -->[\s\S]*?<!-- \/partial:cs-index -->\n?/, '');
  const index = sectionIndex(slug);
  if (index) html = html.replace('<!-- partial:case-end -->', `${index}\n<!-- partial:case-end -->`);
  return html;
}

function fixCSS(slug, css) {
  for (const c of EYEBROW_CLASSES[slug] || []) {
    css = css.replace(new RegExp(`(\\.${c}\\{[^}]*?)${EYEBROW[0]}`), `$1${EYEBROW[1]}`);
  }
  return css;
}

// Open Graph / Twitter tags so shared links show a title, description and picture
function socialMeta({ title, description, url, image }) {
  const e = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<meta property="og:type" content="website">
<meta property="og:site_name" content="Tanvee Goenka">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
<meta property="og:url" content="${SITE}${url}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`;
}
const ogImage = slug => `assets/img/og/${slug}.jpg`;

module.exports = { fixHTML, fixCSS, socialMeta, ogImage, sectionIndex, SITE };

// node fixes.js  ->  apply to the existing pages (and their stylesheets, header and close)
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const partials = require('./partials');
  const { caseStudyEnd } = require('./case-study-end');
  const root = path.resolve(__dirname, '../..');
  for (const slug of Object.keys(PAGES)) {
    const file = path.join(root, 'case-studies', slug + '.html');
    let html = fs.readFileSync(file, 'utf8');
    console.log(slug);
    html = fixHTML(slug, html, m => console.log(m));
    // shared parts written by build.js: header (with the skip link), <main id>, social tags, the close
    html = html.replace(/(?:<a class="skip-link"[^>]*>[^<]*<\/a>\s*)?<header class="site-header">[\s\S]*?<\/header>/, partials.header({ base: '../index.html' }));
    html = html.replace(/<main>/, '<main id="main">');
    if (!html.includes('property="og:title"')) {
      const title = decode((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
      const description = decode((html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || '');
      html = html.replace(/(<meta name="description"[^>]*>)/, `$1\n${socialMeta({ title, description, url: `case-studies/${slug}.html`, image: ogImage(slug) })}`);
    }
    html = html.replace(/<!-- partial:case-end -->[\s\S]*?<!-- \/partial:case-end -->/, caseStudyEnd(slug));
    fs.writeFileSync(file, html);
    const cssFile = path.join(root, 'assets/css/pages', slug + '.css');
    fs.writeFileSync(cssFile, fixCSS(slug, fs.readFileSync(cssFile, 'utf8')));
  }
}
