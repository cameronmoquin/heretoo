/**
 * Public/connections feed.
 *
 * Reads from `posts` joined with `profiles` and `post_media`. RLS handles
 * visibility — the query just asks for everything it can see, ordered by
 * recency. Family-scoped posts are filtered out (those live in /family/*).
 *
 * Engagement (hearts) is wired through `post_reactions`.
 */

import { useEffect } from 'react';
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

      // The "For You" tab uses the unifying-score ranker (migration 025):
      // posts are ordered by cross-family engagement (distinct families
      // among hearters + commenters) instead of pure chronology. The
      // RPC returns the same `posts` row shape so the rest of this
      // function (viewer-hearted enrichment, flagged filter) doesn't
      // need to change. Connections tab keeps chronological order
      // since it's about who you know, not what unites.
      let raw: any[] = [];
      if (tab === 'for_you') {
        const { data, error } = await supabase.rpc('get_unifying_feed', {
          p_limit: PAGE_SIZE,
          p_offset: pageParam,
        });
        if (error) throw error;
        raw = (data ?? []) as any[];

        // Hydrate joined fields (author, media) — RPC returns just the
        // posts row. Cheap second roundtrip; we already do this for the
        // chronological path implicitly via PostgREST's join syntax.
        if (raw.length > 0) {
          const ids = raw.map((p) => p.id);
          const { data: enriched } = await supabase
            .from('posts')
            .select('id, author:profiles!author_id(id, handle, display_name, avatar_path), media:post_media(*)')
            .in('id', ids);
          const byId = new Map<string, any>((enriched ?? []).map((p: any) => [p.id, p]));
          raw = raw.map((p) => ({ ...p, ...(byId.get(p.id) ?? {}) }));
        }
      } else {
        let q = supabase
          .from('posts')
          .select(`
            *,
            author:profiles!author_id(id, handle, display_name, avatar_path),
            media:post_media(*)
          `)
          .neq('visibility', 'family')   // family posts live on /family/[id]
          .eq('visibility', 'connections')
          .order('created_at', { ascending: false })
          .range(pageParam, pageParam + PAGE_SIZE - 1);

        const { data, error } = await q;
        if (error) throw error;
        raw = (data ?? []) as any[];
      }
      const data = raw;
      const error = null as any;
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

        // Filter out content the community has flagged. The view returns
        // post_ids that have ≥3 distinct flaggers and aren't review-rejected.
        // Authors still see their own posts (so they're not gaslit out of
        // their own thread) — they'll just notice nobody else is engaging.
        const { data: flagged } = await supabase
          .from('active_flagged_posts')
          .select('post_id')
          .in('post_id', postIds);
        const hidden = new Set((flagged ?? []).map((r: any) => r.post_id));
        if (hidden.size > 0) {
          posts = posts.filter((p) => !hidden.has(p.id) || p.author_id === userId);
        }
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

/**
 * Subscribe to new public posts in real time. When the channel receives
 * an INSERT for a post that isn't visibility='family' (those have their
 * own feed channel inside useFamilyFeed), we invalidate the feed query
 * so it refetches the head of the list. Cheap because the postgres_changes
 * stream is filtered server-side.
 */
export function useFeedRealtime(tab: FeedTab) {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (DEV_MODE) return;

    // Unique channel name per mount avoids the Supabase Realtime
    // crash that surfaced as "Something broke. cannot add
    // postgres_changes callbacks for realtime:feed-for_you after
    // subscribe()." When a user navigates away and back, the cached
    // channel-by-name still has subscribe() called on it, so adding
    // a new listener throws. A random suffix sidesteps the cache.
    const suffix = Math.random().toString(36).slice(2, 10);
    const channelName = `feed-${tab}-${suffix}`;
    let channel: any;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'posts' },
          (payload: any) => {
            const v = payload?.new?.visibility;
            if (v === 'family' || v === 'private') return;
            if (tab === 'connections' && v !== 'connections') return;
            qc.invalidateQueries({ queryKey: ['feed', tab, userId] });
          },
        )
        .subscribe();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[feed-realtime] subscribe failed; live updates off', e);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {}
    };
  }, [qc, tab, userId]);
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
        post_id: postId, profile_id: userId, reaction_type: 'heart',
      });
      return { action: 'added' as const };
    },
    // Optimistic UI: flip the icon + counter on the next paint, before
    // the server confirms. If the call fails, onError rolls it back.
    //
    // Cache prefixes: tap-heart on a post that lives in family-feed
    // wouldn't update visually if we only touched ['feed'] — the family
    // feed has its own cache key. Same for updates / connections /
    // profile-posts. Mirror the pattern used by bumpCommentCount.
    onMutate: async (postId: string) => {
      const PREFIXES = [
        ['feed'],
        ['family-feed'],
        ['family-updates'],
        ['connections-feed'],
        ['profile-posts'],
        ['home-feed'],
      ];

      // Cancel + snapshot every relevant cache so we can roll back on error.
      const snapshot: Array<[unknown, unknown]> = [];
      for (const prefix of PREFIXES) {
        await queryClient.cancelQueries({ queryKey: prefix });
        const entries = queryClient.getQueriesData({ queryKey: prefix });
        snapshot.push(...entries);
      }

      const flip = (post: any) => {
        if (!post || post.id !== postId) return post;
        const wasHearted = !!post.viewer_hearted;
        return {
          ...post,
          viewer_hearted: !wasHearted,
          heart_count: Math.max(0, (post.heart_count ?? 0) + (wasHearted ? -1 : 1)),
        };
      };

      const updateCache = (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) return old.map(flip);
        // Infinite-query (pages) structure — paginated feeds.
        if (old.pages && Array.isArray(old.pages)) {
          return {
            ...old,
            pages: old.pages.map((p: any) =>
              Array.isArray(p) ? p.map(flip) : { ...p, posts: (p.posts ?? []).map(flip) },
            ),
          };
        }
        return old;
      };

      for (const prefix of PREFIXES) {
        queryClient.setQueriesData({ queryKey: prefix }, updateCache);
      }
      // Single-post detail page caches the post directly.
      queryClient.setQueriesData({ queryKey: ['post', postId] }, flip);

      return { snapshot };
    },
    onError: (_err, _postId, ctx: any) => {
      if (ctx?.snapshot) {
        ctx.snapshot.forEach(([key, data]: any) => queryClient.setQueryData(key, data));
      }
    },
    onSettled: () => {
      // Refetch all feed flavors so the server's authoritative state
      // catches up if anything drifted (e.g., other clients heart-ed
      // the same post in the same window).
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['family-feed'] });
      queryClient.invalidateQueries({ queryKey: ['family-updates'] });
      queryClient.invalidateQueries({ queryKey: ['connections-feed'] });
      queryClient.invalidateQueries({ queryKey: ['profile-posts'] });
    },
  });
}
