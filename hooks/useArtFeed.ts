/**
 * Art reservoir feed hook.
 *
 * Pulls a small random-ish sample of art_works rows for inline display in
 * the main feed. Same slot renders ads (rows with source='ad'), so the art
 * panel doubles as a paid placement when we have inventory.
 *
 * "Random-ish": Postgres ORDER BY random() is fine at this size; once the
 * reservoir grows past ~10k rows we'll switch to TABLESAMPLE.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

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
}

const PAGE_SIZE = 20;

export function useArtFeed() {
  return useQuery({
    queryKey: ['art-feed'],
    queryFn: async (): Promise<ArtWork[]> => {
      // Prefer ads first when available, then real art.
      const { data: ads } = await supabase
        .from('art_works')
        .select('id,source,source_id,title,artist,year_created,storage_path,thumb_path,license,source_url,description,width,height')
        .eq('source', 'ad')
        .limit(5);

      const { data: art, error } = await supabase
        .from('art_works')
        .select('id,source,source_id,title,artist,year_created,storage_path,thumb_path,license,source_url,description,width,height')
        .neq('source', 'ad')
        .limit(PAGE_SIZE);
      if (error) throw error;

      const pool = [...(ads ?? []), ...(art ?? [])] as ArtWork[];
      // shuffle once per fetch so ordering varies
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool;
    },
    staleTime: 1000 * 60 * 10, // 10 min — art doesn't churn
  });
}
