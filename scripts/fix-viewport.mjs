#!/usr/bin/env node
/**
 * Stamp viewport-fit=cover onto the exported index.html.
 *
 * The project exports web.output "single", and in that mode Expo
 * IGNORES app/+html.tsx and writes its own document from an internal
 * template — which is why editing +html.tsx changed nothing shipped.
 * Without viewport-fit=cover, env(safe-area-inset-*) reads zero in the
 * installed PWA, the tab bar's home-strip padding collapses, and its
 * icons render inside the iOS gesture strip where the system eats
 * every tap. One attribute keeps the footer alive; this script is the
 * only door that reaches the shipped document.
 *
 * Runs in `npm run build` after expo export. Fails the build loudly if
 * the viewport tag is not found — silence here is how the bug ships.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'dist/index.html';
const html = readFileSync(FILE, 'utf8');

if (html.includes('viewport-fit=cover')) {
  console.log('[fix-viewport] already covered');
  process.exit(0);
}

const m = html.match(/<meta name="viewport" content="([^"]*)"\s*\/?>/);
if (!m) {
  console.error('[fix-viewport] FAIL: no viewport meta found in dist/index.html');
  process.exit(1);
}

const patched = html.replace(m[0], m[0].replace(m[1], `${m[1]}, viewport-fit=cover`));
writeFileSync(FILE, patched);
console.log('[fix-viewport] viewport-fit=cover stamped');
