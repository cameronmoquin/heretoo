/**
 * Theme palettes — dark + light.
 *
 * Source of Truth, Milestone 10. Aligned to the codex: warm dark
 * canvas with deep gold accent and warm ivory text. Less Silicon
 * Valley dashboard, more candlelit reading lamp.
 *
 * Components import `Colors` and use it as a static; the value gets
 * reassigned when the user toggles theme. The root layout uses
 * `key={themeMode}` to force a full re-render so every component
 * picks up the new palette values.
 */

export type ThemeMode = 'dark' | 'light';

export const dark = {
  // Brand
  brandIvory: '#F4F1E8',
  brandGold: '#C9A14B',
  brandDark: '#0A0A0F',

  // Primary — deep gold per the codex. Used for hearts, primary
  // buttons, and the active-pattern accent. Replaces the previous
  // indigo-blue, which read like every other SaaS dashboard.
  primary: '#C9A14B',
  primaryDark: '#A38336',
  primaryLight: '#DDB868',
  primaryFaint: 'rgba(201, 161, 75, 0.14)',
  // Ink that reads on a primary-gold fill. White on #C9A14B is ~1.9:1 and
  // fails WCAG. Dark ink clears it. Buttons and chips use this, never #FFF.
  onPrimary: '#16161D',

  // Surfaces — warm dark, candlelit. The canvas is near-black with
  // a slight warmth (#0A0A0F per the codex). Cards lift onto a
  // graphite-warm surface so type sits on a discernible plane.
  background: '#0A0A0F',          // main canvas — warm near-black
  surface: '#16161D',              // primary cards — subtle warm lift
  surfaceLight: '#22222B',         // raised / hovered surfaces
  border: '#2D2D38',               // hairline that reads on dark
  borderLight: '#1F1F28',
  textPrimary: '#F4F1E8',          // warm ivory, not crisp white
  textSecondary: '#B8B2A4',        // warm muted
  textMuted: '#7A7568',            // warm gray-ochre

  // Accents — kept warm and a little less saturated.
  agree: '#5BC289',
  disagree: '#C73E3A',
  important: '#D4A04A',
  bridge: '#5DA3C9',
  share: '#A47BC9',

  badgeLocal: '#3D3D45',
  badgeReaching: '#5DA3C9',
  badgeBridging: '#5BC289',
  badgeCommonGround: '#D4A04A',

  clusters: {
    pragmatic_center: '#7A7568',
    community_focused: '#5DA3C9',
    tradition_minded: '#C4622D',
    reform_oriented: '#5BC289',
    liberty_focused: '#D4A04A',
    unclassified: '#3D3D45',
  },

  // Heart red — only for the heart fill. Distinct from `error`.
  heart: '#C73E3A',

  // Alarm states — warm-tinted so they don't feel cold next to gold.
  error: '#C73E3A',
  warning: '#D4A04A',
  success: '#5BC289',
  info: '#5DA3C9',
};

export const light = {
  // Brand (same)
  brandIvory: '#F4F1E8',
  brandGold: '#9A7A2E',
  brandDark: '#1A1815',

  // Primary — deeper gold so it carries weight on the warm parchment
  // canvas. Same identity family as the dark theme.
  primary: '#9A7A2E',
  primaryDark: '#7C611F',
  primaryLight: '#B79447',
  primaryFaint: 'rgba(154, 122, 46, 0.10)',
  // The light primary is a deeper brown-gold; white clears contrast on it.
  onPrimary: '#FFFFFF',

  // Light surfaces — warm parchment instead of cool near-white. The
  // canvas is the brand ivory; cards sit on a slightly brighter
  // surface so they read as paper on a desk.
  background: '#F4F1E8',           // canvas — warm parchment
  surface: '#FBF8F0',              // cards — brighter paper
  surfaceLight: '#EDE9DE',         // recessed wells, hovered surfaces
  border: '#D9D2C0',               // warm hairline
  borderLight: '#E5DFCE',
  textPrimary: '#1A1815',          // warm ink
  textSecondary: '#5C574E',        // warm muted
  textMuted: '#8A8377',            // warm gray-ochre

  agree: '#3F8F5E',
  disagree: '#A8302C',
  important: '#A07429',
  bridge: '#3D7A9F',
  share: '#7A4FA0',

  badgeLocal: '#A8A294',
  badgeReaching: '#3D7A9F',
  badgeBridging: '#3F8F5E',
  badgeCommonGround: '#A07429',

  clusters: {
    pragmatic_center: '#8A8377',
    community_focused: '#3D7A9F',
    tradition_minded: '#A04F1F',
    reform_oriented: '#3F8F5E',
    liberty_focused: '#A07429',
    unclassified: '#8A8377',
  },

  // Heart red — slightly deeper so it lands on warm parchment.
  heart: '#A8302C',

  error: '#A8302C',
  warning: '#A07429',
  success: '#3F8F5E',
  info: '#3D7A9F',
};

let _mode: ThemeMode = 'dark';

export function setColorMode(mode: ThemeMode) {
  _mode = mode;
  Object.assign(Colors, mode === 'dark' ? dark : light);
}
export function getColorMode(): ThemeMode { return _mode; }

// Mutable export — root layout's `key={themeMode}` forces re-render so
// every component re-reads these values when the theme changes.
// Default = dark. Light is opt-in (the spec calls dark the default).
export const Colors = { ...dark } as typeof dark;
