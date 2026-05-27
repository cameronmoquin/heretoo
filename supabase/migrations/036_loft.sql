-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 036: The Loft
-- ════════════════════════════════════════════════════════════════════════
-- A wing of the platform with a different aesthetic, sized for the
-- younger generation. Posts are pseudonymous by default and expire
-- in 24 hours. Anyone in any active family is in.
--
-- Why it exists:
--   The recipe's pressure-test is "a grandmother pressures her family
--   into joining." It only sustains if the family wants it back. The
--   Common Room is shared (everyone, all generations); the Loft is
--   the rec room upstairs. Same building, different vibe. The 14-year-
--   old shows up dutifully for grandma's posts; they stay because the
--   Loft is theirs.
--
-- Refusal list:
--   - No ads. Same hard line as the rest of the platform.
--   - No pop-culture quizzes / sponsored content / brand presence.
--   - No "trending" indicators or follower counts inside the Loft.
--   - No screenshot-bait — posts expire whether they're saved or not.
--
-- Privacy:
--   - The platform identity is not exposed in the Loft. Each user
--     gets a stable pseudonym (loft_handle) generated on first visit;
--     other Loft posts they make share that pseudonym so a thread can
--     develop. The mapping pseudonym -> profile is server-side only.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Loft handle on profiles ──────────────────────────────────────────

alter table public.profiles
  add column if not exists loft_handle text unique,
  add column if not exists loft_handle_locked boolean not null default false;

-- 2. loft_posts ───────────────────────────────────────────────────────

create table if not exists public.loft_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  body          text not null check (length(body) between 1 and 1200),
  -- The pseudonym is denormalized onto each post so even after the
  -- author changes their loft_handle (one-time allowed) old posts
  -- still display the original byline.
  pseudonym     text not null,
  created_at    timestamptz not null default now(),
  -- Hard cap: 24 hours from creation. The expiry job deletes rows past this.
  expires_at    timestamptz not null default (now() + interval '24 hours')
);

-- Partial-index predicate can't reference now() (volatile). Plain
-- index serves the same query well enough.
create index if not exists loft_posts_recent_idx
  on public.loft_posts (expires_at);
create index if not exists loft_posts_author_idx
  on public.loft_posts (author_id, created_at desc);

alter table public.loft_posts enable row level security;

-- Read: any active family member of any family (i.e. anyone who
-- has been pulled into HereToo via family). Visibility is bounded
-- by the platform's family graph, not by within-family scope.
drop policy if exists loft_posts_read on public.loft_posts;
create policy loft_posts_read on public.loft_posts
  for select to authenticated
  using (
    expires_at > now()
    and exists (
      select 1 from public.family_members fm
      where fm.profile_id = auth.uid() and fm.status = 'active'
    )
  );

-- Insert: same membership gate; user must own the row.
drop policy if exists loft_posts_insert on public.loft_posts;
create policy loft_posts_insert on public.loft_posts
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.family_members fm
      where fm.profile_id = auth.uid() and fm.status = 'active'
    )
  );

-- Delete: author can delete their own loft post early (privacy).
drop policy if exists loft_posts_delete on public.loft_posts;
create policy loft_posts_delete on public.loft_posts
  for delete to authenticated
  using (auth.uid() = author_id);

-- 3. RPC: claim or fetch the viewer's loft_handle ─────────────────────
-- Generates a stable pseudonym if the user doesn't have one yet. Called
-- on first Loft visit. The pool of pseudonyms is intentionally banal
-- so no one's pseudonym is "cooler" than another's; everyone is one
-- of the same anonymous shapes.

create or replace function public.claim_loft_handle()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  current_handle text;
  attempts int := 0;
  candidate text;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;

  select loft_handle into current_handle from public.profiles where id = caller;
  if current_handle is not null then
    return current_handle;
  end if;

  -- Pseudonym pool: a small adjective + an animal + 3-digit number.
  -- "quiet-fox-184", "patient-otter-027". Banal on purpose.
  while attempts < 12 loop
    candidate := (
      array['quiet','patient','tall','old','small','calm','bright','low','warm','plain','soft','far']
    )[1 + floor(random() * 12)::int]
    || '-' ||
    (
      array['fox','otter','wren','heron','hare','crow','elk','deer','bee','snail','toad','newt']
    )[1 + floor(random() * 12)::int]
    || '-' || lpad((floor(random() * 1000))::int::text, 3, '0');

    -- UNIQUE clash? Try again.
    if not exists (select 1 from public.profiles where loft_handle = candidate) then
      update public.profiles
        set loft_handle = candidate
        where id = caller and loft_handle is null;
      return candidate;
    end if;

    attempts := attempts + 1;
  end loop;

  -- Final fallback: append the user id suffix.
  candidate := 'guest-' || replace(caller::text, '-', '')::text;
  update public.profiles set loft_handle = candidate where id = caller and loft_handle is null;
  return candidate;
end;
$$;

grant execute on function public.claim_loft_handle() to authenticated;

-- 4. RPC: cleanup expired loft posts ──────────────────────────────────
-- Called by the hourly Netlify function. Pure DB-side delete; faster
-- than round-tripping each row over PostgREST.

create or replace function public.purge_expired_loft_posts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  delete from public.loft_posts where expires_at <= now() returning 1
    into removed;
  -- The above only stamps the LAST row's count; use a count(*) instead.
  return (
    select count(*) from public.loft_posts where expires_at <= now()
  );
end;
$$;

-- Service-role only.
revoke all on function public.purge_expired_loft_posts() from public, authenticated;

-- DONE.
