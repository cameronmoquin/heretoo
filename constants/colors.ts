/**
 * Theme palettes. Light and dark.
 *
 * Source of truth: docs/UI_SYSTEM.md §2. Monochrome plus one red, and
 * the red is reserved for the heart. Nothing else is colored. An accent
 * that appears everywhere stops meaning anything.
 *
 * Light and dark are a viewer preference, not a skin. `setColorMode`
 * keeps working and keeps doing `Object.assign`.
 *
 * THE THEMING RULE. Components read `Colors` at render time through a
 * `makeStyles()` factory called inside the component. Never a
 * module-level `StyleSheet.create` that reads `Colors`, never a
 * `useMemo` around it. A module body runs at import, before the palette
 * is set, so it would freeze. The repo has zero frozen stylesheets.
 * Keep it that way.
 *
 * ALIAS KEYS. Everything under the "aliases" heading in each palette is
 * a retired token kept so existing imports resolve. Each maps to its
 * nearest value in the new system. A later cleanup deletes them and
 * rewrites the call sites. Do not add new reads of an alias key.
 *
 * Canonical keys, the only ones new code should use:
 *   background surface surfaceAlt border
 *   textPrimary textSecondary textMuted
 *   primary onPrimary heart error
 */

export type ThemeMode = 'dark' | 'light';

export const light = {
  // ── Canonical ──────────────────────────────────────────────────────
  background: '#FFFFFF',      // the canvas, flat
  surface: '#FFFFFF',         // rows sit on the canvas, no fill
  surfaceAlt: '#F7F7F7',      // inputs, subtle wells
  border: '#E5E5E5',          // hairline rules and dividers
  textPrimary: '#0A0A0A',     // body and headings. 20:1 on white
  textSecondary: '#6B6B6B',   // timestamps, secondary labels. 5.2:1
  textMuted: '#767676',       // counts, placeholders. 4.54:1, clears AA
  primary: '#0A0A0A',         // primary buttons, active nav
  onPrimary: '#FFFFFF',       // ink on a primary fill. 20:1
  heart: '#FF3040',           // the heart, and nothing else
  error: '#D93025',           // failures only. 4.8:1 on white

  // ── Aliases (retired, kept so imports resolve) ─────────────────────
  // surfaceLight → surfaceAlt. Wells and hovered rows.
  surfaceLight: '#F7F7F7',
  // borderLight → border. There is one hairline weight now.
  borderLight: '#E5E5E5',
  // brandIvory was mode-invariant near-white ink used on dark chrome
  // (call tiles, trivia board). It stays a light ink in BOTH modes or
  // that chrome loses its contrast.
  brandIvory: '#F5F5F5',
  brandGold: '#0A0A0A',       // the gold is gone. → primary.
  brandDark: '#0A0A0A',       // → the dark ink of the system
  primaryDark: '#000000',     // pressed ink
  primaryLight: '#3A3A3A',    // disabled / receded ink
  primaryFaint: 'rgba(10, 10, 10, 0.06)', // selected chip wash
  // Reaction + badge hues collapse to ink. Monochrome carries them.
  agree: '#0A0A0A',
  disagree: '#D93025',
  important: '#0A0A0A',
  bridge: '#6B6B6B',
  share: '#6B6B6B',
  badgeLocal: '#F7F7F7',
  badgeReaching: '#6B6B6B',
  badgeBridging: '#6B6B6B',
  badgeCommonGround: '#6B6B6B',
  clusters: {
    pragmatic_center: '#6B6B6B',
    community_focused: '#6B6B6B',
    tradition_minded: '#6B6B6B',
    reform_oriented: '#6B6B6B',
    liberty_focused: '#6B6B6B',
    unclassified: '#767676',
  },
  // Alarm states. `warning` guards irreversible actions, so it keeps the
  // error red and keeps reading as alarm.
  warning: '#D93025',
  success: '#0A0A0A',
  info: '#6B6B6B',
};

export const dark = {
  // ── Canonical ──────────────────────────────────────────────────────
  background: '#101010',
  surface: '#101010',
  surfaceAlt: '#1C1C1C',
  border: '#2A2A2A',
  textPrimary: '#F5F5F5',
  textSecondary: '#A0A0A0',   // 7.3:1 on #101010
  textMuted: '#8A8A8A',        // 5.51:1, clears AA
  primary: '#F5F5F5',
  onPrimary: '#0A0A0A',
  heart: '#FF3040',
  error: '#F2564D',

  // ── Aliases (retired, kept so imports resolve) ─────────────────────
  surfaceLight: '#1C1C1C',
  borderLight: '#2A2A2A',
  brandIvory: '#F5F5F5',
  brandGold: '#F5F5F5',
  brandDark: '#101010',
  primaryDark: '#D4D4D4',
  primaryLight: '#FFFFFF',
  primaryFaint: 'rgba(245, 245, 245, 0.10)',
  agree: '#F5F5F5',
  disagree: '#F2564D',
  important: '#F5F5F5',
  bridge: '#A0A0A0',
  share: '#A0A0A0',
  badgeLocal: '#1C1C1C',
  badgeReaching: '#A0A0A0',
  badgeBridging: '#A0A0A0',
  badgeCommonGround: '#A0A0A0',
  clusters: {
    pragmatic_center: '#A0A0A0',
    community_focused: '#A0A0A0',
    tradition_minded: '#A0A0A0',
    reform_oriented: '#A0A0A0',
    liberty_focused: '#A0A0A0',
    unclassified: '#8A8A8A',
  },
  warning: '#F2564D',
  success: '#F5F5F5',
  info: '#A0A0A0',
};

// Default light, matching stores/themeStore. Set before first render by
// the root layout, which calls setColorMode synchronously.
let _mode: ThemeMode = 'light';

export function setColorMode(mode: ThemeMode) {
  _mode = mode;
  Object.assign(Colors, mode === 'dark' ? dark : light);
}
export function getColorMode(): ThemeMode { return _mode; }

// Mutable export. The root layout's `key={themeMode}` forces a remount
// so every component re-reads these values when the mode changes.
export const Colors = { ...light } as typeof light;
