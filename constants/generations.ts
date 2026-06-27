/**
 * Generation themes — the app's look-and-feel toggled by cohort.
 *
 * Generation is the PRIMARY theme axis. Each generation owns a full
 * colour palette plus a set of non-colour "personality" tokens (display
 * font, corner radius, signature effects like glitch/scanlines) that a
 * palette alone can't carry.
 *
 * It reuses the exact mechanism `colors.ts` uses for dark/light:
 *   - `setGeneration(g)` does `Object.assign(Colors, palette)` so EVERY
 *     existing component that reads `Colors` recolours for free, and
 *     `Object.assign(Gen, tokens)` so personality tokens swap too.
 *   - The root layout keys its remount on the generation so the whole
 *     tree re-reads the mutated objects.
 *
 * Palettes are built as `{ ...base, ...overrides }` over the shipped
 * light/dark palettes, so every colour key is always present even if a
 * generation only overrides a few.
 *
 * Phase 1 realises Gen Alpha (retro digital glitch) fully and gives the
 * other four solid starter palettes; each gets its full treatment in
 * its own turn. Boomer == today's warm look, so existing users see no
 * change until they opt into another skin.
 */

import { Colors, dark, light } from './colors';

export type Generation = 'alpha' | 'genz' | 'millennial' | 'genx' | 'boomer';

export const GENERATION_ORDER: Generation[] = [
  'alpha', 'genz', 'millennial', 'genx', 'boomer',
];

type Palette = typeof light;

/** Non-colour personality tokens. Components import `Gen` to reach
 *  these the same way they import `Colors`. */
export interface GenTokens {
  id: Generation;
  label: string;
  tagline: string;
  /** Web font-family stack for headlines / masthead / display text. */
  displayFont: string;
  /** Web font-family stack for body copy. */
  bodyFont: string;
  displayTransform: 'none' | 'uppercase';
  displayLetterSpacing: number;
  /** Base corner radius the generation prefers (px). Sharp = retro/edgy. */
  radius: number;
  /** Signature effects (web-only flourishes; native falls back clean). */
  glitch: boolean;
  scanlines: boolean;
  /** Microcopy register hint for future copy swaps. */
  copy: 'hype' | 'casual' | 'plain' | 'warm';
}

// ── Font stacks ──────────────────────────────────────────────────────
// Only system / already-loaded faces so nothing depends on new font
// infra. Inter + Syne + Source Serif 4 are loaded in app/_layout.tsx.
const MONO = '"Cascadia Code", ui-monospace, "SFMono-Regular", "Consolas", monospace';
const INTER = '"Inter", system-ui, sans-serif';
const SYNE = '"Syne", "Inter", sans-serif';
const SERIF = '"Source Serif 4", Georgia, serif';

// ── Palettes ─────────────────────────────────────────────────────────

// Gen Alpha — retro digital glitch. Deep CRT blue-black, neon cyan +
// hot magenta, acid-green "agree". The most distinct skin.
const alphaPalette: Palette = {
  ...dark,
  brandIvory: '#EAF6FF',
  brandGold: '#FF2E97',
  brandDark: '#05040A',
  primary: '#2DE2E6',
  primaryDark: '#16B6BC',
  primaryLight: '#7BF1F3',
  primaryFaint: 'rgba(45, 226, 230, 0.14)',
  background: '#07060E',
  surface: '#120E22',
  surfaceLight: '#1B1536',
  border: '#3A2E66',
  borderLight: '#241C44',
  textPrimary: '#EAF6FF',
  textSecondary: '#A9B4D9',
  textMuted: '#6E76A8',
  agree: '#B6FF3B',
  disagree: '#FF2E55',
  important: '#FFD23B',
  bridge: '#2DE2E6',
  share: '#B06BFF',
  heart: '#FF2E97',
  error: '#FF2E55',
  warning: '#FFD23B',
  success: '#B6FF3B',
  info: '#2DE2E6',
};

