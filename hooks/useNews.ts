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

// useTodaysNewsRotation was removed with the ornate Room view. It fed that
// screen's headline strip and had no other caller. The todays_news_rotation
// RPC it wrapped is still in the database, unused.
