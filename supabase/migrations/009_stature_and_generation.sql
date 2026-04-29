-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 009: Family stature + generation
-- ════════════════════════════════════════════════════════════════════════
-- Adds structured "where in the family tree am I?" data to family_members
-- so we can render avatars that telegraph stature at a glance:
--
--   M^2 ₅₃     ← Matriarch, two generations above the youngest, 53 connections
--
-- The avatar character is the first letter of the highest stature the
-- person holds across all their families. The superscript is the maximum
-- generation gap they hold in any single family (how many steps they sit
-- above the youngest member). The subscript is total reachable people in
-- their 3-hop family network.
--
-- `stature` is a controlled enum so the UI knows which letter to render
-- and so we can rank consistently. `generation` is an int where 0 is the
-- youngest tip and increases upward.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Stature enum — ranked by elder-to-younger.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'family_stature') then
    create type public.family_stature as enum (
      'matriarch',   -- M
      'patriarch',   -- P
      'elder',       -- E
      'parent',      -- A (Adult)
      'guardian',    -- G
      'sibling',     -- S
      'offspring',   -- O
      'child'        -- C
    );
  end if;
end$$;

-- 2. Add columns to family_members.
alter table public.family_members
  add column if not exists stature public.family_stature,
  add column if not exists generation int;

create index if not exists family_members_stature_idx on public.family_members(stature);
create index if not exists family_members_generation_idx on public.family_members(generation);

-- 3. Backfill: every existing member gets 'parent' / generation=1 by
--    default unless they're the family owner (-> 'matriarch' / 2).
update public.family_members fm
set
  stature = coalesce(fm.stature,
    case when fm.relationship_label = 'owner' then 'matriarch'::public.family_stature
         else 'parent'::public.family_stature
    end),
  generation = coalesce(fm.generation,
    case when fm.relationship_label = 'owner' then 2 else 1 end)
where stature is null or generation is null;

-- 4. Helper: the viewer's most senior stature + maximum generation gap +
--    total 3-hop network reach. Used by the StatureAvatar component
--    when rendering someone else's avatar (or your own).
create or replace function public.profile_stature_summary(target uuid)
returns table (
  stature public.family_stature,
  generation int,
  network_reach int
)
language sql stable security definer
set search_path = public
as $$
  with
    -- Rank stature by enum ordinal (lower ordinal = more senior).
    target_memberships as (
      select fm.stature, fm.generation
      from public.family_members fm
      where fm.profile_id = target
        and fm.status = 'active'
    ),
    -- Highest stature = lowest enum ordinal. Postgres orders enum
    -- columns by their declared definition order, not alphabetically.
    top_stature as (
      select stature
      from target_memberships
      where stature is not null
      order by stature asc
      limit 1
    ),
    -- Maximum generation gap held in any family.
    max_gen as (
      select coalesce(max(generation), 0) as g from target_memberships
    ),
    -- Their 3-hop network excludes themselves.
    reach_count as (
      select count(*)::int - 1 as c
      from public.family_network_reach(target, 3)
    )
  select
    (select stature from top_stature),
    (select g from max_gen),
    coalesce((select c from reach_count), 0);
$$;

grant execute on function public.profile_stature_summary(uuid) to authenticated;

-- DONE.
