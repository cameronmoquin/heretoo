/**
 * COMPATIBILITY SHIM. SCHEDULED FOR REMOVAL.
 *
 * The generation skin engine is retired. See docs/UI_SYSTEM.md §1. There
 * is one appearance now: no cohort palettes, no personality tokens, no
 * glitch, no scanlines. Alpha, Y2K, VHS, xerox zine, letterpress: gone.
 *
 * This module survives only so the ~22 files that still read `Gen.*`
 * compile while the reference sweep runs in a parallel lane. Every value
 * below is fixed and no longer varies. `setGeneration` is a no-op.
 *
 * Do not add a new read of `Gen`. When the sweep lands, delete this file.
 */

import { Radius } from './design';

/** One family. Inter, loaded in app/_layout.tsx, with a system fallback. */
const INTER = '"Inter", system-ui, sans-serif';

/**
 * The shape the remaining call sites expect. Kept whole so a file that
 * touches an unused key still type-checks.
 */
export interface GenTokens {
  id: Generation;
  label: string;
  tagline: string;
  displayFont: string;
  bodyFont: string;
  displayTransform: 'none' | 'uppercase';
  displayLetterSpacing: number;
  dark: boolean;
  radius: number;
  glitch: boolean;
  scanlines: boolean;
  copy: 'hype' | 'casual' | 'plain' | 'warm';
}

/** There is one. */
export type Generation = 'default';

/**
 * Fixed tokens. Still a mutable object so the old import shape holds,
 * but nothing mutates it any more.
 */
export const Gen: GenTokens = {
  id: 'default',
  label: 'HereToo',
  tagline: '',
  displayFont: INTER,
  bodyFont: INTER,
  displayTransform: 'none',
  displayLetterSpacing: 0,
  // The canvas is painted by the root layout from Colors.background,
  // in whichever mode the viewer picked. Nothing branches on this.
  dark: false,
  radius: Radius.control,
  glitch: false,
  scanlines: false,
  copy: 'plain',
};

/** No-op. Kept so existing call sites resolve. */
export function setGeneration(_g?: unknown): void {}

/** No-op. Kept so existing call sites resolve. */
export function getGeneration(): Generation { return 'default'; }
