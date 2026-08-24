// ─────────────────────────────────────────────────────────────────────
// THIS FILE IS IGNORED IN PRODUCTION. web.output is "single" (the
// default), and expo export only reads +html.tsx under output:
// "static" — the shipped index.html comes from Expo's own template.
// Document-level changes (meta tags, viewport) must go through
// scripts/fix-viewport.mjs or a sibling post-build step, which is
// where viewport-fit=cover actually lands. Editing this file changes
// nothing anyone downloads; it stays only in case output ever flips.
// ─────────────────────────────────────────────────────────────────────
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML template for Expo Router web.
 * Injects favicon, theme color, and prevents bounce scroll on body.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" type="image/png" href="/favicon-32.png" />
        <link rel="mask-icon" href="/mask-icon.svg" color="#1A1A24" />
        <link rel="apple-touch-icon" href="/favicon-512.png" />
        <meta name="theme-color" content="#1A1A24" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>HereToo — the anti-social media</title>
        {/* The sign went up when Myspace announced its anti-algorithm
            relaunch: being indexable means having words. One slogan, one
            grounding line. scripts/copy-build-marker.mjs re-injects
            these after the export and WINS, so any change here belongs
            there too — that file overwriting this one is how the old
            family-first pitch survived its own removal. */}
        <meta name="description" content="Are you intelligent enough to be HereToo? Built on art, music, and Shakespeare." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="HereToo" />
        <meta property="og:title" content="HereToo — the anti-social media" />
        <meta property="og:description" content="Are you intelligent enough to be HereToo? Built on art, music, and Shakespeare." />
        <meta property="og:url" content="https://heretoo.social" />
        <meta property="og:image" content="https://heretoo.social/og-cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="HereToo — the anti-social media" />
        <meta name="twitter:description" content="Are you intelligent enough to be HereToo? Built on art, music, and Shakespeare." />
        <meta name="twitter:image" content="https://heretoo.social/og-cover.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

export const unstable_settings = { ssg: true };
