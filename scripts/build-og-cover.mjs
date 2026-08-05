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
  <!-- Background: brand dark with a soft radial vignette -->
  <defs>
    <radialGradient id="bg" cx="35%" cy="40%" r="80%">
      <stop offset="0%" stop-color="#16161E"/>
      <stop offset="100%" stop-color="#0A0A0F"/>
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#F0D88B"/>
      <stop offset="100%" stop-color="#D9B85F"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- HT tree logo, centered on the right. Mirrors public/favicon.svg
       and the in-app HereTooLogo component so the brand reads
       consistently from social-share preview → app icon → in-app
       header. Drawn at ~360px tall in the OG cover's coordinate
       system. The logo's own coordinate system is 100×120; here we
       scale 3x and place at (840, 130). -->
  <g transform="translate(840, 130) scale(3)" fill="#F0EEE8">
    <!-- Apex bud -->
    <circle cx="50" cy="6" r="7"/>
    <!-- Central stem -->
    <rect x="44" y="6" width="12" height="62" rx="6"/>
    <!-- Crossbar -->
    <rect x="12" y="56" width="76" height="12" rx="2"/>
    <!-- Left trunk + root flare -->
    <rect x="14" y="30" width="14" height="84" rx="7"/>
    <rect x="8" y="110" width="26" height="6" rx="3"/>
    <!-- Right trunk + root flare -->
    <rect x="72" y="30" width="14" height="84" rx="7"/>
    <rect x="66" y="110" width="26" height="6" rx="3"/>
  </g>

  <!-- Soft gold halo around the logo to give it presence. -->
  <circle cx="990" cy="320" r="220" fill="#E8C97A" fill-opacity="0.04"/>
  <circle cx="990" cy="320" r="170" fill="#E8C97A" fill-opacity="0.05"/>

  <!-- Wordmark — split-color HereToo. Syne 800 isn't bundled with
       resvg, so we fall back to a stack that lands on the closest
       available system display face: Inter / system-ui / Helvetica
       / sans-serif. The visual weight (800) and tight tracking
       (-2.5%) is what carries the brand feel. -->
  <g font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
     font-weight="800"
     font-size="148"
     letter-spacing="-3.7">
    <text x="100" y="285" fill="#F0EEE8">Here</text>
    <text x="430" y="285" fill="url(#gold)">Too</text>
  </g>

  <!-- No tagline, no pitch. The mark and the URL.
       What used to sit here: "Family-first social", then three bullets
       about being invited into a family, the feed rewarding what
       unites, and hate staying out by design. All of it described a
       product that no longer exists, and all of it was still being
       drawn into every shared link. -->

  <!-- Footer URL -->
  <text x="100" y="580" fill="#787890"
        font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
        font-weight="600" font-size="20" letter-spacing="0.4">
    heretoo.social
  </text>

  <!-- Thin gold edge accent at the bottom-left to echo the brand
       split. Tiny but recognizable. -->
  <rect x="100" y="610" width="80" height="3" fill="#E8C97A" opacity="0.85"/>
</svg>`;

const resvg = new Resvg(svg, {
  background: '#0A0A0F',
  fitTo: { mode: 'width', value: 1200 },
});
const png = resvg.render().asPng();

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${png.length.toLocaleString()} bytes)`);
