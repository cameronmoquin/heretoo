#!/usr/bin/env node
/**
 * build-brand — the NFFGA mark, and every file made from it.
 *
 * THE MARK (2026-10-04, Cameron): the fire-service cross with a golf ball
 * at its centre. Four broad arms with wavy outer edges around a large
 * circle, and the circle is a dimpled ball. Drawn from scratch here; a
 * stock reference image shaped the proportions but nothing was traced.
 *
 * Two drawings of the same cross, because dimples do not survive being
 * small:
 *   LINE   outlined cross, fine dimples at low opacity, open interior.
 *          The in-app mark and anything shown large.
 *   SOLID  filled cross, fewer and larger dimples punched out as holes.
 *          Favicons, the Safari pinned-tab icon, app icons — anywhere
 *          the mark may be 16 to 48 pixels across.
 *
 * Both are ONE colour (black, with alpha), so the app can tint the PNG
 * to the theme's ink with tintColor and it inverts in dark mode.
 *
 * Outputs:
 *   assets/brand/nffga-mark.svg            LINE source
 *   assets/brand/nffga-mark{,@2x,@3x}.png  LINE, 192/384/576 px, for BrandMark (web ships only the base, so it is 2x the largest placement)
 *   assets/brand/nffga-mark-solid.svg      SOLID source
 *   assets/brand/nffga-mark-solid{,@2x,@3x}.png  SOLID, 48/96/144 px, small BrandMark
 *   public/favicon.svg                     SOLID on a white rounded tile
 *   public/mask-icon.svg                   SOLID, bare (Safari pinned tab)
 *   assets/icon.png                        1024, white field, SOLID
 *   assets/adaptive-icon.png               1024, transparent, SOLID in the Android safe zone
 *   assets/splash-icon.png                 1024, transparent, LINE
 *   assets/favicon.png                     48, from favicon.svg
 *
 * public/favicon-*.png are made from public/favicon.svg by
 * build-favicon-pngs.mjs, which runs after this in `npm run build`.
 *
 * Run: node scripts/build-brand.mjs
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const C = 100; // centre of the 200 x 200 drawing

// ── Geometry ────────────────────────────────────────────────────────
// The fire-service cross, drawn from scratch: four broad arms with a
// wavy crest on each outer edge, the gaps between arms cut along the
// diagonals, and a large circle at the centre — which here is a golf
// ball. 200 x 200 box, y down, centre (100, 100).

const ARM = {
  cornerIn: 31,   // corner distance along the edge (x for the top arm)
  cornerOut: 19,  // corner distance from the outer boundary (y for the top arm)
  crest: 2,       // how high the middle of the outer edge rises
  ease: 32,       // how far the edge runs flat from each corner before rising
};
const BALL_R = 57; // outer edge of the golf ball

function rot([x, y], quarterTurns) {
  let dx = x - C, dy = y - C;
  for (let i = 0; i < quarterTurns; i++) [dx, dy] = [-dy, dx]; // 90° clockwise, y down
  return [C + dx, C + dy];
}
const f = (n) => Math.round(n * 100) / 100;
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

/** One closed path per arm. The sides run at 45° to the centre, where
 *  the ball covers them; the outer edge is an S-curve to a crest. */
function armPaths() {
  const a = ARM;
  const L = [a.cornerIn, a.cornerOut];
  const R = [200 - a.cornerIn, a.cornerOut];
  const crest = [C, a.crest];
  const c1 = [a.cornerIn + a.ease, a.cornerOut];      // leaves the corner flat
  const c2 = [C - a.ease * 0.85, a.crest];             // arrives at the crest flat
  const c3 = [C + a.ease * 0.85, a.crest];
  const c4 = [200 - a.cornerIn - a.ease, a.cornerOut];
  // Both 45° sides meet on the vertical axis below the ball's top edge.
  const apex = [C, a.cornerOut + (C - a.cornerIn)];
  const out = [];
  for (let k = 0; k < 4; k++) {
    const P = (p) => pt(rot(p, k));
    out.push(`M ${P(L)} C ${P(c1)} ${P(c2)} ${P(crest)} C ${P(c3)} ${P(c4)} ${P(R)} L ${P(apex)} Z`);
  }
  return out;
}
const ARMS = armPaths();

/**
 * Golf-ball dimples: a hex field inside the ball, each dimple an
 * ellipse squashed along the radius as it nears the edge, so the
 * circle reads as a sphere rather than a polka-dot disc.
 */
function ballDimples({ spacing, base, inset }) {
  const out = [];
  const rmax = BALL_R - inset;
  const rowH = spacing * Math.sqrt(3) / 2;
  const rows = Math.ceil((2 * rmax) / rowH) + 2;
  for (let row = -rows; row <= rows; row++) {
    const y = C + row * rowH;
    const shift = row % 2 ? spacing / 2 : 0;
    for (let x = C - rmax - spacing + shift; x <= C + rmax + spacing; x += spacing) {
      const d = Math.hypot(x - C, y - C) / rmax;
      if (d > 0.97) continue;
      const fore = Math.sqrt(1 - d * d);            // foreshortening toward the rim
      const rx = base * (0.55 + 0.45 * fore);       // across the radius: shrinks a little
      const ry = base * (0.25 + 0.75 * fore);       // along the radius: squashes a lot
      const ang = (Math.atan2(y - C, x - C) * 180) / Math.PI;
      out.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(ry)}" ry="${f(rx)}" transform="rotate(${f(ang)} ${f(x)} ${f(y)})"/>`);
    }
  }
  return out.join('');
}

