/**
 * Art preferences — what the user wants to see in the gallery / banner /
 * inline-feed art slots.
 *
 * Hand-rolled localStorage persistence on web (matches the pattern used
 * by themeStore — zustand's persist middleware was throwing on init for
 * us). Native is in-memory for now; we'll move to AsyncStorage when we
 * ship the native build, or migrate to a `profiles.art_prefs` jsonb
 * column once we want it cross-device.
 *
 * Eras + schools + genres each carry an array of selected values. Empty
 * array means "no filter applied" — the gallery shows everything from
 * that axis. Default state is inclusive, not empty.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export type ArtEra =
  | 'antiquity'    // < 500 CE
  | 'medieval'     // 500–1499
  | 'renaissance'  // 1500–1599
  | 'baroque'      // 1600–1799
  | 'nineteenth'   // 1800–1899
  | 'modern'       // 1900–1999
  | 'contemporary' // 2000+
  ;

export const ERA_LABELS: Record<ArtEra, string> = {
  antiquity: 'Antiquity',
  medieval: 'Medieval',
  renaissance: 'Renaissance',
  baroque: 'Baroque',
  nineteenth: '19th Century',
  modern: 'Modern',
  contemporary: 'Contemporary',
};

export const ERA_RANGES: Record<ArtEra, [number, number]> = {
  antiquity: [-10000, 499],
  medieval: [500, 1499],
  renaissance: [1500, 1599],
  baroque: [1600, 1799],
  nineteenth: [1800, 1899],
  modern: [1900, 1999],
  contemporary: [2000, 9999],
};

/**
 * What's allowed in the between-post slots (banners, inline art slots,
 * sidebar). The same surface eventually serves ads, so this preference
 * is a single dial that controls both:
 *   - 'art_only'    Public-domain artwork only (no ads). Default.
 *   - 'art_and_ads' Mix of art + sponsored placements (where they
 *                   exist; right now there are zero, so behaves like
 *                   art_only until ad inventory lands).
 *   - 'posts_only'  Skip every between-post slot entirely. The
 *                   eventual $5/mo subscription preview.
 */
export type FeedMix = 'art_only' | 'art_and_ads' | 'posts_only';

export const FEED_MIX_LABELS: Record<FeedMix, { title: string }> = {
  art_only:    { title: 'Art only' },
  art_and_ads: { title: 'Art + ads' },
  posts_only:  { title: 'Posts only' },
};

interface Persisted {
  schools: string[];
  eras: ArtEra[];
  genres: string[];
  mediums: string[];
  sources: string[];          // museum origins: 'met', 'aic', 'rijks', etc.
  feedMix: FeedMix;
  /** Which default rule this blob was last reconciled against. */
  ruleVersion?: number;
}

const STORAGE_KEY = 'heretoo:art-prefs';

/** Bump when the default selection changes and should reach devices
 *  that already have prefs saved. 1 = the poster rule. */
const RULE_VERSION = 1;

/**
 * THE POSTER RULE. The gallery is graphic work: WPA silkscreen, vintage
 * advertising, midcentury European poster art.
 *
 * Actual pop art is not obtainable. Warhol, Lichtenstein and Rosenquist
 * are in copyright and no museum releases them CC0 — across 104,183
 * works, `school` matching 'pop' returns two and no row carries a 'pop
 * art' genre. Chasing it would mean an empty gallery.
 *
 * WPA silkscreen is the legally clean thing that reads closest: flat
 * colour, hard outline, commercial-graphic energy, 1936-43. 942 of them
 * came in from the Library of Congress; scripts/ingest-art.mjs takes
 * further poster collections as they are confirmed.
 *
 * No era default any more. Poster IS the rule, and the LoC date field is
 * unreliable enough (theatre posters from the thirties dated 1990) that
 * layering an era on top would drop good work for a bad reason. Every
 * era and genre is still one tap away in Art preferences.
 */
const DEFAULT_ERAS: ArtEra[] = [];
const DEFAULT_GENRES: string[] = ['poster'];

function loadInitial(): Persisted {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // THE RULE HAS TO REACH EXISTING DEVICES. Anyone who had already
        // opened the app carries a saved blob with genres: [], so the
        // poster default only ever applied to a browser that had never
        // seen HereToo — which is nobody who would notice it. A stored
        // ruleVersion lets the default land exactly once on a device
        // that predates it, without overriding what someone picks later.
        if ((parsed.ruleVersion ?? 0) < RULE_VERSION) {
          return {
            schools: [], eras: [...DEFAULT_ERAS], genres: [...DEFAULT_GENRES],
            mediums: [], sources: [],
            feedMix: parsed.feedMix === 'art_and_ads' || parsed.feedMix === 'posts_only'
              ? parsed.feedMix : 'art_only',
            ruleVersion: RULE_VERSION,
          };
        }
        const mix: FeedMix =
          parsed.feedMix === 'art_and_ads' || parsed.feedMix === 'posts_only'
            ? parsed.feedMix
            : 'art_only';
        return {
          schools: Array.isArray(parsed.schools) ? parsed.schools : [],
          eras: Array.isArray(parsed.eras) ? parsed.eras : [],
          genres: Array.isArray(parsed.genres) ? parsed.genres : [],
          mediums: Array.isArray(parsed.mediums) ? parsed.mediums : [],
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
          feedMix: mix,
          ruleVersion: RULE_VERSION,
        };
      }
    } catch {}
  }
  return { schools: [], eras: [...DEFAULT_ERAS], genres: [...DEFAULT_GENRES], mediums: [], sources: [], feedMix: 'art_only', ruleVersion: RULE_VERSION };
}

