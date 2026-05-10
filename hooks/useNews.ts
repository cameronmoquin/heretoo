/**
 * useNews — public-broadcasting headlines pulled from RSS by the
 * poll-news scheduled function.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface NewsItem {
  id: string;
  source: 'npr' | 'bbc' | 'pbs' | 'apnews';
  source_label: string;
  category: 'global' | 'national' | 'arts' | 'science';
  headline: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  published_at: string;
  fetched_at?: string;
}

export function useNewsFeed(category?: NewsItem['category'] | 'all') {
  return useQuery({
    queryKey: ['news-feed', category ?? 'all'],
    queryFn: async (): Promise<NewsItem[]> => {
      let q = supabase
        .from('news_items')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(60);
      if (category && category !== 'all') q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NewsItem[];
    },
    staleTime: 60_000,
  });
}

/** Today's rotation — one item per category. Used by the Room hearth's
 *  small headline strip. */
export function useTodaysNewsRotation() {
  return useQuery({
    queryKey: ['news-rotation'],
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase.rpc('todays_news_rotation');
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[news] rotation rpc failed', error.message);
        return [];
      }
      return (data ?? []) as NewsItem[];
    },
    staleTime: 5 * 60_000,
  });
}
