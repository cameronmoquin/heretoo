#!/usr/bin/env node
/**
 * Give /about and /advertise a canonical that is true.
 * (/advertise is retired while ads are off, Oct 2026.)
 *
 * THE PROBLEM. web.output is "single", so expo export emits exactly one
 * document and Netlify's SPA fallback serves it at every path. Measured
 * on production: /, /about and /advertise returned byte-identical HTML --
 * same md5, empty #root, and no canonical tag at all. Three URLs, one
 * document, nothing saying which URL it belongs to. Google indexes one
 * of them and files the other two as duplicates, which is exactly what
 * "indexing stopped at the main page" looks like from Search Console.
 *
 * The same document is also served by heretoo.netlify.app, which answers
 * 200 for the whole site and ships its own robots.txt saying Allow: /.
 * So the homepage competed against a copy of itself on a second domain
 * that the Search Console Domain property does not even cover.
 *
 * WHY A CANONICAL ALONE WAS NOT ENOUGH. copy-build-marker.mjs now writes
 * a canonical into the shell, but it can only name one URL, and the
 * shell is served at three. Left at that, /about and /advertise would
 * each announce themselves as the homepage -- a worse lie than silence,
 * because it asks Google to drop them on purpose.
 *
 * WHAT THIS DOES. Writes dist/about.html and dist/advertise.html as
 * copies of the finished index.html with canonical and og:url pointed at
 * their own address. Netlify serves a real file in preference to the
 * /* fallback, so /about gets about.html; the app boots identically
 * because it routes off location.pathname and never reads the filename.
 *
 * It copies the document AFTER fix-viewport has run, so the copies
 * inherit the viewport fix. Keep it last in the build chain for that
 * reason.
 *
 * NO COPY CHANGES. Title and description are untouched and identical to
 * the root's. Distinct, written titles and descriptions for these two
 * pages would be better for search, and that is Cameron's to write --
 * this file does not invent any.
 *
 * The route here is the one the sitemap function publishes beside
 * "/". If netlify/functions/sitemap.ts grows another marketing route,
 * add it here or it ships with the wrong canonical.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://heretoo.social';
const SRC = 'dist/index.html';
const ROUTES = ['about'];

const CANON = /<link rel="canonical" href="[^"]*"\s*\/>/;
const OGURL = /<meta property="og:url" content="[^"]*"\s*\/>/;

let html;
try {
  html = readFileSync(SRC, 'utf8');
} catch {
  console.error(`[route-canonicals] FAIL: cannot read ${SRC}.`);
  process.exit(1);
}

// Fail rather than silently emit copies with the root's canonical. If
// copy-build-marker.mjs stops injecting the tag, this is the alarm.
if (!CANON.test(html)) {
  console.error(
    '[route-canonicals] FAIL: no canonical in dist/index.html. ' +
      'copy-build-marker.mjs must inject it before this runs.',
  );
  process.exit(1);
}
if (!OGURL.test(html)) {
  console.error('[route-canonicals] FAIL: no og:url in dist/index.html.');
  process.exit(1);
}

for (const route of ROUTES) {
  const url = `${BASE}/${route}`;
  const out = html
    .replace(CANON, `<link rel="canonical" href="${url}" />`)
    .replace(OGURL, `<meta property="og:url" content="${url}" />`);

  const dest = `dist/${route}.html`;
  writeFileSync(dest, out);

  // Read back rather than trusting the write. A build step that reports
  // success without checking is how the orphaned guide lasted five months.
  const check = readFileSync(dest, 'utf8');
  if (!check.includes(`<link rel="canonical" href="${url}" />`)) {
    console.error(`[route-canonicals] FAIL: ${dest} did not get its canonical.`);
    process.exit(1);
  }
  if (!check.includes(`<meta property="og:url" content="${url}" />`)) {
    console.error(`[route-canonicals] FAIL: ${dest} did not get its og:url.`);
    process.exit(1);
  }
  console.log(`[route-canonicals] ${dest} -> ${url}`);
}