/** LINE: outlined arms, the ball outlined with shaded dimples. */
function lineSvg({ ink = '#000000' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <!-- NFFGA mark (LINE). Fire-service cross with a golf ball at the centre.
       Generated by scripts/build-brand.mjs; edit there, not here. -->
  <defs>
    <mask id="outsideBall" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
      <rect width="200" height="200" fill="#fff"/>
      <circle cx="${C}" cy="${C}" r="${BALL_R - 3}" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#outsideBall)" fill="none" stroke="${ink}" stroke-width="6" stroke-linejoin="miter" stroke-miterlimit="10">
    ${ARMS.map((d) => `<path d="${d}"/>`).join('\n    ')}
  </g>
  <circle cx="${C}" cy="${C}" r="${BALL_R - 3}" fill="none" stroke="${ink}" stroke-width="6"/>
  <g fill="${ink}" fill-opacity="0.4">${ballDimples({ spacing: 10.2, base: 3.5, inset: 7 })}</g>
</svg>`;
}

/** SOLID: filled arms, the ball left open with bold dimples. For small sizes. */
function solidSvg({ ink = '#000000', tile = null } = {}) {
  const body = `<defs>
    <mask id="outsideBall" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
      <rect width="200" height="200" fill="#fff"/>
      <circle cx="${C}" cy="${C}" r="${BALL_R - 3}" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#outsideBall)" fill="${ink}">${ARMS.map((d) => `<path d="${d}"/>`).join('')}</g>
  <circle cx="${C}" cy="${C}" r="${BALL_R - 4}" fill="none" stroke="${ink}" stroke-width="8"/>
  <g fill="${ink}">${ballDimples({ spacing: 17, base: 5.4, inset: 10 })}</g>`;
  if (!tile) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <!-- NFFGA mark (SOLID). Generated by scripts/build-brand.mjs. -->
  ${body}
</svg>`;
  }
  // Tile: a white rounded square with the mark inset, for favicons.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="220" height="220">
  <!-- NFFGA favicon: SOLID mark on a white tile. Generated by scripts/build-brand.mjs. -->
  <rect width="220" height="220" rx="44" fill="${tile}"/>
  <g transform="translate(10 10)">${body}</g>
</svg>`;
}

/** Place a 200-box drawing at a scale inside a square canvas. */
function framed(inner, { canvas, scale, background = null }) {
  const off = (canvas - 200 * scale) / 2;
  const innerBody = inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas} ${canvas}" width="${canvas}" height="${canvas}">
  ${background ? `<rect width="${canvas}" height="${canvas}" fill="${background}"/>` : ''}
  <g transform="translate(${f(off)} ${f(off)}) scale(${scale})">${innerBody}</g>
</svg>`;
}

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' }).render().asPng();
}

function write(rel, data) {
  const p = join(ROOT, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, data);
  console.log(`  wrote ${rel}`);
}

const LINE = lineSvg();
const SOLID = solidSvg();
const FAVICON = solidSvg({ ink: '#0A0A0A', tile: '#FFFFFF' });

write('assets/brand/nffga-mark.svg', LINE);
write('assets/brand/nffga-mark-solid.svg', SOLID);
write('assets/brand/nffga-mark.png', png(LINE, 192));
write('assets/brand/nffga-mark@2x.png', png(LINE, 384));
write('assets/brand/nffga-mark@3x.png', png(LINE, 576));
// Small in-app sizes (under ~28 px) use the solid drawing; fine lines blur.
write('assets/brand/nffga-mark-solid.png', png(SOLID, 48));
write('assets/brand/nffga-mark-solid@2x.png', png(SOLID, 96));
write('assets/brand/nffga-mark-solid@3x.png', png(SOLID, 144));

write('public/favicon.svg', FAVICON);
write('public/mask-icon.svg', SOLID);
write('assets/favicon.png', png(FAVICON, 48));

// App icon: white field, mark at ~68% of the square.
write('assets/icon.png', png(framed(solidSvg({ ink: '#0A0A0A' }), { canvas: 1024, scale: 3.5, background: '#FFFFFF' }), 1024));
// Android adaptive foreground: keep inside the 66% safe zone.
write('assets/adaptive-icon.png', png(framed(solidSvg({ ink: '#0A0A0A' }), { canvas: 1024, scale: 3.1 }), 1024));
// Splash: the line mark, generous margin.
write('assets/splash-icon.png', png(framed(lineSvg({ ink: '#0A0A0A' }), { canvas: 1024, scale: 3.2 }), 1024));

export { LINE, SOLID, ARMS };
