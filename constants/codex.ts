/**
 * Aesthetic codex — Source of Truth, Milestone 10.
 *
 * Canonical values for type, motion, voice, and brand-mark usage. The
 * codex is the moat: anyone can copy a feature, no one will copy a
 * year of taste. Every future contributor (including future-you on a
 * Saturday at 11pm) ships work that lives inside the same room by
 * importing from this file.
 *
 * Refusal list (M10):
 *   - No emoji in UI chrome.
 *   - No gradient logos.
 *   - No drop shadows on cards (use 1px hairline borders at low alpha).
 *   - No gamification iconography (badges, streaks, fire emoji equivalents).
 *   - No "Powered by" footers from third-party libraries.
 */

// ── Type ─────────────────────────────────────────────────────────────
// Web font-family strings; native picks the closest available system
// fallback. The display face is Syne for masthead and brand mark; body
// is Inter; long-form (Letters, Reframer drawer, parlor essays) is
// Source Serif 4.

export const Fonts = {
  display: '"Syne", "Inter", system-ui, sans-serif',
  body: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  letter: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
  mono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const TypeScale = {
  // Display / masthead — Syne 800
  display: { fontSize: 36, lineHeight: 44, fontWeight: '800' as const, letterSpacing: -0.6, fontFamily: Fonts.display },
  // Section title — Syne 600
  title: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const, letterSpacing: -0.3, fontFamily: Fonts.display },
  // Body — Inter 400, 16/17px (mobile bumps to 17 per Apple HIG)
  bodyDesktop: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, fontFamily: Fonts.body },
  bodyMobile: { fontSize: 17, lineHeight: 25, fontWeight: '400' as const, fontFamily: Fonts.body },
  // Caption — Inter 500, smaller, muted
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const, fontFamily: Fonts.body },
  // Kicker — uppercase eyebrow over headlines
  kicker: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 1.6, fontFamily: Fonts.body },
  // Letter body — Source Serif 4, 18/19px
  letterDesktop: { fontSize: 18, lineHeight: 28, fontWeight: '400' as const, fontFamily: Fonts.letter },
  letterMobile: { fontSize: 19, lineHeight: 30, fontWeight: '400' as const, fontFamily: Fonts.letter },
} as const;

// ── Motion ───────────────────────────────────────────────────────────
// Default: decelerated cubic-bezier, never bouncy. Springs and bounces
// are explicitly forbidden by the spec.

export const Motion = {
  ease: 'cubic-bezier(0.2, 0.0, 0, 1)',
  duration: {
    ui: 200,         // most UI transitions
    roomSwitch: 400, // family swatch swap, page-turn feel
    letterOpen: 600, // long-form reader entrance
  },
  // Heart fills with a single 150ms ease — no bounce.
  heartFill: 150,
} as const;

// ── Voice (Bike Messenger) ──────────────────────────────────────────
// Calibration parameters per Source of Truth, M10. The TTS function
// reads these to keep ElevenLabs settings consistent across runs.
// "A calm friend reading you a letter" — not a podcast voice.

export const VoiceSettings = {
  voiceId: '8Nfp0JhQpkjJB35HObeq', // Bike Messenger
  modelId: 'eleven_turbo_v2_5',
  stability: 0.62,
  similarityBoost: 0.78,
  style: 0.18,                 // low — natural, not theatrical
  speakerBoost: true,
  defaultSpeakingRate: 1.0,
} as const;

// ── Avatars ─────────────────────────────────────────────────────────
// Square with 16px border-radius. No circles. Sizes match the spec.

export const Avatar = {
  borderRadius: 16,
  size: {
    feed: 48,
    profile: 96,
    roomHearth: 128,
  },
  borderAlpha: {
    onDark: 'rgba(244, 241, 232, 0.08)',
    onLight: 'rgba(26, 24, 21, 0.12)',
  },
} as const;

// ── Empty + error state copy ────────────────────────────────────────
// Two-sentence calm prose. Never apology. Never "Oops." The platform
// is never sorry it has nothing to show. Helpers for consistent tone
// across surfaces that haven't been audited yet.

export const Copy = {
  /** A two-sentence empty state. First sentence: plain observation.
   *  Second: optional subdued action sentence. */
  empty: (observation: string, action?: string) =>
    action ? `${observation} ${action}` : observation,
  /** A plain-language error that names the next move. Never "Error 500"
   *  exposed to users; never "Something went wrong" alone. */
  error: (problem: string, nextMove: string) => `${problem} ${nextMove}`,
} as const;

// ── Brand-mark spec ─────────────────────────────────────────────────
// Canonical sizes for asset generation. The /og endpoint and any
// future asset script reads these.

export const BrandMark = {
  faviconPng: { width: 32, height: 32 },
  pwaIcon: { width: 1024, height: 1024 },
  ogImage: { width: 1200, height: 630, headline: 'HereToo — the room your family lives in' },
  emailHeader: { width: 600, height: 100 },
} as const;

// ── Iconography ─────────────────────────────────────────────────────
// The codex calls for Lucide single-weight (1.5px stroke). Today's
// codebase uses Ionicons; this constant documents the migration target
// without forcing a global rename in this milestone.

export const IconSpec = {
  strokeWidth: 1.5,
  noFills: true,
  noAnimations: true,
  preferredSet: 'lucide',     // current: ionicons; migration is a follow-up
} as const;
