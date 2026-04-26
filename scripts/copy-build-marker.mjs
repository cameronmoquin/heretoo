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
  const headTags = [
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
    '<link rel="alternate icon" type="image/png" href="/favicon.png" />',
    '<link rel="mask-icon" href="/mask-icon.svg" color="#0A0A0F" />',
    '<link rel="apple-touch-icon" href="/favicon.svg" />',
    '<meta name="theme-color" content="#0A0A0F" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  ].join('\n    ');

  // Strip any auto-injected default favicon link first.
  html = html.replace(/<link rel="icon" href="\/favicon\.ico"\s*\/?>\s*/g, '');

  // Inject before </head>. Idempotent — won't duplicate if rerun.
  if (!html.includes('rel="icon" type="image/svg+xml"')) {
    html = html.replace('</head>', `    ${headTags}\n  </head>`);
    writeFileSync(indexPath, html);
    console.log('Injected favicon + theme-color tags into dist/index.html');
  } else {
    console.log('Favicon tags already present in dist/index.html');
  }
} else {
  console.warn('dist/index.html not found — skipping favicon injection');
}
