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

  <!-- Subtle linked-tree motif on the right.
       Five nodes connected by thin lines — abstract enough that it
       reads as both family tree and social graph without being
       literal. Sits behind/under the wordmark for atmosphere. -->
  <g stroke="#E8C97A" stroke-opacity="0.18" stroke-width="1.4" fill="none">
    <!-- root, two parents above, two children below -->
    <line x1="980" y1="160" x2="980" y2="280"/>
    <line x1="900" y1="100" x2="980" y2="160"/>
    <line x1="1060" y1="100" x2="980" y2="160"/>
    <line x1="980" y1="280" x2="900" y2="370"/>
    <line x1="980" y1="280" x2="1060" y2="370"/>
    <line x1="900" y1="370" x2="830" y2="450"/>
    <line x1="900" y1="370" x2="970" y2="450"/>
    <line x1="1060" y1="370" x2="990" y2="450"/>
    <line x1="1060" y1="370" x2="1130" y2="450"/>
  </g>
  <g fill="#E8C97A" fill-opacity="0.22">
    <circle cx="900" cy="100" r="9"/>
    <circle cx="1060" cy="100" r="9"/>
    <circle cx="980" cy="220" r="11"/>
    <circle cx="900" cy="370" r="9"/>
    <circle cx="1060" cy="370" r="9"/>
    <circle cx="830" cy="450" r="7"/>
    <circle cx="970" cy="450" r="7"/>
    <circle cx="990" cy="450" r="7"/>
    <circle cx="1130" cy="450" r="7"/>
  </g>

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

  <!-- Tagline -->
  <text x="100" y="370" fill="#A8A8BD"
        font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
        font-weight="500" font-size="34" letter-spacing="-0.4">
    Family-first social.
  </text>

  <!-- Pitch — three-line description. Generous line-height for
       readability when this image is shrunk to a Slack thumbnail. -->
  <g font-family="Inter, system-ui, -apple-system, Helvetica, Arial, sans-serif"
     font-weight="400" font-size="22" fill="#C8C8D6" letter-spacing="-0.1">
    <text x="100" y="450">Join only by being invited into a family.</text>
    <text x="100" y="486">The feed rewards what unites — not what divides.</text>
    <text x="100" y="522">Hate stays out by design.</text>
  </g>

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
