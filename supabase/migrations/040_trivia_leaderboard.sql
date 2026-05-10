-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 040: Cross-family trivia leaderboard
-- ════════════════════════════════════════════════════════════════════════
-- A friendly bowling league across families. Each family appears as a
-- single row — its members' aggregate correct count is the score.
-- Family NAMES are exposed across the platform here; individual member
-- scores stay private to the family.
--
-- Per-family opt-out:
--   - families.trivia_public boolean (default true) lets a family
--     owner remove the family from the standings without leaving
--     trivia itself disabled. Useful for families that want to play
--     internally without exposing their family name.
--
-- Refusal list (still):
--   - No individual user leaderboard across families. The unit of
--     comparison is the family, not the person.
--   - No prizes, no badges, no "rank-up" notifications.
--   - No "X family is on a 5-day streak" mechanics.
-- ════════════════════════════════════════════════════════════════════════

alter table public.families
  add column if not exists trivia_public boolean not null default true;

-- Aggregate per-family stats. Used by the standings view.
-- Anyone signed in can read; we just expose family names + numbers.

create or replace function public.trivia_family_leaderboard(
  p_limit int default 25
) returns table (
  family_id        uuid,
  family_name      text,
  correct_count    bigint,
  total_count      bigint,
  contributors     int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    f.name,
    count(*) filter (where ta.was_correct)::bigint,
    count(*)::bigint,
    count(distinct ta.player_id)::int
  from public.families f
  join public.trivia_questions q on q.family_id = f.id
  join public.trivia_attempts ta on ta.question_id = q.id
  where f.trivia_public = true
  group by f.id, f.name
  having count(*) > 0
  order by
    count(*) filter (where ta.was_correct) desc,
    count(*) desc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.trivia_family_leaderboard(int) to authenticated;

-- The viewer's family rank — used to render "you are #N of X" in
-- the trivia panel without scanning the whole leaderboard client-side.

create or replace function public.trivia_family_rank(p_family_id uuid)
returns table (
  rank          int,
  total_families int,
  correct_count bigint,
  total_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select
      f.id,
      count(*) filter (where ta.was_correct)::bigint as correct,
      count(*)::bigint as total
    from public.families f
    join public.trivia_questions q on q.family_id = f.id
    join public.trivia_attempts ta on ta.question_id = q.id
    where f.trivia_public = true
    group by f.id
  ),
  ranked as (
    select
      id,
      correct,
      total,
      rank() over (order by correct desc, total desc) as r
    from scored
  )
  select
    coalesce((select r from ranked where id = p_family_id)::int, 0),
    (select count(*) from ranked)::int,
    coalesce((select correct from ranked where id = p_family_id), 0::bigint),
    coalesce((select total from ranked where id = p_family_id), 0::bigint);
$$;

grant execute on function public.trivia_family_rank(uuid) to authenticated;

-- DONE.
