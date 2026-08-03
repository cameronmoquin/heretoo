-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 067: crew drops reach the feed
-- ════════════════════════════════════════════════════════════════════════
-- THE BUG. A drop sent to a crew was written correctly and then vanished.
--
-- The composer's crew destination writes visibility='family' (065). The
-- home feed opens on the 'all' chip, which runs get_unifying_feed (025),
-- and that function filters `where p.visibility = 'public'`. So the row
-- landed in `posts`, posts_read would have handed it to every active
-- member of that crew, and the one query that could have asked for it
-- never did. It appeared only under the Crew chip, which sidesteps the
-- RPC with a direct visibility='family' select.
--
-- 065 fixed the send. This fixes the read. Nothing about how a drop is
-- written changes here.
--
-- SCOPE. Two visibilities reach the ranked feed now: 'public' and
-- 'family'. Not 'private', which is the author's own. Not 'direct' —
-- DM drops are spliced onto page 0 by the client (see hooks/useFeed.ts,
-- fetchDirectDrops) and that path already works; folding them in here
-- would leave two mechanisms doing one job.
--
-- SECURITY. The function stays `security invoker`, so posts_read decides
-- what a caller actually gets back. That policy already scopes a family
-- row to active members of that crew and honors update_recipient_ids.
-- This migration widens what the feed ASKS for; it does not widen what
-- anyone is allowed to see.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. The ranked feed, both visibilities ────────────────────────────
-- kind='post' on the crew branch on purpose. Updates are a separate
-- instrument with their own tab (hooks/useFamily.ts filters the crew
-- feed to kind='post' and the updates feed to kind='update'), and the
-- home column should not be the third place they show up. `kind` is
-- `not null default 'post'` since 011, so no legacy row is dropped by
-- this clause.
--
-- THE SCORE. post_unifying_scores is deliberately NOT extended to cover
-- family posts. That view carries post_ids with per-post engagement
-- counts, and a view is definer-rights by default, so widening it would
-- turn it into a readable side channel for crew activity — the same
-- shape of mistake migration 059 had to clean up. Instead a family post
-- falls back to the score the 025 formula would give it with zero
-- cross-crew engagement: the bare time-decay term. A crew drop therefore
-- competes on pure recency against public posts nobody has engaged with,
-- and a public post that genuinely united several crews still outranks
-- both. The ranker keeps meaning what it meant.
create or replace function public.get_unifying_feed(
  p_limit integer default 20,
  p_offset integer default 0
)
returns setof public.posts
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.posts p
  left join public.post_unifying_scores u on u.post_id = p.id
  left join public.active_flagged_posts f on f.post_id = p.id
  where (
      p.visibility = 'public'
      or (p.visibility = 'family' and p.kind = 'post')
    )
    and (f.post_id is null or p.author_id = auth.uid())
  order by
    coalesce(
      u.unifying_score,
      (-0.4 * extract(epoch from (now() - p.created_at)) / 3600.0)::numeric(10,2)
    ) desc,
    p.created_at desc
  limit p_limit
  offset p_offset;
$$;


-- ── 2. The index the widened predicate wants ─────────────────────────
-- 001 indexed (author_id, created_at) and (family_id, created_at); 011
-- added (family_id, kind, created_at). Nothing covered visibility, which
-- was fine while the predicate was a single equality against the most
-- common value. It now spans two.
create index if not exists posts_visibility_created_idx
  on public.posts(visibility, created_at desc);


-- ── 3. Grants ────────────────────────────────────────────────────────
-- `create or replace function` preserves whatever grants the old
-- definition carried, so they are restated rather than assumed.
--
-- All three roles are named. Revoking from `public` and `authenticated`
-- alone leaves a direct grant to `anon` in place — PostgREST connects as
-- `anon` for unauthenticated requests and Supabase grants EXECUTE to it
-- directly, not only through PUBLIC. That is exactly how three earlier
-- functions ended up callable from the open internet before 059. This
-- one is `security invoker` and posts_read is `to authenticated`, so an
-- anon caller would read nothing anyway, but the habit is the point.
--
-- Nothing reachable while signed out calls this: app/(tabs)/_layout.tsx
-- redirects a sessionless viewer to /(auth)/welcome before the feed
-- mounts.
revoke all on function public.get_unifying_feed(integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_unifying_feed(integer, integer)
  to authenticated;


-- ── 4. Verify ────────────────────────────────────────────────────────
-- Locked to signed-in callers. With the publishable anon key:
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     -X POST "$SUPABASE_URL/rest/v1/rpc/get_unifying_feed" \
--     -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
--     -d '{"p_limit":1,"p_offset":0}'
--
-- 401 or 404 is correct. 200 with rows means step 3 did not take.
--
-- Then, signed in as a crew member, drop to a crew and confirm the row
-- comes back on the 'all' chip rather than only under Crew.

-- DONE.
