/**
 * GlobalWebStyles — the handful of document-level rules React Native
 * Web can't express from a component style.
 *
 * Four document-level jobs, all layout:
 *
 *   1. the Inter stack on html / body
 *   2. zero body margin
 *   3. gutter reservation for the two sidebars, driven by the body
 *      data-attrs LeftSidebar and RightSidebar set on mount
 *   4. the centered desktop column
 *
 * The canvas color is painted by the root View from Colors.background.
 * Body gets the same value so overscroll matches in dark mode.
 *
 * Native renders nothing.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Colors } from '../../constants/colors';

const STYLE_ID = 'heretoo-global';

export function GlobalWebStyles() {
  // The root View is keyed on theme mode, so this remounts on a mode
  // flip and re-reads Colors. Same reason a makeStyles() factory works.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent = `
      html, body {
        font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
        background-color: ${Colors.background};
      }
      body { margin: 0; }
      #root { background-color: transparent; }

      /* Reserve room for each sidebar only while it is actually on
         screen. The sidebars toggle these attrs themselves, so auth
         pages (no sidebar) keep their centered card on the real
         viewport axis. */
      body[data-left-sidebar='on'] #root > div:first-child {
        padding-left: 240px;
      }
      body[data-right-sidebar='on'] #root > div:first-child {
        padding-right: 352px;
      }

      /* Centered column on desktop. The (auth) layout flex-centers its
         own 480px card and this clamp would fight it. */
      @media (min-width: 1024px) {
        body:not([data-auth-layout='on']) #root > div:first-child > div:not([style*="position: fixed"]) {
          max-width: 720px !important;
          margin-left: auto !important;
          margin-right: auto !important;
          width: 100% !important;
        }
      }
      body[data-auth-layout='on'] #root > div:first-child {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
    `;
  }, []);

  return null;
}
