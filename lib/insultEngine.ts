/**
 * insultEngine — pure, framework-agnostic generator for the
 * Shakespearean Insults module. No DOM, no React.
 *
 * Everything is driven by data/bard-insults.json: the term pools, the
 * tier flag-allowlists (meta.tiers), and the meter templates
 * (meta.meterModes). Tier membership and scansion are NEVER hardcoded
 * here — reassigning a flag or editing a template is a data edit.
 *
 * VOICE COHERENCE. A forged line comes out of one mouth. The engine
 * picks the speaker first, then draws every adjective and the noun from
 * that speaker's own terms. When a speaker cannot fill the template it
 * falls back to the play (same play, any speaker in it) and then to a
 * different speaker. It never mixes plays. This mirrors
 * netlify/functions/playhouse-replies.ts, where a bot only ever answers
 * inside its own play and its own relationships.
 *
 * RNG is injectable so a (tier, seed) pair is deterministic in tests.
 */

import raw from '../data/bard-insults.json';

// ── Types ────────────────────────────────────────────────────────────

export type Tier = 'safe' | 'edgy' | 'full';
export type Meter = 'any' | 'iambicPentameter' | 'trochaicTetrameter';
export type Ending = 'any' | 'masculine' | 'feminine';

/** How tightly a forged line is bound to its source. */
export type Coherence = 'speaker' | 'play' | 'none';

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

export interface ForgePart {
  term: string;
  play: string;
  speaker: string;
  citation?: string;
}

