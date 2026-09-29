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
  // THE SIGN WENT UP (Aug 2026). The bare unfurl — mark and link, no
  // description — was the bar-with-no-sign posture, and it lasted until
  // Myspace announced an anti-algorithm relaunch. Being indexable means
  // having words, so these are the words. One slogan, one grounding
  // line, nothing else. Search snippets and link unfurls read the same
  // meta, so the preview carries this line too; that is the cost of
  // being findable and it was accepted knowingly.
  //
  // This file runs AFTER the export and overwrites app/+html.tsx's
  // tags. The two must stay identical; the one that wins is this one.
  const TITLE = 'HereToo — the anti-social media';
  const DESCRIPTION =
    'Are you intelligent enough to be HereToo? Built on art, music, and Shakespeare.';
  const OG_IMAGE = 'https://heretoo.social/og-cover.png';
  const URL = 'https://heretoo.social';

  // STRUCTURED DATA. The shell ships zero <a> tags and, until this, zero
  // machine-readable facts — a crawler could tell that heretoo.social
  // existed and nothing else about it. schema.org is the vocabulary
  // Google and Bing actually parse.
  //
  // EVERY DATE HERE IS TRUE AND INDEPENDENTLY CHECKABLE, which is the
  // point, and the reason not to round them to something tidier:
  //
  //   foundingDate 2026-04-13   heretoo.social was registered at 03:32
  //                             UTC (Identity Digital, the .social
  //                             registry) and the public GitHub repo was
  //                             created at 11:57 UTC. Two registries,
  //                             neither of them ours.
  //   datePublished 2026-04-14  first successful Netlify deploy, 17:20
  //                             UTC — the first moment the site was built
  //                             and served to the public. Verify with:
  //                             curl -s 'https://api.netlify.com/api/v1/
  //                             sites/heretoo.social/deploys'
  //
  // sameAs points at the public repo deliberately: it is a third party's
  // timestamped record of this name, so a crawler can follow the claim
  // to someone else's server rather than taking ours.
  //
  // Self-declared metadata is weak evidence on its own — anyone can type
  // a date. It is worth something only while it agrees with the records
  // above. If these ever stop matching, fix the date here, not there.
  const JSON_LD = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${URL}/#organization`,
        name: 'HereToo',
        url: URL,
        foundingDate: '2026-04-13',
        logo: `${URL}/favicon-512.png`,
        description: DESCRIPTION,
        sameAs: ['https://github.com/cameronmoquin/heretoo'],
      },
      {
        '@type': 'WebSite',
        '@id': `${URL}/#website`,
        name: 'HereToo',
        url: URL,
        datePublished: '2026-04-14',
        inLanguage: 'en-US',
        publisher: { '@id': `${URL}/#organization` },
      },
    ],
  });

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
    // Fonts. Inter alone — docs/UI_SYSTEM.md §3, one family.
    //
    // This line still asked Google for Syne and Source Serif 4 long after
    // phase 1 deleted their expo-font loading, so every visitor paid for
    // two font families the design had retired. The web-only fontFamily
    // overrides that still name them fall back to Inter and Georgia
    // respectively; those overrides are the next thing to go.
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />',
    // Theme + PWA hints
    '<meta name="theme-color" content="#0A0A0F" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    '<meta name="apple-mobile-web-app-title" content="HereToo" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    // SEO
    // Open Graph (Facebook, iMessage, Slack, Discord, LinkedIn)
    '<meta property="og:type" content="website" />',
    `<meta name="description" content="${DESCRIPTION}" />`,
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
      // schema.org, last so it reads as the summary of everything above.
    `<script type="application/ld+json">${JSON_LD}</script>`,
  ].join('\n    ');

  // Strip any auto-injected default favicon link first.
  html = html.replace(/<link rel="icon" href="\/favicon\.ico"\s*\/?>\s*/g, '');

  // REPLACE the title, do not merely add one. Expo's static renderer
  // writes <title> from app.json's name ("HereToo"), ignoring whatever
  // +html.tsx says — so the inject-if-missing branch never fired and the
  // shipped tab title stayed bare while every other tag updated.
  if (/<title>/.test(html)) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
  } else {
    html = html.replace('</head>', `    <title>${TITLE}</title>\n  </head>`);
  }
  if (!html.includes('property="og:title"') || !html.includes('application/ld+json')) {
    html = html.replace('</head>', `    ${headTags}\n  </head>`);
    writeFileSync(indexPath, html);
    console.log('Injected favicon + OG + Twitter Card + schema.org JSON-LD into dist/index.html');
  } else {
    console.log('Head tags already present in dist/index.html');
  }
} else {
  console.warn('dist/index.html not found — skipping favicon injection');
}
