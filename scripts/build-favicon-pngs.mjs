#!/usr/bin/env node
/**
 * Generate PNG variants of public/favicon.svg.
 *
 * Why: Apple touch icon, PWA manifest icons, and some browsers prefer
 * PNG over SVG. We've been pointing apple-touch-icon at favicon.svg
 * which Safari technically supports but rendering can be inconsistent.
 *
 * Outputs in public/:
 *   - favicon-16.png   (browser tab small)
 *   - favicon-32.png   (browser tab retina)
 *   - favicon-192.png  (PWA manifest standard)
 *   - favicon-512.png  (PWA manifest large + Apple touch)
 *
 * All rendered from the same source SVG so the tree mark stays
 * consistent. resvg-js (already in devDeps for the OG cover) does
 * the SVG → PNG rasterization with no native dependencies.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'public', 'favicon.svg');
const svg = readFileSync(SRC, 'utf8');

const SIZES = [16, 32, 192, 512];

for (const size of SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)', // preserve transparent corners
  });
  const png = resvg.render().asPng();
  const out = join(ROOT, 'public', `favicon-${size}.png`);
  writeFileSync(out, png);
  console.log(`  Wrote favicon-${size}.png (${png.length.toLocaleString()} bytes)`);
}