// Gen Z — soft-grunge / Y2K pastel-on-dark. Starter palette; fully
// styled in its turn.
const genzPalette: Palette = {
  ...dark,
  primary: '#A78BFA',
  primaryDark: '#7C5CDC',
  primaryLight: '#C4B5FD',
  primaryFaint: 'rgba(167, 139, 250, 0.14)',
  background: '#0E0B14',
  surface: '#181222',
  surfaceLight: '#221A33',
  border: '#332A45',
  textPrimary: '#F3EEFF',
  heart: '#FB7185',
  info: '#38BDF8',
};

// Millennial — clean modern light (the "Instagram era" flat-bright).
const millennialPalette: Palette = {
  ...light,
  primary: '#3B5AE8',
  primaryDark: '#2E47C4',
  primaryLight: '#6D85FF',
  primaryFaint: 'rgba(59, 90, 232, 0.10)',
  background: '#F7F8FB',
  surface: '#FFFFFF',
  surfaceLight: '#EEF1F7',
  border: '#DDE2EC',
  textPrimary: '#13151B',
  textSecondary: '#4A5163',
};

// Gen X — muted analog / grunge-neutral.
const genxPalette: Palette = {
  ...dark,
  primary: '#C2603F',
  primaryDark: '#9C4A2E',
  primaryLight: '#D98A6E',
  primaryFaint: 'rgba(194, 96, 63, 0.12)',
  background: '#16140F',
  surface: '#211D16',
  surfaceLight: '#2C271D',
  border: '#3A3326',
  textPrimary: '#EDE6D6',
  textSecondary: '#A89C84',
};

// Boomer — today's warm parchment, unchanged. The calm default.
const boomerPalette: Palette = { ...light };

// ── Theme table ──────────────────────────────────────────────────────

export interface GenerationTheme {
  palette: Palette;
  tokens: GenTokens;
}

export const GENERATIONS: Record<Generation, GenerationTheme> = {
  alpha: {
    palette: alphaPalette,
    tokens: {
      id: 'alpha', label: 'Gen Alpha', tagline: 'retro digital glitch',
      displayFont: MONO, bodyFont: INTER,
      displayTransform: 'uppercase', displayLetterSpacing: 1.5,
      radius: 2, glitch: true, scanlines: true, copy: 'hype',
    },
  },
  genz: {
    palette: genzPalette,
    tokens: {
      id: 'genz', label: 'Gen Z', tagline: 'soft grunge',
      displayFont: SYNE, bodyFont: INTER,
      displayTransform: 'none', displayLetterSpacing: 0.2,
      radius: 18, glitch: false, scanlines: false, copy: 'casual',
    },
  },
  millennial: {
    palette: millennialPalette,
    tokens: {
      id: 'millennial', label: 'Millennial', tagline: 'clean & bright',
      displayFont: SYNE, bodyFont: INTER,
      displayTransform: 'none', displayLetterSpacing: 0.2,
      radius: 12, glitch: false, scanlines: false, copy: 'plain',
    },
  },
  genx: {
    palette: genxPalette,
    tokens: {
      id: 'genx', label: 'Gen X', tagline: 'analog & muted',
      displayFont: INTER, bodyFont: INTER,
      displayTransform: 'none', displayLetterSpacing: 0.4,
      radius: 8, glitch: false, scanlines: false, copy: 'plain',
    },
  },
  boomer: {
    palette: boomerPalette,
    tokens: {
      id: 'boomer', label: 'Boomer', tagline: 'warm & calm',
      displayFont: SYNE, bodyFont: SERIF,
      displayTransform: 'none', displayLetterSpacing: 0.2,
      radius: 14, glitch: false, scanlines: false, copy: 'warm',
    },
  },
};

// ── Mutable token export + swap ──────────────────────────────────────

/** Mutable personality tokens — mirrors the `Colors` pattern. Default
 *  = boomer (today's look). */
export const Gen: GenTokens = { ...GENERATIONS.boomer.tokens };

let _generation: Generation = 'boomer';

export function setGeneration(g: Generation) {
  const theme = GENERATIONS[g] ?? GENERATIONS.boomer;
  _generation = theme.tokens.id;
  Object.assign(Colors, theme.palette);
  Object.assign(Gen, theme.tokens);
}

export function getGeneration(): Generation { return _generation; }
