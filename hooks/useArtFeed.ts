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
  useArtPrefs, parseYear, yearToEra, normalizeSchool, ERA_RANGES, type ArtEra,
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

// Reservoir is now bigger (Smithsonian + Rijks + Met + AIC + CMA = a few
// thousand rows). We pull a generous pool and filter client-side because
// year_created / school / medium are all messy free-form text that JS
// normalizes more reliably than SQL. The pool size matters: if we cap
// at 1000 and Supabase's default order happens to put all Met antique
// rows first, picking "Contemporary" can match zero rows out of the
// fetched 1000 even when the table has thousands of contemporary works.
// Bumped to 5000 so the user's filter actually sees the whole gallery.
const POOL_SIZE = 5000;

/**
 * Schema errors that mean migration 069 has not run yet: no such column
 * (PGRST204 / 42703). Anything else is a real failure and is rethrown.
 */
const ART_SCHEMA_CODES = new Set(['PGRST204', '42703']);

let yearStartWarned = false;
function warnYearStartOnce(e: any) {
  if (yearStartWarned) return;
  yearStartWarned = true;
  // eslint-disable-next-line no-console
  console.warn(
    '[art] year_start missing; era filtering fell back to the client pool. Run migration 069.',
    e?.message ?? e,
  );
}

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

      // ERA IS FILTERED IN SQL (migration 069). It used to be bucketed
      // in JS off parseYear(year_created), which meant an era could only
      // ever choose from whatever POOL_SIZE rows came back — about 5% of
      // a 104,000-work gallery — so a narrow era returned a handful of
      // pieces while thousands sat unqueried. year_start is a real
      // integer now, so the range goes to the database and the pool is
      // 5000 rows OF THE CHOSEN ERAS rather than 5000 rows of anything.
      //
      // Works whose date string parsed to nothing have a null
      // year_start and drop out of an era filter, exactly as they did
      // when yearToEra returned null for them.
      const COLS = 'id,source,source_id,title,artist,year_created,storage_path,thumb_path,license,source_url,description,width,height,school,genre,medium';

      // One OR across the selected eras' [start, end] ranges.
      const eraClauses = eras
        .map((e) => ERA_RANGES[e])
        .filter(Boolean)
        .map(([lo, hi]) => `and(year_start.gte.${lo},year_start.lte.${hi})`);

      // Genre goes to the database too (GIN index, migration 069).
      // Client-side it was hopeless for the poster rule: 942 posters in
      // 104,183 works means a random 5000-row pool holds about 45 of
      // them, so the gallery would have looked broken rather than
      // curated.
      const base = () => {
        let q = supabase.from('art_works').select(COLS).neq('source', 'ad');
        if (genres.length > 0) q = q.overlaps('genre', genres);
        return q;
      };

      let art: any[] | null = null;
      // DEGRADE, same pattern as useFeed's direct-drop read: migration
      // 069 is run by hand, and until it lands there is no year_start
      // column. Rather than throw and blank every art slot in the app,
      // a schema error falls back to the old behaviour — unfiltered
      // pool, eras bucketed in JS. Only schema codes fall back; a
      // timeout still surfaces as an error rather than silently
      // downgrading the gallery for the rest of the session.
      let eraFilteredInSql = eraClauses.length > 0;
      if (eraFilteredInSql) {
        const res = await base().or(eraClauses.join(',')).limit(POOL_SIZE);
        if (res.error) {
          if (!ART_SCHEMA_CODES.has(String((res.error as any).code))) throw res.error;
          warnYearStartOnce(res.error);
          eraFilteredInSql = false;
        } else {
          art = res.data as any[];
        }
      }
      if (art === null) {
        const res = await base().limit(POOL_SIZE);
        if (res.error) throw res.error;
        art = res.data as any[];
      }

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
        // Era is normally applied in SQL, and re-checking it here would
        // be worse than redundant: the SQL parser and parseYear disagree
        // on the awkward strings, so a work the query correctly returned
        // could be discarded for failing a second, different opinion of
        // its own date. This runs only on the pre-069 fallback path,
        // where nothing filtered by era at all.
        if (!eraFilteredInSql && erasSet.size > 0) {
          const era = yearToEra(parseYear(w.year_created));
          if (!era || !erasSet.has(era)) return false;
        }
        if (schoolsSet.size > 0) {
          const sch = normalizeSchool(w.school) ?? '';
          if (!schoolsSet.has(sch)) return false;
        }
        // Genre is applied in SQL now — see base(). Re-checking here
        // would only re-implement `overlaps` with a case-fold the
        // database did not do, and drop rows the query correctly
        // returned.
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

      // Honest empty: previously we silently fell back to the unfiltered
      // pool whenever a filter combo matched zero rows. That made the
      // filter look broken — the user picks "Contemporary + Sculpture"
      // and sees the same Renaissance paintings as before, with no
      // signal that anything happened. Now we return the genuinely
      // empty pool. ArtSlot / ArtBanner already short-circuit on empty
      // so the slots simply disappear; the prefs UI surfaces the
      // "0 matches" hint via the totalCount returned alongside.

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

/**
 * "Did the user's filter combo match anything?" Used by the prefs UI
 * to flag combinations that produce 0 rows — distinct from "no filters
 * active, just a sparse gallery."
 *
 * Returns: { active: bool, matched: number, total: number }.
 *   - active=false: no filters set; matched=total
 *   - active=true, matched=0: feedback the UI surfaces ("no art matches…")
 *   - active=true, matched>0: ordinary state, no special UI
 */
export function useArtFilterStatus() {
  const schools = useArtPrefs((s) => s.schools);
  const eras = useArtPrefs((s) => s.eras);
  const genres = useArtPrefs((s) => s.genres);
  const mediums = useArtPrefs((s) => s.mediums);
  const sources = useArtPrefs((s) => s.sources);
  const { data, isLoading } = useArtFeed();

  const active =
    schools.length + eras.length + genres.length + mediums.length + sources.length > 0;
  const matched = data?.length ?? 0;
  return { active, matched, isLoading };
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
