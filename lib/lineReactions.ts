/**
 * lineReactions. The reaction palette.
 *
 * A reaction on this platform is a real Shakespeare line fired at a
 * post. This module turns data/bard-insults.json into two things:
 *
 *   1. A pickable palette (safe tier, the same default the insults
 *      room opens on).
 *   2. A stable ref for every line in the whole corpus, so a reaction
 *      stored months ago still resolves to text, speaker, and play.
 *
 * The corpus carries no id field, so the ref is derived: play slug,
 * act.scene citation, and a short FNV-1a hash of the line text. Stable
 * across reordering of the file. Changes only if the quoted text
 * itself changes, which is the correct behaviour since a changed line
 * is a different line.
 *
 * Read-only over the corpus. This file never writes to it.
 *
 * NO COUNTS. Nothing here tallies anything.
 */

import raw from '../data/bard-insults.json';
import { permittedByTier, type Tier, type TrueLine } from './insultEngine';

const data = raw as any;
const ALL_LINES: TrueLine[] = data.lines ?? [];

/** reaction_type prefix. Mirrors the check constraint in migration 060. */
export const LINE_PREFIX = 'line:';

/** Tier the picker draws from. Matches the insults room default. */
const PALETTE_TIER: Tier = 'safe';

export interface PaletteLine {
  /** Stable identifier stored in post_reactions.line_ref. */
  ref: string;
  /** reaction_type value, 'line:<category>'. */
  key: string;
  text: string;
  speaker: string;
  target?: string;
  play: string;
  citation?: string;
  category: string;
}

/** FNV-1a, base36. Short, deterministic, no dependency. */
function hash32(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Derived, stable, and short enough for the 120-char column check. */
export function lineRef(line: { play: string; citation?: string; text: string }): string {
  return `${slug(line.play)}.${line.citation ?? 'na'}.${hash32(line.text)}`;
}

export function reactionKeyFor(category: string | undefined): string {
  return `${LINE_PREFIX}${category ?? 'objectMetaphor'}`;
}

function toPalette(line: TrueLine): PaletteLine {
  return {
    ref: lineRef(line as any),
    key: reactionKeyFor(line.category),
    text: line.text,
    speaker: line.speaker,
    target: line.target,
    play: line.play,
    citation: line.citation,
    category: line.category ?? 'objectMetaphor',
  };
}

/** Every line in the corpus, keyed by ref. Resolution ignores tier so a
 *  reaction fired under any policy still renders its attribution. */
const BY_REF: Map<string, PaletteLine> = (() => {
  const m = new Map<string, PaletteLine>();
  for (const l of ALL_LINES) {
    const p = toPalette(l);
    if (!m.has(p.ref)) m.set(p.ref, p);
  }
  return m;
})();

/** What the picker offers. */
export const PALETTE: PaletteLine[] = ALL_LINES
  .filter((l) => permittedByTier(l, PALETTE_TIER))
  .map(toPalette);

/** Null when the ref is unknown, e.g. a line whose text was revised
 *  after someone fired it. Callers render nothing rather than crash. */
export function resolveLineRef(ref: string | null | undefined): PaletteLine | null {
  if (!ref) return null;
  return BY_REF.get(ref) ?? null;
}

/** Draw n lines at random, skipping refs already on the post. */
export function drawLines(n: number, exclude: Set<string> = new Set()): PaletteLine[] {
  const pool = PALETTE.filter((l) => !exclude.has(l.ref));
  const source = pool.length >= n ? pool : PALETTE;
  const picked: PaletteLine[] = [];
  const taken = new Set<number>();
  const cap = Math.min(n, source.length);
  let guard = 0;
  while (picked.length < cap && guard++ < 500) {
    const i = Math.floor(Math.random() * source.length);
    if (taken.has(i)) continue;
    taken.add(i);
    picked.push(source[i]);
  }
  return picked;
}

/** Attribution slug for display: "Hamlet · Hamlet 3.1". */
export function attribution(line: PaletteLine): string {
  const cite = line.citation ? ` ${line.citation}` : '';
  return `${line.speaker} · ${line.play}${cite}`;
}
