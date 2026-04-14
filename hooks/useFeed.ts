import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { MOCK_POSTS } from '../lib/mock-data';
import { checkRateLimit } from '../lib/moderation';
import { useFeedStore, type EngagementType, type FeedTab, type Post } from '../stores/feedStore';
import { useAuthStore } from '../stores/authStore';

const PAGE_SIZE = 20;

export function useFeed(tab: FeedTab = 'for_you') {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const query = useInfiniteQuery({
    queryKey: ['feed', tab],
    queryFn: async ({ pageParam = 0 }) => {
      if (DEV_MODE) {
        const sorted = tab === 'bridging'
          ? [...MOCK_POSTS].sort((a, b) => b.bridging_score - a.bridging_score)
          : MOCK_POSTS;
        return sorted.slice(pageParam, pageParam + PAGE_SIZE);
      }

      // Try real data first, fall back to mock if empty
      let q = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(username, display_name, avatar_url, cluster_id)
        `)
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (tab === 'bridging') {
        q = q.order('bridging_score', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;

      let postsWithEngagements = data as Post[];
      if (userId && data.length > 0) {
        const postIds = data.map((p: any) => p.id);
        const { data: engagements } = await supabase
          .from('engagements')
          .select('post_id, engagement_type')
          .eq('user_id', userId)
          .in('post_id', postIds);

        if (engagements) {
          const engagementMap = new Map<string, string[]>();
          for (const e of engagements) {
            const existing = engagementMap.get(e.post_id) ?? [];
            existing.push(e.engagement_type);
            engagementMap.set(e.post_id, existing);
          }
          postsWithEngagements = data.map((p: any) => ({
            ...p,
            user_engagements: engagementMap.get(p.id) ?? [],
          }));
        }
      }

      return postsWithEngagements;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });

  return query;
}

export function useToggleEngagement() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async ({
      postId,
      type,
    }: {
      postId: string;
      type: EngagementType;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      if (DEV_MODE) {
        // Toggle in mock data — just return success
        return { action: 'added' as const, type };
      }

      const rateCheck = await checkRateLimit('engage');
      if (!rateCheck.allowed) throw new Error(rateCheck.reason ?? 'Rate limited');

      const { data: existing } = await supabase
        .from('engagements')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('engagement_type', type)
        .single();

      if (existing) {
        await supabase.from('engagements').delete().eq('id', existing.id);
        return { action: 'removed' as const, type };
      } else {
        await supabase.from('engagements').insert({
          post_id: postId,
          user_id: userId,
          engagement_type: type,
        });
        return { action: 'added' as const, type };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
