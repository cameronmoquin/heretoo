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

  // Primary — refined indigo-blue. Slightly less saturated than the
  // original electric tone for a more grown-up feel.
  primary: '#5B7CFF',
  primaryDark: '#4361E5',
  primaryLight: '#8AA1FF',
  primaryFaint: 'rgba(91, 124, 255, 0.10)',

  // Surfaces — significantly lifted into true graphite so dark mode
  // reads as polished SaaS (think Linear / GitHub Dark / Vercel) rather
  // than moody-dark. The previous palette stayed close to black; this
  // one centers on a slate/charcoal where text + media actually sit on
  // a discernible surface instead of disappearing into the void.
  background: '#2A2A36',     // main canvas — true graphite, not near-black
  surface: '#34343F',        // primary cards — clear lift off background
  surfaceLight: '#3F3F4D',   // raised / hovered surfaces
  border: '#4A4A5A',         // visible but soft hairline
  borderLight: '#3D3D4D',
  textPrimary: '#F4F4F8',    // crisp white-ish, not warm
  textSecondary: '#B4B4C8',  // hierarchy still clear on the lifted bg
  textMuted: '#84849A',

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

  // Alarm states — softened from neon to readable. Pure #FF0040 / #00FF88
  // worked on dev splash screens but felt amateurish in real UI.
  error: '#F26C7B',
  warning: '#E8B964',
  success: '#67D9A6',
  info: '#67BBE8',
};

const light = {
  // Brand (same)
  brandIvory: '#F0EEE8',
  brandGold: '#E8C97A',
  brandDark: '#0A0A0F',

  // Primary — matches dark-mode primary family for brand consistency,
  // but slightly deeper so it carries enough weight on near-white surfaces.
  primary: '#4A6CF0',
  primaryDark: '#3552D4',
  primaryLight: '#7B93FF',
  primaryFaint: 'rgba(74, 108, 240, 0.08)',

  // Light surfaces — clean near-white with hairline tonal separation
  // between layers. The previous palette read as muddy paper; the new
  // one reads as Linear / Notion-light: bright, calm, professional.
  // Cards are pure white, raised cards lift with shadow rather than tone.
  background: '#F6F6F9',     // was #EAE9EE — main canvas, near-white
  surface: '#FFFFFF',        // was #F4F3F7 — cards pop on bg
  surfaceLight: '#F1F1F5',   // was #E1E0E6 — recessed wells / hovered
  border: '#E4E4EB',         // was #C8C7D0 — much softer hairlines
  borderLight: '#EFEFF4',    // was #D8D7DE
  textPrimary: '#1A1A24',
  textSecondary: '#5A5A6E', // was #54546A — slightly cooler for hierarchy
  textMuted: '#8A8A9A',     // was #80808F

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

  // Alarm states — slightly desaturated for readability on light bg.
  error: '#D14760',
  warning: '#B7841F',
  success: '#2C9970',
  info: '#3D8AB8',
};

let _mode: ThemeMode = 'light';

export function setColorMode(mode: ThemeMode) {
  _mode = mode;
  Object.assign(Colors, mode === 'dark' ? dark : light);
}
export function getColorMode(): ThemeMode { return _mode; }

// Mutable export — root layout's `key={themeMode}` forces re-render so
// every component re-reads these values when the theme changes.
export const Colors = { ...light } as typeof dark;
