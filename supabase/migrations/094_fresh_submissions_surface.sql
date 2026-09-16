-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 094: a fresh submission is allowed to exist
-- ════════════════════════════════════════════════════════════════════════
-- "The entries don't stay on the feed when submitted."
--
-- They were never deleted — they were buried at birth. The For You
-- ranker orders by unifying score, and a post nobody has engaged with
-- yet HAS no score: it fell back to a pure age penalty (−0.4/hour), so
-- the moment the optimistic card was replaced by a real refetch, the
-- new submission ranked under everything that had ever earned a heart
-- and slid off page one.
--
-- The fix is a freshness bonus that fades: a new post starts at +12 —
-- ahead of nearly all standing engagement — loses a point an hour, and
-- is gone in twelve. After that the post lives or dies by its unifying
-- score exactly as before. Nothing about the doctrine changes; the
-- doctrine simply stops applying to posts too young to have been read.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

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
    (
      coalesce(
        u.unifying_score,
        (-0.4 * extract(epoch from (now() - p.created_at)) / 3600.0)::numeric(10,2)
      )
      + greatest(
          0,
          12 - extract(epoch from (now() - p.created_at)) / 3600.0
        )::numeric(10,2)
    ) desc,
    p.created_at desc
  limit p_limit
  offset p_offset;
$$;

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   insert a post, then: select id, created_at from get_unifying_feed(5,0);
--   → the new post is in the first rows, and still there on refresh.
-- DONE.
