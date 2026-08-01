/**
 * Public/connections feed.
 *
 * Reads from `posts` joined with `profiles` and `post_media`. RLS handles
 * visibility — the query just asks for everything it can see, ordered by
 * recency. Family-scoped posts are filtered out (those live in /family/*).
 *
 * Engagement (hearts) is wired through `post_reactions`.
 *
 * DM drops (visibility='direct', migration 065) ride the same stream.
 * Neither of the two post queries can reach them on its own: the ranked
 * RPC is pinned to visibility='public' and the connections query to
 * visibility='connections'. So page 0 asks for them separately and puts
 * them at the head. RLS returns a direct drop to its author and its one
 * recipient, nobody else.
 *
 * DEGRADE: migration 065 is run by hand. Until it lands there is no
 * 'direct' row to return and no destruct_on_view column to read, the
 * extra query comes back empty, and this feed behaves exactly as it did
 * before this comment existed. Same pattern as useNews / useLineReactions:
 * a failed side read warns once and yields an empty list, never a throw.
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
 * Marks a DM drop spliced onto page 0. It is not part of the server's
 * paging window, so getNextPageParam has to leave it out of the offset
 * or page 2 would skip that many real posts.
 */
const INJECTED = '__direct_injected';

let directWarned = false;
function warnDirectOnce(e: any) {
  if (directWarned) return;
  directWarned = true;
  // eslint-disable-next-line no-console
  console.warn('[feed] direct drops unavailable; migration 065 may not have run', e?.message ?? e);
}

/**
 * Latched off for the session once the schema answers that it has never
 * heard of these columns. Without it every page-0 fetch on an
 * un-migrated database pays for a roundtrip that can only fail.
 *
 * Only schema errors latch. A timeout or a dropped connection leaves the
 * query armed, so a transient blip does not cost the reader their DMs
 * for the rest of the session.
 *   PGRST200  no such relationship (the recipient join)
 *   PGRST204 / 42703  no such column
 *   42P01     no such table
 */
let directOff = false;
const SCHEMA_CODES = new Set(['PGRST200', 'PGRST204', '42703', '42P01']);

/**
 * DM drops the viewer can see: the ones addressed to them, and the ones
 * they sent. No filter on the recipient here on purpose. The posts_read
 * policy already restricts a 'direct' row to author_id and
 * direct_recipient_id, and asking again in the client would only add a
 * second place for the two rules to drift apart.
 *
 * `recipient` is joined off direct_recipient_id so the card can say who
 * the drop went to. Before 065 that column and its foreign key do not
 * exist, PostgREST rejects the select, and this returns an empty list.
 */
async function fetchDirectDrops(): Promise<any[]> {
  if (directOff) return [];
  try {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        author:profiles!author_id(id, handle, display_name, avatar_path),
        recipient:profiles!direct_recipient_id(id, handle, display_name, avatar_path),
        media:post_media(*)
      `)
      .eq('visibility', 'direct')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) {
      if (SCHEMA_CODES.has(String((error as any).code))) directOff = true;
      warnDirectOnce(error);
      return [];
    }
    return (data ?? []).map((p: any) => ({ ...p, [INJECTED]: true }));
  } catch (e) {
    warnDirectOnce(e);
    return [];
  }
}

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
          .neq('visibility', 'family')   // family posts live on /family/[id]
          .eq('visibility', 'connections')
          .order('created_at', { ascending: false })
          .range(pageParam, pageParam + PAGE_SIZE - 1);

        const { data, error } = await q;
        if (error) throw error;
        raw = (data ?? []) as any[];
      }

      // DM drops sit at the head of page 0 and nowhere else, so nothing
      // repeats as the reader pages down. Deduped against the page in
      // case a later query ever returns the same row twice.
      if (pageParam === 0) {
        const direct = await fetchDirectDrops();
        if (direct.length > 0) {
          const already = new Set(raw.map((p: any) => p.id));
          raw = [...direct.filter((d: any) => !already.has(d.id)), ...raw];
        }
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
    // Offsets count server-paged posts only. The spliced DM drops are
    // not in the RPC's window, so including them would advance the
    // offset past that many real posts. With nothing injected this is
    // the original arithmetic, unchanged.
    getNextPageParam: (lastPage, allPages) => {
      const paged = (lastPage as any[]).filter((p: any) => !p?.[INJECTED]);
      if (paged.length < PAGE_SIZE) return undefined;
      return (allPages as any[][]).flat().filter((p: any) => !p?.[INJECTED]).length;
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
            // 'direct' rides both tabs. It is spliced onto page 0 of
            // each, so the connections column has to refetch for it too.
            if (tab === 'connections' && v !== 'connections' && v !== 'direct') return;
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
