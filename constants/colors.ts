/**
 * Theme palettes — dark + light.
 *
 * Components import `Colors` and use it as a static; the value gets
 * reassigned when the user toggles theme. The root layout uses
 * `key={themeMode}` to force a full re-render so every component
 * picks up the new palette values.
 */

export type ThemeMode = 'dark' | 'light';

const dark = {
  // Brand
  brandIvory: '#F0EEE8',
  brandGold: '#E8C97A',
  brandDark: '#0A0A0F',

  // Primary — electric blue with a hint of purple
  primary: '#4F6EFF',
  primaryDark: '#3B5AE8',
  primaryLight: '#7B93FF',
  primaryFaint: 'rgba(79, 110, 255, 0.08)',

  // Surfaces
  background: '#0A0A0F',
  surface: '#12121A',
  surfaceLight: '#1A1A25',
  border: '#252535',
  borderLight: '#1E1E2A',
  textPrimary: '#E8E8F0',
  textSecondary: '#8888A0',
  textMuted: '#555568',

  // Accents (kept consistent across themes)
  agree: '#00FF88',
  disagree: '#FF0040',
  important: '#FFB800',
  bridge: '#00D4FF',
  share: '#BF5AF2',

  badgeLocal: '#555568',
  badgeReaching: '#00D4FF',
  badgeBridging: '#00FF88',
  badgeCommonGround: '#FFB800',

  clusters: {
    pragmatic_center: '#8888A0',
    community_focused: '#4F6EFF',
    tradition_minded: '#C4622D',
    reform_oriented: '#00FF88',
    liberty_focused: '#FFB800',
    unclassified: '#555568',
  },

  error: '#FF0040',
  warning: '#FFB800',
  success: '#00FF88',
  info: '#00D4FF',
};

const light = {
  // Brand (same)
  brandIvory: '#F0EEE8',
  brandGold: '#E8C97A',
  brandDark: '#0A0A0F',

  // Primary — slightly deeper for contrast against light surfaces
  primary: '#3B5AE8',
  primaryDark: '#2A45C7',
  primaryLight: '#7B93FF',
  primaryFaint: 'rgba(59, 90, 232, 0.10)',

  // Light surfaces
  background: '#FAFAFC',
  surface: '#FFFFFF',
  surfaceLight: '#F2F2F7',
  border: '#D8D8E0',
  borderLight: '#E8E8EE',
  textPrimary: '#0A0A0F',
  textSecondary: '#4A4A5A',
  textMuted: '#888897',

  // Accents — same identity but slightly less neon for light mode
  agree: '#00B864',
  disagree: '#E03050',
  important: '#D49000',
  bridge: '#0099C8',
  share: '#9942C7',

  badgeLocal: '#888897',
  badgeReaching: '#0099C8',
  badgeBridging: '#00B864',
  badgeCommonGround: '#D49000',

  clusters: {
    pragmatic_center: '#888897',
    community_focused: '#3B5AE8',
    tradition_minded: '#C4622D',
    reform_oriented: '#00B864',
    liberty_focused: '#D49000',
    unclassified: '#888897',
  },

  error: '#E03050',
  warning: '#D49000',
  success: '#00B864',
  info: '#0099C8',
};

let _mode: ThemeMode = 'dark';

export function setColorMode(mode: ThemeMode) {
  _mode = mode;
  Object.assign(Colors, mode === 'dark' ? dark : light);
}
export function getColorMode(): ThemeMode { return _mode; }

// Mutable export — root layout's `key={themeMode}` forces re-render so
// every component re-reads these values when the theme changes.
export const Colors = { ...dark } as typeof dark;
