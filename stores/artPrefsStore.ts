/**
 * Art preferences — what the user wants to see in the gallery / banner /
 * inline-feed art slots. Persisted to localStorage on web (so refresh
 * keeps your taste), in-memory on native (a future migration can move
 * this server-side, keyed by profile_id, when we want it cross-device).
 *
 * Eras + schools + genres each carry a Set of selected values. An empty
 * Set means "no filter applied" — the gallery shows everything from
 * that axis. This makes the default state inclusive instead of empty.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

interface ArtPrefsState {
  schools: string[];
  eras: ArtEra[];
  genres: string[];
  toggleSchool: (s: string) => void;
  toggleEra: (e: ArtEra) => void;
  toggleGenre: (g: string) => void;
  clear: () => void;
}

const safeStorage = (): Storage => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    // No-op storage for native; we'll add real native persistence later.
    return {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    };
  }
  return window.localStorage;
};

export const useArtPrefs = create<ArtPrefsState>()(
  persist(
    (set, get) => ({
      schools: [],
      eras: [],
      genres: [],
      toggleSchool: (s) => set({
        schools: get().schools.includes(s)
          ? get().schools.filter((x) => x !== s)
          : [...get().schools, s],
      }),
      toggleEra: (e) => set({
        eras: get().eras.includes(e)
          ? get().eras.filter((x) => x !== e)
          : [...get().eras, e],
      }),
      toggleGenre: (g) => set({
        genres: get().genres.includes(g)
          ? get().genres.filter((x) => x !== g)
          : [...get().genres, g],
      }),
      clear: () => set({ schools: [], eras: [], genres: [] }),
    }),
    {
      name: 'heretoo:art-prefs',
      storage: createJSONStorage(() => safeStorage()),
    },
  ),
);

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
  // Light de-duplication for the messiest cases in our data.
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
