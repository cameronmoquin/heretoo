import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createInsultEngine, makeRng, insultMeta,
  type Tier, type Meter, type Ending,
} from './insultEngine';
import raw from '../data/bard-insults.json';

const data = raw as any;
const TIERS: Tier[] = ['safe', 'edgy', 'full'];
const METERS: Meter[] = ['any', 'iambicPentameter', 'trochaicTetrameter'];
const ENDINGS: Ending[] = ['any', 'masculine', 'feminine'];

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

// ── Voice coherence ────────────────────────────────────────────────────
// The bug these cover: the forge used to draw adjectives and the noun from
// independent corpus-wide pools, welding Prince Hal's adjective to Thersites'
// noun. Two characters who never met, one line.

describe('voice coherence', () => {
  it('every part of a forged line shares one speaker', () => {
    const eng = createInsultEngine(makeRng(17));
    let speakerLines = 0;
    for (const tier of TIERS) {
      for (const meter of METERS) {
        for (let i = 0; i < 150; i++) {
          const r = eng.forge(tier, { meter });
          if (!r.scanned) continue;
          if (r.coherence !== 'speaker') continue;
          speakerLines++;
          expect(r.speaker).not.toBe('');
          const speakers = new Set(r.parts.map((p) => p.speaker));
          expect([...speakers]).toEqual([r.speaker]);
        }
      }
    }
    expect(speakerLines).toBeGreaterThan(0);
  });

  it('under play-level fallback every part still shares one play', () => {
    const eng = createInsultEngine(makeRng(23));
    let playLines = 0;
    for (const tier of TIERS) {
      for (const meter of METERS) {
        for (const ending of ENDINGS) {
          for (let i = 0; i < 120; i++) {
            const r = eng.forge(tier, { meter, ending });
            if (!r.scanned || r.coherence !== 'play') continue;
            playLines++;
            // A play-level line names no single voice, but one play only.
            expect(r.speaker).toBe('');
            expect(new Set(r.parts.map((p) => p.play)).size).toBe(1);
          }
        }
      }
    }
    expect(playLines).toBeGreaterThan(0);
  });

  it('no forged line ever mixes two plays', () => {
    const eng = createInsultEngine(makeRng(31));
    let checked = 0;
    for (const tier of TIERS) {
      for (const meter of METERS) {
        for (const ending of ENDINGS) {
          for (const strict of [false, true]) {
            for (let i = 0; i < 60; i++) {
              const r = eng.forge(tier, { meter, ending, strict });
              if (!r.scanned) continue;
              checked++;
              const plays = new Set(r.parts.map((p) => p.play));
              expect([...plays]).toEqual([r.play]);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('the diminutive cascade is one voice too', () => {
    const eng = createInsultEngine(makeRng(37));
    for (const tier of TIERS) {
      for (let i = 0; i < 200; i++) {
        const r = eng.diminutiveCascade(tier, 4);
        expect(r.scanned).toBe(true);
        expect(new Set(r.parts.map((p) => p.play))).toEqual(new Set([r.play]));
        expect(new Set(r.parts.map((p) => p.speaker))).toEqual(new Set([r.speaker]));
      }
    }
  });

  it('carries the speaker and play so the UI can cite the line', () => {
    const eng = createInsultEngine(makeRng(41));
    const r = eng.forge('full');
    expect(r.play).not.toBe('');
    expect(r.coherence).toBe('speaker');
    // The cited voice really does own every term, at the cited play.
    const lex = [...data.lexicon.adjectives, ...data.lexicon.nouns];
    for (const p of r.parts) {
      const entry = lex.find((x: any) => x.term === p.term);
      expect(entry.speaker).toBe(r.speaker);
      expect(entry.play).toBe(r.play);
      expect(p.citation).toBe(entry.citation);
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

  it('holds meter and tier at the same time as voice coherence', () => {
    const eng = createInsultEngine(makeRng(1009));
    const flagged = new Set(
      [...data.lexicon.adjectives, ...data.lexicon.nouns]
        .filter((x: any) => x.flags.length > 0)
        .map((x: any) => x.term),
    );
    for (let i = 0; i < 400; i++) {
      const r = eng.forge('safe', { meter: 'trochaicTetrameter', ending: 'masculine' });
      if (!r.scanned) continue;
      for (const p of r.parts) expect(flagged.has(p.term)).toBe(false);
      expect(new Set(r.parts.map((p) => p.play)).size).toBe(1);
      const combined = r.parts.map((p) => meterOf(p.term)).join('');
      expect(fits(combined, 'SwSwSwS')).toBe(true);
    }
  });
});

describe('unsatisfiable requests', () => {
  afterEach(() => { vi.resetModules(); vi.doUnmock('../data/bard-insults.json'); });

  it('terminates and reports honestly when nothing in the corpus can scan', async () => {
    // A corpus of one voice whose every term is Sww. Assembled against the
    // iambic template that reads wSwwSwwSww: two substitutions, so it can
    // never scan, at either ending, strict or not. The forge must say so
    // rather than loop or quietly drop the meter.
    const voice = { play: 'Nowhere', citation: '1.1', speaker: 'Nobody', flags: [] as string[] };
    const term = (t: string) => ({ ...voice, term: t, syllables: 3, meter: 'Sww', meterResolved: true });
    const fake = {
      meta: data.meta,
      lexicon: {
        adjectives: [term('bootless'), term('graceless')],
        nouns: [term('nothing')],
        diminutives: [term('mote')],
      },
      lines: data.lines,
    };

    vi.resetModules();
    vi.doMock('../data/bard-insults.json', () => ({ default: fake }));
    const mod = await import('./insultEngine');
    const eng = mod.createInsultEngine(mod.makeRng(5));

    for (const ending of ENDINGS) {
      for (const strict of [false, true]) {
        const started = Date.now();
        const r = eng.forge('safe', { meter: 'iambicPentameter', ending, strict });
        expect(Date.now() - started).toBeLessThan(2000); // it returns, it does not hang
        expect(r.scanned).toBe(false);
        expect(r.coherence).toBe('none');
        expect(r.parts).toEqual([]);
        expect(r.text).toBe('');
        expect(r.play).toBe('');
        expect(r.speaker).toBe('');
      }
    }

    // The same corpus still forges happily with the meter constraint off,
    // which proves the failure above is the meter and not an empty pool.
    const off = eng.forge('safe');
    expect(off.scanned).toBe(true);
    expect(off.speaker).toBe('Nobody');
    expect(off.text).toBe('Thou bootless graceless nothing.');
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

  it('a seeded rng produces a stable, reproducible line', () => {
    expect(createInsultEngine(makeRng(4242)).forge('full')).toMatchObject({
      text: 'Thou waspish mad-cap jade.',
      speaker: 'Katherine',
      play: 'The Taming of the Shrew',
      coherence: 'speaker',
      scanned: true,
    });

    expect(createInsultEngine(makeRng(4242)).forge('safe', { meter: 'iambicPentameter' })).toMatchObject({
      text: 'Thou loggerheaded flap-eared custard-coffin.',
      speaker: 'Petruchio',
      play: 'The Taming of the Shrew',
      coherence: 'speaker',
    });

    expect(createInsultEngine(makeRng(777)).forge('edgy', { meter: 'trochaicTetrameter' })).toMatchObject({
      text: 'Crook-back bunch-backed bunch-backed toad!',
      speaker: 'Margaret',
      play: 'Richard III',
      coherence: 'speaker',
    });

    expect(createInsultEngine(makeRng(99)).diminutiveCascade('safe')).toMatchObject({
      text: 'Thou rag, thou nit, thou winter-cricket, thou thread!',
      speaker: 'Petruchio',
      play: 'The Taming of the Shrew',
    });
  });
});
