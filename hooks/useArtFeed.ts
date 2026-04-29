/**
 * Art reservoir feed hook.
 *
 * Pulls a sample of art_works rows for inline display in the main feed.
 * Same slot renders ads (rows with source='ad'), so the art panel
 * doubles as a paid placement when we have inventory.
 *
 * Now also respects the user's art preferences (era / school / genre).
 * We fetch a wider pool then filter client-side because year_created
 * is freeform text and school strings are messy enough that JS-side
 * normalization is more reliable than SQL-side filtering.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  useArtPrefs, parseYear, yearToEra, normalizeSchool, type ArtEra,
} from '../stores/artPrefsStore';

export interface ArtWork {
  id: string;
  source: string;
  source_id: string | null;
  title: string | null;
  artist: string | null;
  year_created: string | null;
  storage_path: string;
  thumb_path: string | null;
  license: string;
  source_url: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  school?: string | null;
  genre?: string[] | null;
}

// Reservoir is small enough (~300 rows total) that we just pull the whole
// thing in one go. That way the prefs filter applies AFTER fetch and we
// never hit the "0 matches because the SQL limit cut the relevant rows"
// trap. Bumping limit so we don't accidentally cap as the gallery grows.
const POOL_SIZE = 1000;

export function useArtFeed() {
  // Read prefs as primitives so the query key changes when they do.
  const schools = useArtPrefs((s) => s.schools);
  const eras = useArtPrefs((s) => s.eras);
  const genres = useArtPrefs((s) => s.genres);

  return useQuery({
    queryKey: ['art-feed', schools, eras, genres],
    queryFn: async (): Promise<ArtWork[]> => {
      const { data: ads } = await supabase
        .from('art_works')
        .select('id,source,source_id,title,artist,year_created,storage_path,thumb_path,license,source_url,description,width,height,school,genre')
        .eq('source', 'ad')
        .limit(20);

      const { data: art, error } = await supabase
        .from('art_works')
        .select('id,source,source_id,title,artist,year_created,storage_path,thumb_path,license,source_url,description,width,height,school,genre')
        .neq('source', 'ad')
        .limit(POOL_SIZE);
      if (error) throw error;

      const fullPool = [...(ads ?? []), ...(art ?? [])] as ArtWork[];

      // Apply prefs. Empty selections == "no filter on that axis".
      const erasSet = new Set<ArtEra>(eras);
      const schoolsSet = new Set(schools.map((x) => x.toLowerCase()));
      const genresSet = new Set(genres.map((x) => x.toLowerCase()));
      const filtersActive = erasSet.size > 0 || schoolsSet.size > 0 || genresSet.size > 0;

      let pool = fullPool.filter((w) => {
        if (erasSet.size > 0) {
          const era = yearToEra(parseYear(w.year_created));
          if (!era || !erasSet.has(era)) return false;
        }
        if (schoolsSet.size > 0) {
          const sch = normalizeSchool(w.school) ?? '';
          if (!schoolsSet.has(sch)) return false;
        }
        if (genresSet.size > 0) {
          const tags = (w.genre ?? []).map((x) => x.toLowerCase());
          const hit = tags.some((t) => genresSet.has(t));
          if (!hit) return false;
        }
        return true;
      });

      // Graceful empty: if the filter combo zeroes out our pool, fall
      // back to the unfiltered set so banners / slots don't just go
      // blank with no explanation. The UI can surface "your filter
      // matched nothing" elsewhere if needed.
      if (filtersActive && pool.length === 0) {
        pool = fullPool;
      }

      // Shuffle so banner / inline / sidebar slots all get variety.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool;
    },
    staleTime: 1000 * 60 * 10,
  });
}

/** Distinct schools (normalized) + era counts for the prefs UI. */
export function useArtFacets() {
  return useQuery({
    queryKey: ['art-facets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('art_works')
        .select('school, year_created, genre')
        .neq('source', 'ad')
        .limit(1000);
      if (error) throw error;

      const schoolCounts = new Map<string, number>();
      const eraCounts: Record<ArtEra, number> = {
        antiquity: 0, medieval: 0, renaissance: 0, baroque: 0,
        nineteenth: 0, modern: 0, contemporary: 0,
      };
      const genreCounts = new Map<string, number>();

      for (const r of (data ?? []) as any[]) {
        const sch = normalizeSchool(r.school);
        if (sch) schoolCounts.set(sch, (schoolCounts.get(sch) ?? 0) + 1);

        const era = yearToEra(parseYear(r.year_created));
        if (era) eraCounts[era] += 1;

        for (const g of (r.genre ?? []) as string[]) {
          const k = g.trim().toLowerCase();
          if (k) genreCounts.set(k, (genreCounts.get(k) ?? 0) + 1);
        }
      }

      const topSchools = [...schoolCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([k, c]) => ({ key: k, count: c }));

      const topGenres = [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([k, c]) => ({ key: k, count: c }));

      return { topSchools, topGenres, eraCounts };
    },
    staleTime: 1000 * 60 * 30,
  });
}
