/**
 * Public/connections feed.
 *
 * Reads from `posts` joined with `profiles` and `post_media`. RLS handles
 * visibility — the query just asks for everything it can see, ordered by
 * recency.
 *
 * CREW DROPS RIDE THIS STREAM (migration 067). The ranked RPC used to be
 * pinned to visibility='public', so a drop sent to a crew was written and
 * then reachable only under the Crew chip. It now returns 'public' plus
 * 'family' of kind='post', scoped by posts_read to crews the viewer is an
 * active member of. Crew updates (kind='update') stay out; they have
 * their own tab under /family/[id].
 *
 * Engagement (hearts) is wired through `post_reactions`.
 *
 * DMs DO NOT RIDE THIS STREAM. A direct drop is conversation, not
 * feed — it renders inside its message thread and nowhere else. The
 * page-0 splice that used to put DMs at the head of the feed is gone
 * (Aug 2026, Cameron's rule: all DM sends land in the Messenger).
 */

import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { DEV_MODE } from '../lib/dev-mode';
import { MOCK_POSTS } from '../lib/mock-data';
import { useAuthStore } from '../stores/authStore';

const PAGE_SIZE = 20;

export type FeedTab = 'for_you' | 'connections';

/**
 * @param crewOnly When the Crew chip is selected the column shows crew
 *   drops. Without this the chip only suppressed the side rails while the
 *   query stayed pinned to public, so a drop sent to a crew landed
 *   nowhere the author was looking. RLS already limits family rows to
 *   crews the viewer belongs to, so no extra filter is needed here.
 */
export function useFeed(tab: FeedTab = 'for_you', crewOnly = false) {
  const userId = useAuthStore((s) => s.user?.id);

  return useInfiniteQuery({
    queryKey: ['feed', tab, crewOnly ? 'crew' : 'all', userId],
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
      if (crewOnly) {
        // Crew drops, newest first. RLS scopes these to the viewer's own
        // crews, so this needs no membership clause.
        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            author:profiles!author_id(id, handle, display_name, avatar_path),
            media:post_media(*)
          `)
          .eq('visibility', 'family')
          // Same rule as the ranked RPC (067): updates are a crew
          // instrument with their own tab, and the feed is not the third
          // place they show up. Without this the two lenses disagreed.
          .eq('kind', 'post')
          .order('created_at', { ascending: false })
          .range(pageParam, pageParam + PAGE_SIZE - 1);
        if (error) throw error;
        raw = (data ?? []) as any[];
      } else if (tab === 'for_you') {
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
        // reaction_type filter matters now that post_reactions also
        // holds line reactions. Without it, firing a Shakespeare line
        // at a post would light up the heart as well.
        const { data: reactions } = await supabase
          .from('post_reactions')
          .select('post_id, reaction_type')
          .eq('profile_id', userId)
          .eq('reaction_type', 'heart')
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
      if ((lastPage as any[]).length < PAGE_SIZE) return undefined;
      return (allPages as any[][]).flat().length;
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
            if (v === 'private') return;
            // 'family' rides the for_you column now (migration 067). It
            // used to return here, which was correct while the ranked
            // RPC could not see a crew drop and wrong the moment it
            // could. RLS decides whether the refetch actually returns
            // the row; this only decides whether to ask.
            if (tab === 'connections' && v !== 'connections' && v !== 'direct') return;
            // Prefix only. The real key carries the crew lens between
            // the tab and the user — ['feed', tab, 'all' | 'crew',
            // userId] — so ['feed', tab, userId] matched neither of them
            // and no INSERT has invalidated this feed since the lens was
            // added. Stopping at the tab matches both.
            qc.invalidateQueries({ queryKey: ['feed', tab] });
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
