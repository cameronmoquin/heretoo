import { Platform } from 'react-native';

/**
 * Design system tokens.
 *
 * The whole app reaches into this file rather than picking ad-hoc
 * sizes / weights at the call site. Keeps visual rhythm consistent.
 *
 * Scale rationale (Type / Spacing / Radius all snap to similar steps):
 *   - 4 / 8 / 12 / 16 / 24 / 32 / 48      spacing
 *   - 11 / 12 / 13 / 14 / 16 / 20 / 28    type
 *   - 6 / 10 / 14 / 18 / 999              radius
 *
 * Pattern: small numbers tighten interior padding; bigger numbers
 * cut the page into clear regions.
 */

export const Spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  xs: 6,
  sm: 10,
  md: 16,   // was 14 — slightly more generous, reads as polished SaaS
  lg: 20,   // was 18
  full: 999,
} as const;

/**
 * Typography tokens. We avoid loose numbers like "fontSize: 13.5" or
 * mid-step sizes — every label / body / caption should pick from this
 * set. Line-height is paired so vertical rhythm is automatic.
 */
export const Type = {
  // Display / hero — used sparingly (auth screens, big empty states).
  // Heavy display weight + tight tracking reads as confident editorial.
  display:  { size: 28, lineHeight: 34, weight: '700' as const, letterSpacing: -0.5 },

  // Section / page titles. Dropped from 700→600 + tightened tracking
  // so titles feel elegant rather than chunky-bold.
  title:    { size: 20, lineHeight: 26, weight: '600' as const, letterSpacing: -0.3 },

  // Card heads, post bodies, primary content. Bumped lineHeight 22→24
  // for more comfortable long-read.
  body:     { size: 16, lineHeight: 24, weight: '400' as const, letterSpacing: 0 },
  bodyBold: { size: 16, lineHeight: 24, weight: '600' as const, letterSpacing: 0 },

  // UI text, default for buttons / inputs / metadata
  ui:       { size: 14, lineHeight: 19, weight: '500' as const, letterSpacing: 0 },
  uiBold:   { size: 14, lineHeight: 19, weight: '700' as const, letterSpacing: 0 },

  // Captions, helpers, microcopy
  caption:  { size: 12, lineHeight: 16, weight: '500' as const, letterSpacing: 0 },

  // Eyebrow / SECTION / pill labels — the small uppercase markers
  eyebrow:  { size: 11, lineHeight: 14, weight: '700' as const, letterSpacing: 1.4 },
} as const;

/**
 * Standard interactive sizes for button & input heights, so visual
 * weight stays consistent across primary CTAs, ghost buttons, pills.
 */
export const Heights = {
  pill: 32,
  button: 40,
  buttonLg: 48,
  input: 44,
  bottomNav: 56,
  topHeader: 52,
} as const;

export const Shadow = {
  // Subtle resting card lift — flat enough for a dark theme.
  // Two-layer web shadow gives crisp edge + soft ambient (Linear-style).
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: { elevation: 1 },
    web: { boxShadow: '0 1px 2px rgba(15,15,25,0.04), 0 2px 6px rgba(15,15,25,0.05)' },
    default: {},
  }),
  // Hovered / focused card.
  md: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.10,
      shadowRadius: 12,
    },
    android: { elevation: 4 },
    web: { boxShadow: '0 4px 12px rgba(0,0,0,0.10)' },
    default: {},
  }),
  // Modals / dropdowns / popovers.
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
    },
    android: { elevation: 10 },
    web: { boxShadow: '0 8px 24px rgba(0,0,0,0.18)' },
    default: {},
  }),
} as const;

/**
 * Common animation timings — same easing across the app for muscle memory.
 */
export const Motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
