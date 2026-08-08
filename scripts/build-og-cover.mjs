#!/usr/bin/env node
/**
 * Build the social-share cover image (1200×630) at public/og-cover.png.
 *
 * Open Graph / Twitter Card image used by every platform that previews
 * a https://heretoo.social link (Slack, Discord, iMessage, Facebook,
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
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'public', 'og-cover.png');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <!-- Monochrome brand: white field, ink. The lever, then the word. -->
  <rect width="1200" height="630" fill="#FFFFFF"/>

  <!-- The mark: 100x120 internal coordinates, scaled 3x at (120,135). -->
  <g transform="translate(120, 135) scale(3)" fill="#0A0A0A">
    <circle cx="50" cy="14" r="7"/>
    <rect x="44" y="14" width="12" height="54" rx="6"/>
    <rect x="12" y="56" width="76" height="12" rx="2"/>
    <rect x="14" y="30" width="14" height="80" rx="7"/>
    <rect x="8" y="106" width="26" height="6" rx="3"/>
    <rect x="72" y="30" width="14" height="80" rx="7"/>
    <rect x="66" y="106" width="26" height="6" rx="3"/>
  </g>

  <text x="500" y="330" fill="#0A0A0A"
        font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
        font-weight="800" font-size="88" letter-spacing="22">HERETOO</text>

  <text x="500" y="392" fill="#6B6B6B"
        font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
        font-weight="600" font-size="26" letter-spacing="1">the anti-social media</text>
</svg>`;

const resvg = new Resvg(svg, {
  background: '#0A0A0F',
  fitTo: { mode: 'width', value: 1200 },
});
const png = resvg.render().asPng();

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length.toLocaleString()} bytes)`);
