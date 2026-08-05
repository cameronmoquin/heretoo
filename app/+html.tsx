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
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" type="image/png" href="/favicon.png" />
        <link rel="mask-icon" href="/mask-icon.svg" color="#1A1A24" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="theme-color" content="#1A1A24" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>HereToo</title>
        {/* Link unfurl: the mark and the link. No description, by
            instruction — a preview does not get to explain the place
            either. scripts/copy-build-marker.mjs re-injects these after
            the export and wins, so any change here belongs there too. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="HereToo" />
        <meta property="og:title" content="HereToo" />
        <meta property="og:url" content="https://heretoo.social" />
        <meta property="og:image" content="https://heretoo.social/og-cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="HereToo" />
        <meta name="twitter:image" content="https://heretoo.social/og-cover.png" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

export const unstable_settings = { ssg: true };
