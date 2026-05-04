-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 023: family-wallpaper voting
-- ════════════════════════════════════════════════════════════════════════
-- Closes the design idea from earlier in development: each family page
-- has its own "room wallpaper" that's voted on by the active members
-- of that family. Default = whatever the family OWNER has chosen on
-- their personal wallpaper (their "house"). Once members vote, the
-- effective wallpaper becomes the plurality choice.
--
-- Schema:
--   family_wallpaper_votes  one vote per (family, profile)
--   - family_id      FK to families
--   - profile_id     FK to profiles
--   - wallpaper_id   text — matches WALLPAPERS map keys in
--                    stores/wallpaperStore.ts
--   - voted_at       timestamptz
--   primary key (family_id, profile_id) so each member has at most
--   one current vote (UPSERT updates).
--
-- RLS: only active members of the family can read or vote. They can
-- only insert / update / delete their OWN row.
--
-- RPC: effective_family_wallpaper(family_id) returns text
--   - returns the plurality-voted wallpaper_id among active members
--   - tie-break: most recent vote wins
--   - if no votes, falls back to the family owner's personal
--     wallpaper choice from profiles.style_prefs.wallpaper_id
--   - if owner hasn't picked either, returns NULL (UI shows 'plain')
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. table ─────────────────────────────────────────────────────────

create table if not exists public.family_wallpaper_votes (
  family_id    uuid not null references public.families(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  wallpaper_id text not null check (char_length(wallpaper_id) <= 64),
  voted_at     timestamptz not null default now(),
  primary key (family_id, profile_id)
);

create index if not exists fwv_family_idx
  on public.family_wallpaper_votes(family_id, voted_at desc);

alter table public.family_wallpaper_votes enable row level security;

-- ── 2. RLS ───────────────────────────────────────────────────────────

drop policy if exists fwv_read on public.family_wallpaper_votes;
create policy fwv_read on public.family_wallpaper_votes
  for select to authenticated using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = family_wallpaper_votes.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- Vote is INSERT or UPDATE — must be your own row + you must be an
-- active member of the family.
drop policy if exists fwv_self_write on public.family_wallpaper_votes;
create policy fwv_self_write on public.family_wallpaper_votes
  for all to authenticated
  using (auth.uid() = profile_id)
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = family_wallpaper_votes.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- ── 3. RPC: effective wallpaper ──────────────────────────────────────

create or replace function public.effective_family_wallpaper(
  p_family_id uuid
) returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_winner text;
  v_owner_choice text;
begin
  -- Plurality among active members. Tie-break: most recent vote.
  select wallpaper_id into v_winner
  from (
    select
      v.wallpaper_id,
      count(*) as vote_count,
      max(v.voted_at) as latest
    from public.family_wallpaper_votes v
    join public.family_members fm
      on fm.family_id = v.family_id
     and fm.profile_id = v.profile_id
     and fm.status = 'active'
    where v.family_id = p_family_id
    group by v.wallpaper_id
    order by vote_count desc, latest desc
    limit 1
  ) t;

  if v_winner is not null then
    return v_winner;
  end if;

  -- Fallback: owner's personal wallpaper choice.
  select coalesce(p.style_prefs ->> 'wallpaper_id', null)
    into v_owner_choice
    from public.families f
    join public.profiles p on p.id = f.owner_id
   where f.id = p_family_id;

  return v_owner_choice;
end;
$$;

grant execute on function public.effective_family_wallpaper(uuid) to authenticated;

-- DONE.
