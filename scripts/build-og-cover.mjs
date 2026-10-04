#!/usr/bin/env node
/**
 * Build the social-share cover image (1200×630) at public/og-cover.png.
 *
 * Open Graph / Twitter Card image used by every platform that previews
 * a the site link (Slack, Discord, iMessage, Facebook,
 * LinkedIn, Twitter). 1200×630 is the canonical size — both tall-card
 * and wide-card platforms crop from it cleanly.
 *
 * Run as part of `npm run build` BEFORE expo-export, so dist/ picks
 * the file up via copy-build-marker.mjs (which copies public/* into
 * dist/). One-time render is faster than serving a per-request OG
 * function for the static homepage card.
 *
 * SVG design: brand dark background, two-color Syne-style wordmark
 * (ivory + gold split, matching the in-app logo), subtle linked-tree
 * motif on the right, plain-English tagline. No images embedded —
 * everything's pure SVG so the file stays small and the renderer is
 * deterministic.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'public', 'og-cover.png');

// The mark comes from scripts/build-brand.mjs, which runs before this.
const MARK = readFileSync(join(ROOT, 'assets', 'brand', 'nffga-mark.svg'), 'utf8')
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/#000000/g, '#0A0A0A');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Monochrome brand: white field, ink. The mark, then the name. -->
  <rect width="1200" height="630" fill="#FFFFFF"/>

  <!-- The mark: 200x200 drawing scaled to 400 px, vertically centred. -->
  <g transform="translate(110, 115) scale(2)">${MARK}</g>

  <text x="580" y="318" fill="#0A0A0A"
        font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
        font-weight="800" font-size="112" letter-spacing="18">NFFGA</text>

  <text x="584" y="372" fill="#6B6B6B"
        font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
        font-weight="600" font-size="25" letter-spacing="1">National Fire Fighters Golf Association</text>
</svg>`;

const resvg = new Resvg(svg, {
  background: '#FFFFFF',
  fitTo: { mode: 'width', value: 1200 },
});
const png = resvg.render().asPng();

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length.toLocaleString()} bytes)`);
