-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 029: Anniversary Engine (Source of Truth, M4)
-- ════════════════════════════════════════════════════════════════════════
-- A rhythm is a recurring date the platform notices on the family's
-- behalf. Post anniversaries are mechanical (any post older than 12
-- months on this month+day). Birthdays, anniversaries, deaths, and
-- custom rhythms are user-entered. Seasonal repeats ("first warm day")
-- are out of scope for v1.
--
-- The dispatch is the candle on the mantel. One sentence per rhythm
-- per user per day. Surfaces in the Room hearth and (when wired) the
-- daily digest under "Today on this date."
--
-- Refusal list (M4):
--   - No pushes for rhythms.
--   - No "memories" carousel à la Facebook On This Day.
--   - No suggested actions ("send a card?"). The candle is enough.
--   - No paid-for or sponsored rhythms (no Hallmark holidays).
-- ════════════════════════════════════════════════════════════════════════

-- 1. rhythms table — user-entered or detected recurring dates ─────────

create table if not exists public.rhythms (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid references public.families(id) on delete cascade,
  profile_id      uuid references public.profiles(id) on delete cascade,
  source_post_id  uuid references public.posts(id) on delete set null,
  kind            text not null check (kind in (
    'post_anniversary', 'birthday', 'anniversary', 'death', 'custom'
  )),
  label           text not null check (length(label) between 1 and 120),
  month           int not null check (month between 1 and 12),
  day             int not null check (day between 1 and 31),
  year            int,
  active          boolean not null default true,
  -- For sensitive rhythms (deaths, illnesses) the user can mark
  -- private: only the digest surfaces it, never the Room hearth.
  digest_only     boolean not null default false,
  confirmed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists rhythms_today_idx
  on public.rhythms (month, day) where active = true;
create index if not exists rhythms_family_idx
  on public.rhythms (family_id) where active = true;
create index if not exists rhythms_profile_idx
  on public.rhythms (profile_id) where active = true;

alter table public.rhythms enable row level security;

-- Read: anyone in the same family. Profile-scoped rhythms (no family)
-- are read-only by the profile owner.
drop policy if exists rhythms_read on public.rhythms;
create policy rhythms_read on public.rhythms
  for select to authenticated
  using (
    (family_id is not null and exists (
      select 1 from public.family_members fm
      where fm.family_id = rhythms.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    ))
    or (family_id is null and rhythms.profile_id = auth.uid())
  );

-- Insert: the profile_id must be the actor (or null for family-wide
-- rhythms inserted by an active family member).
drop policy if exists rhythms_insert on public.rhythms;
create policy rhythms_insert on public.rhythms
  for insert to authenticated
  with check (
    (
      profile_id is not null and profile_id = auth.uid()
    )
    or (
      profile_id is null and family_id is not null and exists (
        select 1 from public.family_members fm
        where fm.family_id = rhythms.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      )
    )
  );

-- Update / delete: only the rhythm's profile owner, or any active
-- member for family-wide rhythms.
drop policy if exists rhythms_update on public.rhythms;
create policy rhythms_update on public.rhythms
  for update to authenticated
  using (
    rhythms.profile_id = auth.uid()
    or (rhythms.profile_id is null and family_id is not null and exists (
      select 1 from public.family_members fm
      where fm.family_id = rhythms.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    ))
  );

drop policy if exists rhythms_delete on public.rhythms;
create policy rhythms_delete on public.rhythms
  for delete to authenticated
  using (
    rhythms.profile_id = auth.uid()
    or (rhythms.profile_id is null and family_id is not null and exists (
      select 1 from public.family_members fm
      where fm.family_id = rhythms.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    ))
  );

-- 2. room_dispatches — the materialized "candle" per user per day ─────

create table if not exists public.room_dispatches (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  for_date        date not null,
  rhythm_id       uuid references public.rhythms(id) on delete cascade,
  source_post_id  uuid references public.posts(id) on delete set null,
  family_id       uuid references public.families(id) on delete cascade,
  kind            text not null,                      -- mirrors rhythms.kind
  copy            text not null check (length(copy) <= 240),
  digest_only     boolean not null default false,
  created_at      timestamptz not null default now(),
  -- Idempotent — one rhythm cannot dispatch twice on the same day.
  -- Source-post anniversaries dedupe by source_post_id when rhythm_id
  -- is null (mechanical detection, no rhythms row).
  unique (profile_id, for_date, rhythm_id, source_post_id)
);

create index if not exists room_dispatches_today_idx
  on public.room_dispatches (profile_id, for_date desc);

alter table public.room_dispatches enable row level security;

-- Users see their own dispatches.
drop policy if exists room_dispatches_self_read on public.room_dispatches;
create policy room_dispatches_self_read on public.room_dispatches
  for select to authenticated
  using (auth.uid() = profile_id);

-- Inserts come exclusively from the service-role scheduled function;
-- no policy grants insert to authenticated.

-- 3. RPC: today's dispatches for a viewer ─────────────────────────────
-- The Room hearth reads from this. Returns visible (non-digest_only)
-- dispatches for today in the user's timezone, falling back to UTC.

create or replace function public.today_dispatches_for_viewer()
returns setof public.room_dispatches
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select id, coalesce(timezone, 'UTC') as tz
    from public.profiles
    where id = auth.uid()
  )
  select rd.*
  from public.room_dispatches rd
  cross join viewer v
  where rd.profile_id = v.id
    and rd.for_date = (now() at time zone v.tz)::date
    and rd.digest_only = false
  order by rd.created_at asc;
$$;

grant execute on function public.today_dispatches_for_viewer() to authenticated;

-- DONE.
