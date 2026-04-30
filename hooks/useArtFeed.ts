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
  medium?: string | null;
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
  const mediums = useArtPrefs((s) => s.mediums);
  const sources = useArtPrefs((s) => s.sources);
  const feedMix = useArtPrefs((s) => s.feedMix);

  return useQuery({
    queryKey: ['art-feed', schools, eras, genres, mediums, sources, feedMix],
    queryFn: async (): Promise<ArtWork[]> => {
      // posts_only: don't even fetch art. The components that consume
      // this hook will see an empty array and skip rendering their
      // slots entirely.
      if (feedMix === 'posts_only') return [];

      // art_only: skip the ad sub-query so source='ad' rows never enter the pool.
      const wantAds = feedMix === 'art_and_ads';

      const ads = wantAds
        ? (await supabase
            .from('art_works')
            .select('id,source,source_id,title,artist,year_created,storage_path,thumb_path,license,source_url,description,width,height,school,genre,medium')
            .eq('source', 'ad')
            .limit(20)).data ?? []
        : [];

      const { data: art, error } = await supabase
        .from('art_works')
        .select('id,source,source_id,title,artist,year_created,storage_path,thumb_path,license,source_url,description,width,height,school,genre,medium')
        .neq('source', 'ad')
        .limit(POOL_SIZE);
      if (error) throw error;

      const fullPool = [...ads, ...(art ?? [])] as ArtWork[];

      // Apply prefs. Empty selections == "no filter on that axis".
      const erasSet = new Set<ArtEra>(eras);
      const schoolsSet = new Set(schools.map((x) => x.toLowerCase()));
      const genresSet = new Set(genres.map((x) => x.toLowerCase()));
      const mediumsSet = new Set(mediums.map((x) => x.toLowerCase()));
      const sourcesSet = new Set(sources.map((x) => x.toLowerCase()));
      const filtersActive =
        erasSet.size + schoolsSet.size + genresSet.size + mediumsSet.size + sourcesSet.size > 0;

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
        if (mediumsSet.size > 0) {
          const m = (w.medium ?? '').toLowerCase();
          // Substring-match each selected medium token so "oil on canvas"
          // and "oil paint" both pass when "oil" is the chosen filter.
          const hit = [...mediumsSet].some((token) => m.includes(token));
          if (!hit) return false;
        }
        if (sourcesSet.size > 0) {
          if (!sourcesSet.has((w.source ?? '').toLowerCase())) return false;
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

/** Distinct facet counts for the prefs UI. */
export function useArtFacets() {
  return useQuery({
    queryKey: ['art-facets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('art_works')
        .select('school, year_created, genre, medium, source')
        .neq('source', 'ad')
        .limit(2000);
      if (error) throw error;

      const schoolCounts = new Map<string, number>();
      const eraCounts: Record<ArtEra, number> = {
        antiquity: 0, medieval: 0, renaissance: 0, baroque: 0,
        nineteenth: 0, modern: 0, contemporary: 0,
      };
      const genreCounts = new Map<string, number>();
      const mediumCounts = new Map<string, number>();
      const sourceCounts = new Map<string, number>();

      for (const r of (data ?? []) as any[]) {
        const sch = normalizeSchool(r.school);
        if (sch) schoolCounts.set(sch, (schoolCounts.get(sch) ?? 0) + 1);

        const era = yearToEra(parseYear(r.year_created));
        if (era) eraCounts[era] += 1;

        for (const g of (r.genre ?? []) as string[]) {
          const k = (g ?? '').trim().toLowerCase();
          if (k) genreCounts.set(k, (genreCounts.get(k) ?? 0) + 1);
        }

        // Mediums: museum strings are messy ("oil on canvas",
        // "Oil paintings (visual works)", "oil paint"). Bucket by the
        // first significant word so "oil" / "marble" / "wood" emerge.
        const med = (r.medium ?? '').toLowerCase().trim();
        if (med) {
          const top = med.split(/[\s,;()]+/).find((tok: string) => tok.length > 2) ?? med;
          mediumCounts.set(top, (mediumCounts.get(top) ?? 0) + 1);
        }

        const src = (r.source ?? '').toLowerCase().trim();
        if (src) sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
      }

      const topN = (m: Map<string, number>, n: number) =>
        [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
          .map(([k, c]) => ({ key: k, count: c }));

      return {
        topSchools: topN(schoolCounts, 14),
        topGenres: topN(genreCounts, 14),
        topMediums: topN(mediumCounts, 14),
        sources: topN(sourceCounts, 10),
        eraCounts,
      };
    },
    staleTime: 1000 * 60 * 30,
  });
}