function persist(state: Persisted) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Mirror art-filter prefs to profiles.style_prefs.art_filter so OTHER
 * viewers see this user's gallery taste on /u/<handle>. Best-effort
 * write, RLS-gated to the user's own row, swallows errors so
 * localStorage stays the source of truth on the user's own device.
 */
async function syncToProfile(state: Persisted) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;
    const { data: cur } = await supabase
      .from('profiles')
      .select('style_prefs')
      .eq('id', userId)
      .maybeSingle();
    const next = {
      ...((cur as any)?.style_prefs ?? {}),
      art_filter: {
        schools: state.schools,
        eras: state.eras,
        genres: state.genres,
        mediums: state.mediums,
        sources: state.sources,
        feedMix: state.feedMix,
      },
    };
    await supabase
      .from('profiles')
      .update({ style_prefs: next })
      .eq('id', userId);
  } catch {}
}

interface ArtPrefsState extends Persisted {
  toggleSchool: (s: string) => void;
  toggleEra: (e: ArtEra) => void;
  toggleGenre: (g: string) => void;
  toggleMedium: (m: string) => void;
  toggleSource: (s: string) => void;
  setFeedMix: (m: FeedMix) => void;
  clear: () => void;
  /** Replace all axes at once — used by the picker's "Apply" button
   *  so a batch of toggles only triggers ONE persist + sync + feed
   *  refetch instead of N. */
  applyAll: (next: Persisted) => void;
}

function snapshot(get: () => ArtPrefsState): Persisted {
  const st = get();
  return { schools: st.schools, eras: st.eras, genres: st.genres, mediums: st.mediums, sources: st.sources, feedMix: st.feedMix, ruleVersion: RULE_VERSION };
}

/** Combined persist (localStorage) + sync (profile.style_prefs).
 *  Every prefs mutation calls this so cross-user visibility stays
 *  fresh without each toggle remembering to do both. */
function persistAndSync(state: Persisted) {
  persist(state);
  void syncToProfile(state);
}

export const useArtPrefs = create<ArtPrefsState>((set, get) => ({
  ...loadInitial(),
  toggleSchool: (s) => {
    const next = get().schools.includes(s)
      ? get().schools.filter((x) => x !== s)
      : [...get().schools, s];
    set({ schools: next });
    persistAndSync({ ...snapshot(get) });
  },
  toggleEra: (e) => {
    const next = get().eras.includes(e)
      ? get().eras.filter((x) => x !== e)
      : [...get().eras, e];
    set({ eras: next });
    persistAndSync({ ...snapshot(get) });
  },
  toggleGenre: (g) => {
    const next = get().genres.includes(g)
      ? get().genres.filter((x) => x !== g)
      : [...get().genres, g];
    set({ genres: next });
    persistAndSync({ ...snapshot(get) });
  },
  toggleMedium: (m) => {
    const next = get().mediums.includes(m)
      ? get().mediums.filter((x) => x !== m)
      : [...get().mediums, m];
    set({ mediums: next });
    persistAndSync({ ...snapshot(get) });
  },
  toggleSource: (s) => {
    const next = get().sources.includes(s)
      ? get().sources.filter((x) => x !== s)
      : [...get().sources, s];
    set({ sources: next });
    persistAndSync({ ...snapshot(get) });
  },
  setFeedMix: (m) => {
    set({ feedMix: m });
    persistAndSync({ ...snapshot(get) });
  },
  clear: () => {
    const cur = get();
    const next: Persisted = {
      schools: [], eras: [], genres: [], mediums: [], sources: [], feedMix: cur.feedMix,
    };
    set(next);
    persistAndSync(next);
  },
  applyAll: (next) => {
    set(next);
    persistAndSync(next);
  },
}));

export const SOURCE_LABELS: Record<string, string> = {
  met: 'The Met',
  aic: 'Art Institute of Chicago',
  cma: 'Cleveland Museum of Art',
  smithsonian: 'Smithsonian Hirshhorn',
  rijks: 'Rijksmuseum',
};

/** Pull a 4-digit year out of free-form `year_created`. */
export function parseYear(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/-?\d{1,4}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Bucket a parsed year into one of the era keys. */
export function yearToEra(year: number | null): ArtEra | null {
  if (year == null) return null;
  for (const era of Object.keys(ERA_RANGES) as ArtEra[]) {
    const [lo, hi] = ERA_RANGES[era];
    if (year >= lo && year <= hi) return era;
  }
  return null;
}

/** Normalize a freeform school string for grouping. */
export function normalizeSchool(s: string | null | undefined): string | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  if (/19th|nineteenth/.test(v)) return '19th century';
  if (/18th/.test(v)) return '18th century';
  if (/17th/.test(v)) return '17th century';
  if (/16th/.test(v)) return '16th century';
  if (/15th/.test(v)) return '15th century';
  if (/roman/.test(v)) return 'roman';
  if (/japanese/.test(v)) return 'japanese';
  if (/chinese/.test(v)) return 'chinese';
  if (/turkish/.test(v)) return 'turkish';
  return v;
}
