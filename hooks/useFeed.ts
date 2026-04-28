/**
 * Public/connections feed.
 *
 * Reads from `posts` joined with `profiles` and `post_media`. RLS handles
 * visibility — the query just asks for everything it can see, ordered by
 * recency. Family-scoped posts are filtered out (those live in /family/*).
 *
 * Engagement (hearts) is wired through `post_reactions`.
 */

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { MOCK_POSTS } from '../lib/mock-data';
import { useAuthStore } from '../stores/authStore';

const PAGE_SIZE = 20;

export type FeedTab = 'for_you' | 'connections';

export function useFeed(tab: FeedTab = 'for_you') {
  const userId = useAuthStore((s) => s.user?.id);

  return useInfiniteQuery({
    queryKey: ['feed', tab, userId],
    queryFn: async ({ pageParam = 0 }) => {
      if (DEV_MODE) {
        return MOCK_POSTS.slice(pageParam, pageParam + PAGE_SIZE);
      }

      let q = supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(id, handle, display_name, avatar_path),
          media:post_media(*)
        `)
        .neq('visibility', 'family')   // family posts live on /family/[id]
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (tab === 'connections') {
        q = q.eq('visibility', 'connections');
      }

      const { data, error } = await q;
      if (error) throw error;

      // Enrich with viewer's reactions if signed in
      let posts = (data ?? []) as any[];
      if (userId && posts.length > 0) {
        const postIds = posts.map((p) => p.id);
        const { data: reactions } = await supabase
          .from('post_reactions')
          .select('post_id, reaction_type')
          .eq('profile_id', userId)
          .in('post_id', postIds);
        const set = new Set((reactions ?? []).map((r: any) => r.post_id));
        posts = posts.map((p) => ({ ...p, viewer_hearted: set.has(p.id) }));
      }
      return posts;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['family-feed'] });
    },
  });
}

export function useToggleHeart() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('profile_id', userId)
        .eq('reaction_type', 'heart')
        .maybeSingle();

      if (existing) {
        await supabase.from('post_reactions').delete().eq('id', existing.id);
        return { action: 'removed' as const };
      }
      await supabase.from('post_reactions').insert({
        post_id: postId,
        profile_id: userId,
        reaction_type: 'heart',
      });
      return { action: 'added' as const };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
