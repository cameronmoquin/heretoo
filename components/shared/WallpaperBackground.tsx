/**
 * WallpaperBackground — appends a wallpaper `<div>` directly to
 * document.body so it lives OUTSIDE the React tree entirely. No
 * ancestor wrapper can cover it because it has no React ancestors.
 *
 * Why this approach: every previous attempt got hidden by some
 * combination of:
 *   - React Native View rendering as opaque-by-default <div>
 *   - Expo Router screen wrappers with their own backgroundColor
 *   - SafeAreaView / KeyboardAvoidingView wrappers
 *   - Stacking contexts created by transforms / position / isolation
 *
 * Bypassing the React tree fixes all of those at once.
 *
 * The injected div:
 *   - position: fixed, full viewport, behind everything (z-index: 0)
 *   - pointer-events: none (doesn't block taps)
 *   - background painted via the active wallpaper's data URI
 *   - body and html get inline `background-color: transparent` so
 *     the React root's transparency reaches our wallpaper div
 *
 * Updates: re-renders the div's style when the wallpaper id changes
 * (personal store, or family-effective if familyId provided).
 *
 * Native: returns null. The component still mounts so hooks run
 * (rules of hooks), but no DOM happens.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useWallpaper, WALLPAPERS, wallpaperToDataUri } from '../../stores/wallpaperStore';
import { useEffectiveFamilyWallpaper } from '../../hooks/useFamilyWallpaper';

interface Props {
  bold?: boolean;
  familyId?: string;
}

const WALLPAPER_DIV_ID = 'heretoo-wallpaper';
const BASELINE_STYLE_ID = 'heretoo-wallpaper-baseline';
const BASE_BG = '#F6F6F9';

export function WallpaperBackground({ bold: boldOverride, familyId }: Props = {}) {
  // Hooks unconditional + first.
  const personalId = useWallpaper((s) => s.id);
  const userBold = useWallpaper((s) => s.bold);
  const familyWp = useEffectiveFamilyWallpaper(familyId ?? null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    // ── 1. Inject baseline transparent rules so the React tree
    //       doesn't accidentally cover us. Idempotent.
    //       Negative z-index puts the wallpaper BEHIND every React-
    //       rendered element in the body's stacking context.
    //       Aggressive override of any background on #root or its
    //       direct children (where most opaque ancestors live in
    //       Expo Router output). ─────────────────────────────────
    if (!document.getElementById(BASELINE_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = BASELINE_STYLE_ID;
      style.textContent = `
        html, body, #root {
          background-color: transparent !important;
        }
        /* The React mount is #root; its first descendant is usually
           the user's outermost View. Make that transparent too so
           the wallpaper isn't hidden by a 100vh opaque sibling. */
        #root > div:first-child {
          background-color: transparent !important;
        }
        body { margin: 0; }
        #${WALLPAPER_DIV_ID} {
          position: fixed;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-color: ${BASE_BG};
        }
        /* Reserve room on the left for the LeftSidebar (240px wide)
           on desktop viewports. Without this, the sidebar overlaps
           the page's centered content. The CSS media query handles
           the threshold (1024px) without React re-renders. */
        @media (min-width: 1024px) {
          #root > div:first-child {
            padding-left: 240px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // ── 2. Make sure our wallpaper div exists in document.body
    //       BEFORE the React tree's siblings so it sits behind. ────
    let div = document.getElementById(WALLPAPER_DIV_ID) as HTMLDivElement | null;
    if (!div) {
      div = document.createElement('div');
      div.id = WALLPAPER_DIV_ID;
      div.setAttribute('aria-hidden', 'true');
      // Insert as the FIRST child of body so it's beneath the
      // React mount point in source order (and z-index: 0 vs the
      // React content's positive/auto z-index also keeps it below).
      document.body.insertBefore(div, document.body.firstChild);
    }

    // ── 3. Apply the active wallpaper to it ────────────────────────
    const effectiveId = familyId ? (familyWp.data ?? 'plain') : personalId;
    const bold = boldOverride ?? userBold;
    const def = WALLPAPERS[effectiveId as keyof typeof WALLPAPERS] ?? WALLPAPERS.plain;

    if (def.svg) {
      const url = wallpaperToDataUri(def);
      // FOUR layers of redundancy. The wallpaper has been near-impossible
      // to get on screen across attempts so we paint it on every layer
      // that COULD show through, in case the others are hidden by
      // ancestor styles we haven't tracked down:
      //
      //   1. The body-injected div (position: fixed, z-index: -1,
      //      sits behind every React-rendered element)
      //   2. document.body inline style (covered by #root/body
      //      transparent rule we injected)
      //   3. document.documentElement (the <html> root — absolute
      //      bottom of the stacking pile, only React's transparent
      //      mount can fail to reveal this)
      //   4. backgroundAttachment: fixed so it doesn't scroll out
      //      of the viewport mid-page

      div.style.backgroundImage = url;
      div.style.backgroundRepeat = 'repeat';
      div.style.backgroundSize = `${def.tileSize}px ${def.tileSize}px`;
      div.style.backgroundAttachment = 'fixed';
      div.style.opacity = bold ? '1' : '0.85';

      document.body.style.backgroundImage = url;
      document.body.style.backgroundRepeat = 'repeat';
      document.body.style.backgroundSize = `${def.tileSize}px ${def.tileSize}px`;
      document.body.style.backgroundAttachment = 'fixed';

      // <html> root — same paint, last line of defense.
      const html = document.documentElement;
      if (html) {
        html.style.backgroundImage = url;
        html.style.backgroundRepeat = 'repeat';
        html.style.backgroundSize = `${def.tileSize}px ${def.tileSize}px`;
        html.style.backgroundAttachment = 'fixed';
      }

      // Debug log — paste from DevTools if this still doesn't show.
      // eslint-disable-next-line no-console
      console.log('[wallpaper] applied (4-layer)', {
        id: effectiveId,
        label: def.label,
        tileSize: def.tileSize,
        bold,
        urlPrefix: url.slice(0, 60) + '...',
        divHasBg: !!div.style.backgroundImage,
        bodyHasBg: !!document.body.style.backgroundImage,
        htmlHasBg: !!document.documentElement?.style.backgroundImage,
      });
    } else {
      div.style.backgroundImage = '';
      div.style.opacity = '1';
      document.body.style.backgroundImage = '';
      if (document.documentElement) {
        document.documentElement.style.backgroundImage = '';
      }
      // eslint-disable-next-line no-console
      console.log('[wallpaper] cleared (plain)');
    }
  }, [personalId, userBold, boldOverride, familyId, familyWp.data]);

  return null;
}

export const wallpaperUnderlayColor = BASE_BG;
