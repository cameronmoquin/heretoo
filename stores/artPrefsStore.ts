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

interface Persisted {
  schools: string[];
  eras: ArtEra[];
  genres: string[];
  mediums: string[];
  sources: string[];          // museum origins: 'met', 'aic', 'rijks', etc.
}

const STORAGE_KEY = 'heretoo:art-prefs';

function loadInitial(): Persisted {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          schools: Array.isArray(parsed.schools) ? parsed.schools : [],
          eras: Array.isArray(parsed.eras) ? parsed.eras : [],
          genres: Array.isArray(parsed.genres) ? parsed.genres : [],
          mediums: Array.isArray(parsed.mediums) ? parsed.mediums : [],
          sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        };
      }
    } catch {}
  }
  return { schools: [], eras: [], genres: [], mediums: [], sources: [] };
}

function persist(state: Persisted) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface ArtPrefsState extends Persisted {
  toggleSchool: (s: string) => void;
  toggleEra: (e: ArtEra) => void;
  toggleGenre: (g: string) => void;
  toggleMedium: (m: string) => void;
  toggleSource: (s: string) => void;
  clear: () => void;
}

function snapshot(get: () => ArtPrefsState): Persisted {
  const st = get();
  return { schools: st.schools, eras: st.eras, genres: st.genres, mediums: st.mediums, sources: st.sources };
}

export const useArtPrefs = create<ArtPrefsState>((set, get) => ({
  ...loadInitial(),
  toggleSchool: (s) => {
    const next = get().schools.includes(s)
      ? get().schools.filter((x) => x !== s)
      : [...get().schools, s];
    set({ schools: next });
    persist({ ...snapshot(get) });
  },
  toggleEra: (e) => {
    const next = get().eras.includes(e)
      ? get().eras.filter((x) => x !== e)
      : [...get().eras, e];
    set({ eras: next });
    persist({ ...snapshot(get) });
  },
  toggleGenre: (g) => {
    const next = get().genres.includes(g)
      ? get().genres.filter((x) => x !== g)
      : [...get().genres, g];
    set({ genres: next });
    persist({ ...snapshot(get) });
  },
  toggleMedium: (m) => {
    const next = get().mediums.includes(m)
      ? get().mediums.filter((x) => x !== m)
      : [...get().mediums, m];
    set({ mediums: next });
    persist({ ...snapshot(get) });
  },
  toggleSource: (s) => {
    const next = get().sources.includes(s)
      ? get().sources.filter((x) => x !== s)
      : [...get().sources, s];
    set({ sources: next });
    persist({ ...snapshot(get) });
  },
  clear: () => {
    set({ schools: [], eras: [], genres: [], mediums: [], sources: [] });
    persist({ schools: [], eras: [], genres: [], mediums: [], sources: [] });
  },
}));

export const SOURCE_LABELS: Record<string, string> = {
  met: 'The Met',
  aic: 'Art Institute of Chicago',
  cma: 'Cleveland Museum of Art',
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
