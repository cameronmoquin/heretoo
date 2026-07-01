import { describe, it, expect } from 'vitest';
import {
  createInsultEngine, makeRng, insultMeta,
  type Tier,
} from './insultEngine';
import raw from '../data/bard-insults.json';

const data = raw as any;
const TIERS: Tier[] = ['safe', 'edgy', 'full'];

// Verbatim term/line sets straight from the corpus.
const allTerms = new Set<string>([
  ...data.lexicon.adjectives.map((x: any) => x.term),
  ...data.lexicon.nouns.map((x: any) => x.term),
  ...data.lexicon.diminutives.map((x: any) => x.term),
]);
const allLineTexts = new Set<string>(data.lines.map((l: any) => l.text));

function meterOf(term: string): string {
  const all = [...data.lexicon.adjectives, ...data.lexicon.nouns, ...data.lexicon.diminutives];
  return all.find((x: any) => x.term === term)?.meter ?? '';
}
function fits(candidate: string, template: string): boolean {
  if (candidate.length !== template.length) return false;
  for (let i = 0; i < template.length; i++) {
    if (candidate[i] !== 'x' && candidate[i] !== template[i]) return false;
  }
  return true;
}

describe('tier permission', () => {
  it('safe returns no flagged entries; edgy excludes third-rail; full withholds nothing', () => {
    const eng = createInsultEngine(makeRng(7));
    const flagsFor = (term: string) => {
      const all = [...data.lexicon.adjectives, ...data.lexicon.nouns];
      return all.find((x: any) => x.term === term)?.flags ?? [];
    };
    for (let i = 0; i < 300; i++) {
      const safe = eng.forge('safe');
      for (const p of safe.parts) expect(flagsFor(p.term)).toHaveLength(0);
      const edgy = eng.forge('edgy');
      for (const p of edgy.parts) {
        const f = flagsFor(p.term);
        expect(f).not.toContain('racial');
        expect(f).not.toContain('antisemitic');
        expect(f).not.toContain('colonial');
      }
    }
    // full permitted pool == full corpus (nothing withheld)
    const fullAllowed = insultMeta.tiers.full.allowedFlags as string[];
    const everyFlag = new Set<string>();
    [...data.lexicon.adjectives, ...data.lexicon.nouns, ...data.lexicon.diminutives, ...data.lines]
      .forEach((x: any) => (x.flags ?? []).forEach((f: string) => everyFlag.add(f)));
    for (const f of everyFlag) expect(fullAllowed).toContain(f);
  });
});

describe('forge', () => {
  it('returns two distinct adjectives', () => {
    const eng = createInsultEngine(makeRng(11));
    for (const tier of TIERS) {
      for (let i = 0; i < 200; i++) {
        const r = eng.forge(tier);
        expect(r.parts[0].term).not.toBe(r.parts[1].term);
      }
    }
  });

  it('only returns verbatim corpus terms (no mutation)', () => {
    const eng = createInsultEngine(makeRng(3));
    for (const tier of TIERS) {
      for (let i = 0; i < 200; i++) {
        for (const p of eng.forge(tier).parts) expect(allTerms.has(p.term)).toBe(true);
      }
    }
  });
});

describe('meter (read from corpus, not recomputed)', () => {
  it('iambic strict: leading Thou weak beat, fits wSwSwSwSwS (10) or 11 feminine', () => {
    const eng = createInsultEngine(makeRng(42));
    let scannedCount = 0;
    for (let i = 0; i < 400; i++) {
      const r = eng.forge('full', { meter: 'iambicPentameter', strict: true });
      if (!r.scanned) continue;
      scannedCount++;
      const combined = 'w' + r.parts.map((p) => meterOf(p.term)).join('');
      expect(fits(combined, 'wSwSwSwSwS') || fits(combined, 'wSwSwSwSwSw')).toBe(true);
    }
    expect(scannedCount).toBeGreaterThan(0);
  });

  it('trochaic: no Thou, opens on stress, fits SwSwSwSw (8) or catalectic SwSwSwS (7)', () => {
    const eng = createInsultEngine(makeRng(99));
    let scannedCount = 0;
    for (let i = 0; i < 400; i++) {
      const r = eng.forge('full', { meter: 'trochaicTetrameter' });
      if (!r.scanned) continue;
      scannedCount++;
      expect(r.text.startsWith('Thou')).toBe(false);
      const combined = r.parts.map((p) => meterOf(p.term)).join('');
      expect(fits(combined, 'SwSwSwSw') || fits(combined, 'SwSwSwS')).toBe(true);
    }
    expect(scannedCount).toBeGreaterThan(0);
  });
});

describe('summonLine', () => {
  it('returns verbatim canonical lines and avoids the avoided text', () => {
    const eng = createInsultEngine(makeRng(5));
    for (const tier of TIERS) {
      const first = eng.summonLine(tier);
      expect(allLineTexts.has(first.text)).toBe(true);
      for (let i = 0; i < 50; i++) {
        const next = eng.summonLine(tier, { avoid: first.text });
        expect(next.text).not.toBe(first.text);
      }
    }
  });
});

describe('epigraph', () => {
  it('is display-only and never appears in any generator pool', () => {
    const eng = createInsultEngine(makeRng(1));
    const epi = eng.epigraph().text;
    for (const tier of TIERS) {
      for (let i = 0; i < 300; i++) {
        expect(eng.forge(tier).text).not.toBe(epi);
        expect(eng.summonLine(tier).text).not.toBe(epi);
        expect(eng.diminutiveCascade(tier).text).not.toBe(epi);
      }
    }
  });
});

describe('determinism', () => {
  it('same seed + tier yields identical sequences', () => {
    const a = createInsultEngine(makeRng(2024));
    const b = createInsultEngine(makeRng(2024));
    for (let i = 0; i < 100; i++) {
      expect(a.forge('full', { meter: 'iambicPentameter' })).toEqual(b.forge('full', { meter: 'iambicPentameter' }));
      expect(a.summonLine('edgy')).toEqual(b.summonLine('edgy'));
      expect(a.diminutiveCascade('safe')).toEqual(b.diminutiveCascade('safe'));
    }
  });
});
