#!/usr/bin/env node
/**
 * Give the crawler a way in.
 *
 * THE BUG THIS FIXES. heretoo.social exports web.output "single", so the
 * document a crawler receives is a ~3KB React shell. Measured on the live
 * site: ZERO <a> tags, zero occurrences of "fsot", and a root sitemap.xml
 * listing exactly three URLs (/, /about, /advertise). Every link in the
 * product — including the two that point at the study guide, in
 * LeftSidebar and rooms.tsx — is rendered by JavaScript after the shell
 * loads, and therefore does not exist as far as an HTML crawl is
 * concerned.
 *
 * The consequence: the 85-page FSOT guide had exactly one discovery path,
 * its own sitemap, with no internal links and no external links pointing
 * at it. Sitemap-only URLs with nothing linking to them are the textbook
 * case Google reports as "Discovered – currently not indexed". The guide
 * was not competing badly. It was not in the race.
 *
 * WHAT THIS DOES. Appends a <noscript> block of real anchors to the
 * shipped dist/index.html. noscript because these links are for crawlers
 * and for anyone without JS — a human with JS gets the app and never sees
 * them, so this adds no UI and needs no copy decision. They are ordinary
 * crawlable <a href> either way: Google reads noscript content.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not touch the app, inject
 * visible markup, or alter a single word a reader sees.
 *
 * Runs in `npm run build` after expo export, beside fix-viewport. Fails
 * the build loudly rather than silently shipping an orphaned guide —
 * silence is exactly how this one lasted as long as it did.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'dist/index.html';
const MARKER = 'data-crawl-links';

/**
 * The paths worth a crawler's attention. Guide and episode pages are
 * reached from these hubs and from /fsot/sitemap.xml; what was missing
 * was any link at all from the site's own root document.
 */
const LINKS = [
  ['/fsot/', 'FSOT and OMST study guide'],
  ['/fsot/guide/', 'Study guide: written chains'],
  ['/fsot/listen/', 'Audio course'],
  ['/fsot/omst/', 'OMST preparation'],
  ['/fsot/plan.html', 'Study plan'],
  ['/about', 'About'],
];

const html = readFileSync(FILE, 'utf8');

if (html.includes(MARKER)) {
  console.log('[crawl-links] already present');
  process.exit(0);
}

if (!html.includes('</body>')) {
  console.error('[crawl-links] FAIL: no </body> in dist/index.html — cannot place the block.');
  process.exit(1);
}

const block =
  `<noscript ${MARKER}><nav>` +
  LINKS.map(([href, text]) => `<a href="${href}">${text}</a>`).join('') +
  `</nav></noscript>`;

const out = html.replace('</body>', `${block}</body>`);

if (out === html) {
  console.error('[crawl-links] FAIL: replacement produced no change.');
  process.exit(1);
}

writeFileSync(FILE, out);

// Read back rather than trusting the write. This project has shipped
// silent no-op patches before; a build step that reports success without
// verifying is how that happens.
const check = readFileSync(FILE, 'utf8');
const count = (check.match(/<a href="\/fsot/g) || []).length;
if (!check.includes(MARKER) || count < 4) {
  console.error(`[crawl-links] FAIL: verification failed (marker=${check.includes(MARKER)}, fsot links=${count}).`);
  process.exit(1);
}

console.log(`[crawl-links] added ${LINKS.length} crawlable links (${count} into /fsot)`);
