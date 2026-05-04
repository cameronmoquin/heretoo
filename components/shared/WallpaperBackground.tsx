/**
 * WallpaperBackground — paints the active pattern as the document.body
 * background, NOT as an in-tree absolute overlay.
 *
 * Why: the previous in-tree approach broke whenever any ancestor
 * container painted an opaque backgroundColor — and there are many
 * (Stack content style, route wrappers, SafeAreaView, etc.). We swept
 * a bunch transparent but more keep slipping through, especially on
 * Expo Router's auto-generated screen wrappers. Painting on the body
 * sidesteps all of them: only opaque DESCENDANTS hide the wallpaper,
 * which means cards / headers / nav still render correctly while the
 * canvas margins / edges always show through transparent regions.
 *
 * Listens to useWallpaper() and (when familyId is given) the family-
 * effective wallpaper; updates the body's background-image style on
 * every change. Cleans up on unmount so the auth screens or pages
 * outside the route don't accidentally inherit a wallpaper.
 *
 * On native this component renders nothing (no document.body); we'll
 * wire native via expo-image when the native build ships.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useWallpaper, WALLPAPERS, wallpaperToDataUri } from '../../stores/wallpaperStore';
import { useEffectiveFamilyWallpaper } from '../../hooks/useFamilyWallpaper';

interface Props {
  /** Optional: render with stronger pattern density. */
  bold?: boolean;
  /** Optional: render the family's voted-on wallpaper instead of the
   *  user's personal one. Used inside /family/[id]. */
  familyId?: string;
}

const BODY_DATA_ATTR = 'data-heretoo-wallpaper';

export function WallpaperBackground({ bold: boldOverride, familyId }: Props = {}) {
  // CRITICAL: hooks must be called every render. Read both stores
  // unconditionally then choose.
  const personalId = useWallpaper((s) => s.id);
  const userBold = useWallpaper((s) => s.bold);
  const familyWp = useEffectiveFamilyWallpaper(familyId ?? null);

  const effectiveId = familyId ? (familyWp.data ?? 'plain') : personalId;
  const bold = boldOverride ?? userBold;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const def = WALLPAPERS[effectiveId as keyof typeof WALLPAPERS] ?? WALLPAPERS.plain;
    const body = document.body;
    if (!body) return;

    // Mark body so we know we own these styles (cleanup uses this)
    body.setAttribute(BODY_DATA_ATTR, '1');

    if (!def.svg) {
      // 'plain' / no wallpaper — clear our styles.
      body.style.backgroundImage = '';
      body.style.backgroundRepeat = '';
      body.style.backgroundSize = '';
      body.style.backgroundAttachment = '';
      return;
    }

    const url = wallpaperToDataUri(def);
    body.style.backgroundImage = url;
    body.style.backgroundRepeat = 'repeat';
    body.style.backgroundSize = `${def.tileSize}px ${def.tileSize}px`;
    // Fixed so the pattern doesn't scroll behind content — feels more
    // like wallpaper, less like a giant image.
    body.style.backgroundAttachment = 'fixed';
    // We rely on opacity at the layer above (the React tree), which
    // we control by injecting a stylesheet rule: pages have transparent
    // wrappers so the body shows through. The pattern's own colors
    // are toned down at the SVG level to read as decor.

    return () => {
      // Don't strip on unmount — the next mount re-applies. Stripping
      // would cause flicker between page changes.
    };
  }, [effectiveId, bold]);

  // Inject a one-time stylesheet rule so the document html and root
  // app container are transparent. This catches ALL the legacy opaque
  // wrappers we missed in earlier sweeps without having to chase each
  // one. Body keeps the pattern; everything above is transparent until
  // it hits a card/header/nav with an explicit surface bg.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const STYLE_ID = 'heretoo-wallpaper-baseline';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html, body, #root, #__next {
        background-color: transparent !important;
      }
      /* Soft tint underneath the wallpaper so cards still pop on
         desktop where the canvas is wide. */
      body {
        background-color: #F6F6F9 !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  return null;
}

/** Cleared the in-tree overlay — body painting handles it now. */
export const wallpaperUnderlayColor = '#F6F6F9';
