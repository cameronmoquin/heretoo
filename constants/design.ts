/**
 * Design system tokens.
 *
 * Source of truth: docs/UI_SYSTEM.md §3 and §4. One family, seven type
 * steps, three radii, no elevation. The whole app reaches into this file
 * rather than picking sizes at the call site.
 *
 * ALIAS KEYS. Retired token names are kept and pointed at their nearest
 * new value so existing imports resolve. A later cleanup deletes them.
 * Do not add new reads of an alias key.
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

/**
 * The column. One centered feed, nothing wider. Screens currently
 * hardcode 720 / 600; the screen sweep points them here.
 */
export const Layout = {
  columnMaxWidth: 640,
  columnPadding: 16,
  rowPaddingVertical: 16,
  rowPaddingHorizontal: 16,
} as const;

/**
 * Three radii. Rows are square, because there are no cards.
 *   media   12  photos, video, attachments
 *   control  8  buttons, inputs, sheets
 *   pill    999 avatars and chips only
 */
export const Radius = {
  media: 12,
  control: 8,
  pill: 999,

  // Aliases. xs/sm collapse to control, card/md/lg collapse to media,
  // full collapses to pill.
  xs: 8,
  sm: 8,
  card: 12,
  md: 12,
  lg: 12,
  full: 999,
} as const;

/**
 * Typography. One family: Inter. Syne and Source Serif 4 are gone.
 * Line-height is paired so vertical rhythm is automatic. Seven steps
 * cover the product; if a screen wants an eighth, it is wrong.
 */
export const Type = {
  // Rare. Auth masthead.
  hero:      { size: 28, lineHeight: 34, weight: '700' as const, letterSpacing: 0 },
  // Page titles ("For you").
  display:   { size: 24, lineHeight: 30, weight: '700' as const, letterSpacing: 0 },
  // Section heads.
  title:     { size: 20, lineHeight: 26, weight: '600' as const, letterSpacing: 0 },
  // Author name.
  cardTitle: { size: 15, lineHeight: 20, weight: '600' as const, letterSpacing: 0 },
  // Post body, reading text.
  body:      { size: 15, lineHeight: 21, weight: '400' as const, letterSpacing: 0 },
  // Buttons, labels.
  ui:        { size: 14, lineHeight: 19, weight: '500' as const, letterSpacing: 0 },
  // Timestamps, counts.
  caption:   { size: 13, lineHeight: 18, weight: '400' as const, letterSpacing: 0 },

  // Aliases. bodyBold and uiBold are the same metrics at 600.
  bodyBold:  { size: 15, lineHeight: 21, weight: '600' as const, letterSpacing: 0 },
  uiBold:    { size: 14, lineHeight: 19, weight: '600' as const, letterSpacing: 0 },
  // eyebrow is retired. It maps onto caption, and the tracking is gone,
  // so a call site that still spreads it stops looking like a kicker.
  // Call sites keep their own textTransform until the sweep removes it.
  eyebrow:   { size: 13, lineHeight: 18, weight: '400' as const, letterSpacing: 0 },
} as const;

/**
 * Standard interactive sizes so visual weight stays consistent across
 * primary CTAs, ghost buttons, pills.
 */
export const Heights = {
  pill: 32,
  button: 40,
  buttonLg: 48,
  input: 44,
  bottomNav: 56,
  topHeader: 52,
  // The minimum comfortable tap target. Interactive controls floor here.
  touchTarget: 44,
} as const;

/**
 * Elevation: none. Separation is a hairline, never a shadow.
 *
 * sm / md / lg are kept as empty objects so every existing spread still
 * resolves and quietly contributes nothing. The one exception in the
 * system is the floating compose button, which uses `float`.
 */
export const Shadow = {
  sm: {},
  md: {},
  lg: {},
  // The only shadow in the product. Floating compose button, nothing else.
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

/**
 * Common animation timings. Same easing across the app for muscle memory.
 */
export const Motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
