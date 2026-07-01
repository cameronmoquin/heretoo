/**
 * insultEngine — pure, framework-agnostic generator for the
 * Shakespearean Insults module. No DOM, no React.
 *
 * Everything is driven by data/bard-insults.json: the term pools, the
 * tier flag-allowlists (meta.tiers), and the meter templates
 * (meta.meterModes). Tier membership and scansion are NEVER hardcoded
 * here — reassigning a flag or editing a template is a data edit.
 *
 * RNG is injectable so a (tier, seed) pair is deterministic in tests.
 */

import raw from '../data/bard-insults.json';

// ── Types ────────────────────────────────────────────────────────────

export type Tier = 'safe' | 'edgy' | 'full';
export type Meter = 'any' | 'iambicPentameter' | 'trochaicTetrameter';
export type Ending = 'any' | 'masculine' | 'feminine';

export interface LexItem {
  term: string;
  play: string;
  citation?: string;
  speaker?: string;
  flags: string[];
  syllables?: number;
  meter?: string;
  meterResolved?: boolean;
}

export interface TrueLine {
  text: string;
  speaker: string;
  target?: string;
  play: string;
  citation?: string;
  category?: string;
  gloss?: string;
  flags: string[];
}

export interface ForgePart { term: string; play: string; }
export interface ForgeResult {
  text: string;
  parts: ForgePart[];
  /** false when a meter was requested but no candidate scanned within the cap. */
  scanned: boolean;
}

export interface ForgeOpts {
  meter?: Meter;
  ending?: Ending;
  /** iambic only: exact alternation vs. authentic substitutions. */
  strict?: boolean;
}

export interface Epigraph { text: string; speaker: string; play: string; }

// ── Data access ──────────────────────────────────────────────────────

const data = raw as any;
const meta = data.meta;
const adjectives: LexItem[] = data.lexicon.adjectives;
const nouns: LexItem[] = data.lexicon.nouns;
const diminutives: LexItem[] = data.lexicon.diminutives;
const lines: TrueLine[] = data.lines;

/** allowedFlags for a tier, read from the data (not baked in). */
function allowedFlags(tier: Tier): string[] {
  return meta.tiers?.[tier]?.allowedFlags ?? [];
}

/** An item is permitted in a tier when every flag it carries is allowed.
 *  No-flag items are always permitted. */
export function permittedByTier(item: { flags?: string[] }, tier: Tier): boolean {
  const allowed = allowedFlags(tier);
  const flags = item.flags ?? [];
  return flags.every((f) => allowed.includes(f));
}

function pool<T extends { flags?: string[] }>(items: T[], tier: Tier): T[] {
  return items.filter((i) => permittedByTier(i, tier));
}

// ── RNG ──────────────────────────────────────────────────────────────

/** mulberry32 — small, seedable, deterministic. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Meter scansion ───────────────────────────────────────────────────

const IAMBIC = 'wSwSwSwSwS';       // 10, masculine
const TROCHAIC = 'SwSwSwSw';       // 8, feminine (full)
const TROCHAIC_CAT = 'SwSwSwS';    // 7, masculine (catalectic)

/** Does a candidate meter string match a fixed template? `x` in the
 *  candidate is a wildcard (flexible monosyllable), as meta.meterModes
 *  documents. Lengths must be equal. */
function fits(candidate: string, template: string): boolean {
  if (candidate.length !== template.length) return false;
  for (let i = 0; i < template.length; i++) {
    const c = candidate[i];
    if (c !== 'x' && c !== template[i]) return false;
  }
  return true;
}

/** Authentic iambic: position 0 stays weak (the fixed "Thou"), but allow
 *  a single foot substitution (one strong/weak mismatch) elsewhere and a
 *  feminine trailing weak. A pragmatic reading of meta's "authentic". */
function fitsAuthenticIambic(candidate: string, feminine: boolean): boolean {
  const base = feminine ? IAMBIC + 'w' : IAMBIC;
  if (candidate.length !== base.length) return false;
  if (candidate[0] !== 'x' && candidate[0] !== 'w') return false; // Thou is weak
  let subs = 0;
  for (let i = 1; i < base.length; i++) {
    const c = candidate[i];
    if (c !== 'x' && c !== base[i]) { subs++; if (subs > 1) return false; }
  }
  return true;
}