export interface ForgeResult {
  text: string;
  parts: ForgePart[];
  /** false when a meter was requested but nothing in the corpus scans that way. */
  scanned: boolean;
  /** The single voice every part came from. Empty under play-level fallback. */
  speaker: string;
  /** The single play every part came from. Empty when nothing scanned. */
  play: string;
  /** 'speaker' one mouth · 'play' one play, mixed mouths · 'none' nothing scanned. */
  coherence: Coherence;
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

// ── Voice grouping ───────────────────────────────────────────────────
// A "voice" is one speaker inside one play. Falstaff in 1 Henry IV and
// Falstaff in The Merry Wives of Windsor are separate voices, because a
// line that welded the two would still be mixing plays.

interface Voice {
  key: string;
  speaker: string;   // '' for a play-level voice
  play: string;
  adjectives: LexItem[];
  nouns: LexItem[];
  /** Combinatorial reach. Weighted picks favour deep pools. */
  weight: number;
}

interface TierVoices {
  speakers: Voice[];                 // viable speaker voices
  plays: Map<string, Voice>;         // viable play voices, by play name
}

/** Key separator. A control char so no play/speaker pair can collide. */
const SEP = '\u0000';

/** A voice can fill the template only with two distinct adjectives and a noun. */
function viable(v: Voice): boolean {
  return v.adjectives.length >= 2 && v.nouns.length >= 1;
}

function collect(
  adj: LexItem[], nou: LexItem[],
  keyOf: (i: LexItem) => string,
  speakerOf: (i: LexItem) => string,
): Map<string, Voice> {
  const out = new Map<string, Voice>();
  const touch = (i: LexItem): Voice => {
    const key = keyOf(i);
    let v = out.get(key);
    if (!v) {
      v = { key, speaker: speakerOf(i), play: i.play, adjectives: [], nouns: [], weight: 0 };
      out.set(key, v);
    }
    return v;
  };
  for (const i of adj) touch(i).adjectives.push(i);
  for (const i of nou) touch(i).nouns.push(i);
  for (const v of out.values()) v.weight = v.adjectives.length * v.nouns.length;
  return out;
}

const voiceCache = new Map<Tier, TierVoices>();

function voicesFor(tier: Tier): TierVoices {
  const hit = voiceCache.get(tier);
  if (hit) return hit;

  const adj = pool(adjectives, tier);
  const nou = pool(nouns, tier);

  const bySpeaker = collect(adj, nou, (i) => `${i.play}${SEP}${i.speaker ?? ''}`, (i) => i.speaker ?? '');
  const byPlay = collect(adj, nou, (i) => i.play, () => '');

  const built: TierVoices = {
    speakers: [...bySpeaker.values()].filter(viable),
    plays: new Map([...byPlay.values()].filter(viable).map((v) => [v.play, v])),
  };
  voiceCache.set(tier, built);
  return built;
}

// ── Metered combination index ────────────────────────────────────────
// For a metered request the engine does not sample blindly. It enumerates
// the DISTINCT meter-string combinations available inside one voice and
// keeps the ones that scan. That is exhaustive, so an empty result is
// proof the voice cannot satisfy the request, and it is small, because
// there are far fewer meter strings than terms.

interface Combo {
  a1: LexItem[];
  a2: LexItem[];
  n: LexItem[];
  /** number of distinct (a1, a2, noun) triples this combination covers. */
  weight: number;
}

function bucketByMeter(items: LexItem[]): Map<string, LexItem[]> {
  const out = new Map<string, LexItem[]>();
  for (const i of items) {
    const m = i.meter ?? '';
    const b = out.get(m);
    if (b) b.push(i); else out.set(m, [i]);
  }
  return out;
}

const comboCache = new Map<string, Combo[]>();

function combosFor(v: Voice, tier: Tier, meter: Meter, ending: Ending, strict: boolean): Combo[] {
  const cacheKey = `${tier}|${meter}|${ending}|${strict}|${v.key}`;
  const hit = comboCache.get(cacheKey);
  if (hit) return hit;

  const lead = meter === 'iambicPentameter' ? 'w' : ''; // "Thou" weak beat
  const adjB = bucketByMeter(v.adjectives);
  const nounB = bucketByMeter(v.nouns);
  const out: Combo[] = [];

  for (const [m1, b1] of adjB) {
    for (const [m2, b2] of adjB) {
      // Two adjectives must be distinct terms. Same bucket needs two members.
      if (m1 === m2 && b1.length < 2) continue;
      const pairs = m1 === m2 ? b1.length * (b1.length - 1) : b1.length * b2.length;
      for (const [mn, bn] of nounB) {
        if (meterMatches(`${lead}${m1}${m2}${mn}`, meter, ending, strict)) {
          out.push({ a1: b1, a2: b2, n: bn, weight: pairs * bn.length });
        }
      }
    }
  }

  comboCache.set(cacheKey, out);
  return out;
}

// ── Engine factory ───────────────────────────────────────────────────

export function createInsultEngine(rng: () => number = Math.random) {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  /** Weighted draw that REMOVES the winner, so a traversal never repeats. */
  function takeWeighted<T extends { weight: number }>(list: T[]): T {
    let total = 0;
    for (const item of list) total += item.weight;
    let r = rng() * total;
    for (let i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r < 0 || i === list.length - 1) return list.splice(i, 1)[0];
    }
    return list.splice(0, 1)[0];
  }

  function cap(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
  }

  function part(i: LexItem): ForgePart {
    return { term: i.term, play: i.play, speaker: i.speaker ?? '', citation: i.citation };
  }

  const nothingScanned = (): ForgeResult => ({
    text: '', parts: [], scanned: false, speaker: '', play: '', coherence: 'none',
  });

