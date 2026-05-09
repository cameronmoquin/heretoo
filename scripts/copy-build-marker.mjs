#!/usr/bin/env node
/**
 * Post-export tasks:
 *  1. Copy the build marker into dist/ so /_build.txt serves the latest commit
 *  2. Copy public/* (favicon.svg, mask-icon.svg, etc.) into dist/
 *  3. Inject favicon + theme-color tags into dist/index.html
 *     (Expo's static renderer strips <link> tags from +html.tsx, so we
 *     patch the file post-build instead.)
 */
import { copyFileSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PUB = join(ROOT, 'public');
const DIST = join(ROOT, 'dist');

// ── 1. _build.txt ──
const src = join(PUB, '_build.txt');
const dst = join(DIST, '_build.txt');
if (!existsSync(src)) {
  console.error('public/_build.txt not found — did build-info run?');
  process.exit(1);
}
copyFileSync(src, dst);
console.log('Copied _build.txt to dist/');

// ── 2. Copy any other static files in public/ to dist/ ──
if (existsSync(PUB)) {
  for (const name of readdirSync(PUB)) {
    if (name === '_build.txt') continue;
    const from = join(PUB, name);
    const to = join(DIST, name);
    if (statSync(from).isFile()) {
      copyFileSync(from, to);
      console.log(`Copied ${name} to dist/`);
    }
  }
}

// ── 3. Inject favicon links into dist/index.html ──
const indexPath = join(DIST, 'index.html');
if (existsSync(indexPath)) {
  let html = readFileSync(indexPath, 'utf8');
  // Description used for SEO + OG + Twitter Card. Same copy everywhere
  // so Slack / Discord / iMessage / Twitter all show the same preview.
  // The pitch in plain English: this is family-first media — you only
  // get in by being invited into a family, the common feed only rewards
  // posts that bring people together, and there's a private family-only
  // layer underneath for actual life stuff (origin: health emergency
  // updates between extended family). The algorithm penalizes division
  // and won't promote hate. Conflict-resolution help when families spat.
  const TITLE = 'HereToo — Family-first social media';
  // Honest copy: state principles + invite-only gating (both true today),
  // skip the algorithm + moderation claims (still under construction).
  // Phrased as "built so..." rather than "the feed does..." so we're
  // describing intent, not promising current behavior.
  const DESCRIPTION =
    'Family-first social. Invite-only via family. Built so what unites '
    + 'you matters more than what divides — and so the people who '
    + 'matter most get a feed that earns their attention.';
  const OG_IMAGE = 'https://heretoo.social/og-cover.png';
  const URL = 'https://heretoo.social';

  const headTags = [
    // Icons + manifest. Apple specifically wants PNG for the
    // apple-touch-icon — SVG is technically supported but render
    // glitchy at iOS Add-to-Home-Screen sizes. The browser tab can
    // pick either; modern browsers prefer SVG, older fall back to
    // the 32px PNG.
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />',
    '<link rel="apple-touch-icon" sizes="192x192" href="/favicon-192.png" />',
    '<link rel="apple-touch-icon" sizes="512x512" href="/favicon-512.png" />',
    '<link rel="mask-icon" href="/mask-icon.svg" color="#0A0A0F" />',
    '<link rel="manifest" href="/manifest.webmanifest" />',
    // Fonts — Source of Truth, M10. Syne for display, Inter for body,
    // Source Serif 4 for long-form. Loaded from Google Fonts CDN with
    // preconnect for performance. The clean font-family names ('Syne',
    // 'Source Serif 4') match the inline styles throughout the app.
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@600;700;800&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" />',
    // Theme + PWA hints
    '<meta name="theme-color" content="#0A0A0F" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    '<meta name="apple-mobile-web-app-title" content="HereToo" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    // SEO
    `<meta name="description" content="${DESCRIPTION}" />`,
    // Open Graph (Facebook, iMessage, Slack, Discord, LinkedIn)
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="HereToo" />',
    `<meta property="og:title" content="${TITLE}" />`,
    `<meta property="og:description" content="${DESCRIPTION}" />`,
    `<meta property="og:url" content="${URL}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    // Twitter Card — same data, separate namespace
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${TITLE}" />`,
    `<meta name="twitter:description" content="${DESCRIPTION}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  ].join('\n    ');

  // Strip any auto-injected default favicon link first.
  html = html.replace(/<link rel="icon" href="\/favicon\.ico"\s*\/?>\s*/g, '');

  // Inject <title> if missing, then the head tags. Idempotent — keyed
  // off the og:title meta so we don't duplicate on reruns.
  if (!/<title>/.test(html)) {
    html = html.replace('</head>', `    <title>${TITLE}</title>\n  </head>`);
  }
  if (!html.includes('property="og:title"')) {
    html = html.replace('</head>', `    ${headTags}\n  </head>`);
    writeFileSync(indexPath, html);
    console.log('Injected favicon + OG + Twitter Card tags into dist/index.html');
  } else {
    console.log('Head tags already present in dist/index.html');
  }
} else {
  console.warn('dist/index.html not found — skipping favicon injection');
}
