/**
 * WallpaperBackground — renders the user's chosen tile pattern as the
 * page-level canvas behind cards. Sits at the root layout, ABOVE
 * Colors.background and BELOW everything else.
 *
 * Styling philosophy: by default we render the pattern at ~35% opacity
 * with a 20% grayscale filter so the colors are present but not
 * shouty — wallpaper-as-decor, not wallpaper-showroom. "Bold" mode
 * (toggle in user prefs) renders at full strength.
 *
 * We do this with a separate absolutely-positioned overlay div rather
 * than putting the background-image directly on the page-level View,
 * because RN-on-web's View doesn't expose `filter` as a style prop.
 * The overlay lets us layer:
 *   1. solid Colors.background (always on)
 *   2. patterned overlay at chosen opacity + filter (this component)
 *   3. cards / content (the rest of the layout)
 */

import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { useWallpaper, WALLPAPERS, wallpaperToDataUri } from '../../stores/wallpaperStore';
import { useEffectiveFamilyWallpaper } from '../../hooks/useFamilyWallpaper';
import { Colors } from '../../constants/colors';

interface Props {
  /** Optional: render with stronger pattern density (e.g., on a
   *  family page where the wallpaper IS the room's identity). */
  bold?: boolean;
  /** Optional: render the family's voted-on wallpaper instead of the
   *  user's personal one. Used inside the /family/[id] page to give
   *  each family its own "room" appearance. */
  familyId?: string;
}

/**
 * Renders the active wallpaper as a full-bleed overlay. Web-only —
 * native gets nothing yet (we'll wire it via expo-image once we ship
 * the native build).
 */
export function WallpaperBackground({ bold: boldOverride, familyId }: Props = {}) {
  // CRITICAL: every hook MUST be called every render to satisfy the
  // rules of hooks. Read both stores unconditionally then choose.
  const personalId = useWallpaper((s) => s.id);
  const userBold = useWallpaper((s) => s.bold);
  const familyWp = useEffectiveFamilyWallpaper(familyId ?? null);

  // Family wallpaper (voted on by members) takes priority when this
  // component is rendered inside a family page. Otherwise fall back
  // to the user's personal wallpaper.
  const effectiveId = familyId ? (familyWp.data ?? 'plain') : personalId;
  const bold = boldOverride ?? userBold;

  const def = WALLPAPERS[effectiveId as keyof typeof WALLPAPERS] ?? WALLPAPERS.plain;
  if (!def.svg) return null;
  if (Platform.OS !== 'web') return null;

  const bgImage = wallpaperToDataUri(def);
  // Default visibility tuned so the pattern reads as decor without
  // fighting the cards. Earlier 0.35 + 20% grayscale was nearly
  // invisible, especially on mobile where cards cover most of the
  // viewport — the user pointed out the blank space wasn't being
  // used. Lifted to 0.55 + 10% grayscale: still subordinate, but
  // genuinely present in the canvas margins.
  const opacity = bold ? 0.95 : 0.55;
  const filter = bold ? 'none' : 'grayscale(10%) contrast(96%)';

  // RN-on-web accepts CSS-only properties (backgroundImage, filter)
  // that aren't in ViewStyle's TS type. Cast through `any` rather
  // than fighting the types — the runtime accepts it.
  const overlayStyle: any = {
    ...StyleSheet.absoluteFillObject,
    backgroundImage: bgImage,
    backgroundRepeat: 'repeat',
    backgroundSize: `${def.tileSize}px ${def.tileSize}px`,
    opacity,
    filter,
    zIndex: 0,
  };

  return <View pointerEvents="none" style={overlayStyle} />;
}

/**
 * Color used for the page underlay. Always rendered first, regardless
 * of wallpaper choice — wallpaper sits ON TOP of this. Components that
 * need the underlay color (e.g., to bleed the page edge into a fixed
 * header) can read this directly.
 */
export const wallpaperUnderlayColor = Colors.background;