  /** Forge a compound insult. Every part comes from one voice. */
  function forge(tier: Tier, opts: ForgeOpts = {}): ForgeResult {
    const meter: Meter = opts.meter ?? 'any';
    const ending: Ending = opts.ending ?? 'any';
    const strict = opts.strict ?? false;
    const { speakers, plays } = voicesFor(tier);

    const build = (a1: LexItem, a2: LexItem, n: LexItem, v: Voice): ForgeResult => {
      const trochaic = meter === 'trochaicTetrameter';
      const text = trochaic
        ? `${cap(a1.term)} ${a2.term} ${n.term}!`
        : `Thou ${a1.term} ${a2.term} ${n.term}.`;
      return {
        text,
        parts: [part(a1), part(a2), part(n)],
        scanned: true,
        speaker: v.speaker,
        play: v.play,
        coherence: v.speaker ? 'speaker' : 'play',
      };
    };

    /** Draw a triple from one voice, or null when the voice cannot scan. */
    const draw = (v: Voice): ForgeResult | null => {
      if (meter === 'any') {
        const a1 = pick(v.adjectives);
        let a2 = pick(v.adjectives);
        let guard = 0;
        while (a2.term === a1.term && v.adjectives.length > 1 && guard++ < 50) a2 = pick(v.adjectives);
        if (a2.term === a1.term) return null;
        return build(a1, a2, pick(v.nouns), v);
      }

      const combos = combosFor(v, tier, meter, ending, strict);
      if (combos.length === 0) return null;
      const c = takeWeighted(combos.slice());
      const a1 = pick(c.a1);
      let a2 = pick(c.a2);
      let guard = 0;
      while (a2.term === a1.term && guard++ < 50) a2 = pick(c.a2);
      if (a2.term === a1.term) return null;
      return build(a1, a2, pick(c.n), v);
    };

    const remaining = speakers.slice();
    const triedPlays = new Set<string>();
    const MAX = 2000; // hard termination guard, as before

    for (let i = 0; i < MAX && remaining.length; i++) {
      const v = takeWeighted(remaining);

      const bySpeaker = draw(v);
      if (bySpeaker) return bySpeaker;

      // The speaker cannot fill it. Widen to the play, never past it.
      if (!triedPlays.has(v.play)) {
        triedPlays.add(v.play);
        const pv = plays.get(v.play);
        if (pv) {
          const byPlay = draw(pv);
          if (byPlay) return byPlay;
        }
      }
    }

    // Plays that hold no viable single speaker still deserve a look.
    for (const pv of plays.values()) {
      if (triedPlays.has(pv.play)) continue;
      triedPlays.add(pv.play);
      const byPlay = draw(pv);
      if (byPlay) return byPlay;
    }

    // Nothing in the corpus scans that way. The UI decides what to say.
    return nothingScanned();
  }

  /** A verbatim canonical line, tier-permitted, avoiding an immediate repeat.
   *  The epigraph also sits in `lines`, so it is withheld here — meta.epigraph
   *  pins it as display-only and bars it from every random pool. */
  function summonLine(tier: Tier, opts: { avoid?: string } = {}): TrueLine {
    const p = pool(lines, tier).filter((l) => l.text !== meta.epigraph.text);
    if (p.length === 0) return { ...lines[0] };
    let line = pick(p);
    let guard = 0;
    while (opts.avoid && line.text === opts.avoid && p.length > 1 && guard++ < 50) line = pick(p);
    return { ...line };
  }

  /** "Thou d1, thou d2, … thou dn!" — one voice, as the forge is. */
  function diminutiveCascade(tier: Tier, n = 4): ForgeResult {
    const p = pool(diminutives, tier);
    const byVoice = collect(p, [], (i) => `${i.play}${SEP}${i.speaker ?? ''}`, (i) => i.speaker ?? '');
    const voices = [...byVoice.values()].filter((v) => v.adjectives.length > 0);
    if (voices.length === 0) return nothingScanned();

    // weight is adj*noun, and a diminutive voice holds no nouns.
    for (const v of voices) v.weight = v.adjectives.length;
    const voice = takeWeighted(voices);

    const bag = voice.adjectives.slice();
    const chosen: LexItem[] = [];
    for (let i = 0; i < n; i++) {
      if (bag.length === 0) bag.push(...voice.adjectives); // short voice, wrap around
      chosen.push(bag.splice(Math.floor(rng() * bag.length), 1)[0]);
    }

    return {
      text: 'Thou ' + chosen.map((d) => d.term).join(', thou ') + '!',
      parts: chosen.map(part),
      scanned: true,
      speaker: voice.speaker,
      play: voice.play,
      coherence: 'speaker',
    };
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
