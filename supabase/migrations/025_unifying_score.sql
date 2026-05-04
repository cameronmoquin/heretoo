-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 025: Unifying-feed signal v1
-- ════════════════════════════════════════════════════════════════════════
-- Closes pitch claim #6 ("the feed rewards what unites — not what
-- divides"). The chronological feed treats every post equally; the
-- unifying score gently boosts posts that have engaged people across
-- MULTIPLE families (the simplest computable signal of "this brought
-- different groups together").
--
-- v1 is intentionally simple — count distinct families among each
-- post's hearters + commenters. Future versions can add:
--   - cluster diversity (when we ship cluster modeling)
--   - sentiment tilt away from divisive (LLM-flagged)
--   - reply-to-OP ratio (people engaging vs each other)
--
-- The score is exposed via a view post_unifying_scores, and the home
-- feed (visibility='public', tab='for_you') orders by score DESC,
-- created_at DESC. The 'connections' and 'family' tabs stay
-- chronological — those are about who you know, not what unites.
-- ════════════════════════════════════════════════════════════════════════

-- Distinct-families heart engagement
create or replace view public.post_heart_family_diversity as
  select
    pr.post_id,
    count(distinct fm.family_id) as heart_families
  from public.post_reactions pr
  join public.family_members fm
    on fm.profile_id = pr.profile_id
   and fm.status = 'active'
  where pr.reaction_type = 'heart'
  group by pr.post_id;

-- Distinct-families comment engagement
create or replace view public.post_comment_family_diversity as
  select
    c.post_id,
    count(distinct fm.family_id) as comment_families
  from public.comments c
  join public.family_members fm
    on fm.profile_id = c.author_id
   and fm.status = 'active'
  group by c.post_id;

-- Combined unifying score per post.
-- Formula:
--   unifying_score =
--     (2 × heart_families) + (3 × comment_families)
--   - 0.4 × hours_since_posted        -- gentle time decay
--
-- Comments weighted higher than hearts because typing a comment is a
-- bigger commitment than tapping heart. Time decay prevents an old
-- post that picked up cross-family engagement from sitting at the
-- top forever — newer posts with similar diversity catch up.
create or replace view public.post_unifying_scores as
  select
    p.id as post_id,
    coalesce(h.heart_families, 0) as heart_families,
    coalesce(c.comment_families, 0) as comment_families,
    (
      (2.0 * coalesce(h.heart_families, 0)) +
      (3.0 * coalesce(c.comment_families, 0)) -
      (0.4 * extract(epoch from (now() - p.created_at)) / 3600.0)
    )::numeric(10,2) as unifying_score
  from public.posts p
  left join public.post_heart_family_diversity h on h.post_id = p.id
  left join public.post_comment_family_diversity c on c.post_id = p.id
  where p.visibility = 'public';

-- ── Ranked-feed RPC ──────────────────────────────────────────────────
-- Returns public posts ordered by unifying_score DESC, created_at DESC.
-- Same shape as the current feed query so the client can swap in
-- without restructuring. Honors the active_flagged_posts hide list
-- (joins to that view to filter out community-flagged content).
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
  where p.visibility = 'public'
    and (f.post_id is null or p.author_id = auth.uid())
  order by
    coalesce(u.unifying_score, 0) desc,
    p.created_at desc
  limit p_limit
  offset p_offset;
$$;

grant execute on function public.get_unifying_feed(integer, integer) to authenticated;

-- DONE.