function meterMatches(candidate: string, meter: Meter, ending: Ending, strict: boolean): boolean {
  if (meter === 'iambicPentameter') {
    const masc = fits(candidate, IAMBIC);
    const fem = fits(candidate, IAMBIC + 'w');
    if (strict) {
      if (ending === 'masculine') return masc;
      if (ending === 'feminine') return fem;
      return masc || fem;
    }
    if (ending === 'masculine') return fitsAuthenticIambic(candidate, false);
    if (ending === 'feminine') return fitsAuthenticIambic(candidate, true);
    return fitsAuthenticIambic(candidate, false) || fitsAuthenticIambic(candidate, true);
  }
  if (meter === 'trochaicTetrameter') {
    const masc = fits(candidate, TROCHAIC_CAT); // catalectic, ends on stress
    const fem = fits(candidate, TROCHAIC);      // full, trailing weak
    if (ending === 'masculine') return masc;
    if (ending === 'feminine') return fem;
    return masc || fem;
  }
  return true;
}

// ── Engine factory ───────────────────────────────────────────────────

export function createInsultEngine(rng: () => number = Math.random) {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  function cap(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
  }

  /** Forge a compound insult from tier-permitted term pools. */
  function forge(tier: Tier, opts: ForgeOpts = {}): ForgeResult {
    const adjPool = pool(adjectives, tier);
    const nounPool = pool(nouns, tier);
    const meter: Meter = opts.meter ?? 'any';
    const ending: Ending = opts.ending ?? 'any';
    const strict = opts.strict ?? false;

    const build = (a1: LexItem, a2: LexItem, n: LexItem): ForgeResult => {
      const trochaic = meter === 'trochaicTetrameter';
      const text = trochaic
        ? `${cap(a1.term)} ${a2.term} ${n.term}!`
        : `Thou ${a1.term} ${a2.term} ${n.term}.`;
      return {
        text,
        parts: [
          { term: a1.term, play: a1.play },
          { term: a2.term, play: a2.play },
          { term: n.term, play: n.play },
        ],
        scanned: true,
      };
    };

    const pickTriple = (): [LexItem, LexItem, LexItem] => {
      const a1 = pick(adjPool);
      let a2 = pick(adjPool);
      let guard = 0;
      while (a2.term === a1.term && adjPool.length > 1 && guard++ < 50) a2 = pick(adjPool);
      const n = pick(nounPool);
      return [a1, a2, n];
    };

    if (meter === 'any') {
      const [a1, a2, n] = pickTriple();
      return build(a1, a2, n);
    }

    const lead = meter === 'iambicPentameter' ? 'w' : ''; // "Thou" weak beat
    const MAX = 2000;
    for (let i = 0; i < MAX; i++) {
      const [a1, a2, n] = pickTriple();
      const candidate = `${lead}${a1.meter ?? ''}${a2.meter ?? ''}${n.meter ?? ''}`;
      if (meterMatches(candidate, meter, ending, strict)) return build(a1, a2, n);
    }
    // Nothing scanned within the cap — let the UI ask for another strike.
    return { text: '', parts: [], scanned: false };
  }

  /** A verbatim canonical line, tier-permitted, avoiding an immediate repeat. */
  function summonLine(tier: Tier, opts: { avoid?: string } = {}): TrueLine {
    const p = pool(lines, tier);
    if (p.length === 0) return { ...lines[0] };
    let line = pick(p);
    let guard = 0;
    while (opts.avoid && line.text === opts.avoid && p.length > 1 && guard++ < 50) line = pick(p);
    return { ...line };
  }

  /** "Thou d1, thou d2, … thou dn!" from tier-permitted diminutives. */
  function diminutiveCascade(tier: Tier, n = 4): ForgeResult {
    const p = pool(diminutives, tier);
    const chosen: LexItem[] = [];
    for (let i = 0; i < n; i++) chosen.push(pick(p));
    const text = 'Thou ' + chosen.map((d) => d.term).join(', thou ') + '!';
    return { text, parts: chosen.map((d) => ({ term: d.term, play: d.play })), scanned: true };
  }

  /** The pinned Caliban epigraph. Display only — never in any pool. */
  function epigraph(): Epigraph {
    const e = meta.epigraph;
    return { text: e.text, speaker: e.speaker, play: e.play };
  }

  return { forge, summonLine, diminutiveCascade, epigraph };
}

export const insultEngine = createInsultEngine();

/** Tier metadata for the UI (labels, descriptions, age gate) — from data. */
export function tierMeta(tier: Tier) {
  return meta.tiers[tier] as { label: string; description: string; allowedFlags: string[]; ageGated: boolean };
}

export { meta as insultMeta };
