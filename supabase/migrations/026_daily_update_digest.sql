-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 026: Daily update digest infrastructure
-- ════════════════════════════════════════════════════════════════════════
-- Goal: at 12pm in EACH user's local timezone, email them a summary
-- of family-update posts they haven't seen yet.
--
-- Pieces:
--   1. profiles.timezone — IANA timezone string ("America/Los_Angeles").
--      Auto-detected on first login via the browser's
--      Intl.DateTimeFormat().resolvedOptions().timeZone, editable in
--      /profile/notifications. Default null → fall back to UTC.
--
--   2. daily_update_digests — track which digests we've sent and at
--      what time. Lets us avoid double-sending if the function fires
--      twice for the same noon, AND provides the "since" timestamp
--      for what counts as "unchecked" (anything since last digest).
--
--   3. unread_family_updates_for(profile_id) RPC — returns the list
--      of family-update posts the user hasn't viewed yet, since their
--      last digest. Used by the email-sending Netlify function to
--      build the digest body.
--
-- Privacy: digests respect post RLS. The RPC runs as security_invoker
-- so it sees what the user themselves can see. The email body itself
-- can include the post text since the user is the recipient.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Timezone column ──────────────────────────────────────────────────

alter table public.profiles
  add column if not exists timezone text;

-- 2. Digest log table ─────────────────────────────────────────────────

create table if not exists public.daily_update_digests (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  sent_at         timestamptz not null default now(),
  post_count      integer not null default 0,
  -- Stamp of the user's local-noon date this digest was for, so we
  -- can dedupe on the calendar day in their tz (avoid sending two
  -- digests on the same local day).
  local_date      date not null,
  unique (profile_id, local_date)
);

create index if not exists daily_digests_profile_idx
  on public.daily_update_digests(profile_id, sent_at desc);

alter table public.daily_update_digests enable row level security;

-- Users can read their own digest history (for a "we last emailed you"
-- indicator on the notifications page).
drop policy if exists digests_self_read on public.daily_update_digests;
create policy digests_self_read on public.daily_update_digests
  for select to authenticated using (auth.uid() = profile_id);

-- Inserts come exclusively from the service-role Netlify function;
-- no RLS policy grants insert to authenticated users.

-- 3. RPC: unread family updates for a profile ─────────────────────────
-- Returns family posts with kind='update' (or, if you prefer, all
-- family posts since "kind=update" is being deprecated in favor of
-- subjects — for now we keep the kind filter for back-compat) that:
--   - the user can see (RLS — user is an active member of the family)
--   - were created since the user's last digest
--   - the user hasn't viewed yet (post_views check)
-- Returns post id, body, family_id, created_at, author_handle.

create or replace function public.unread_family_updates_for(
  p_profile_id uuid,
  p_since timestamptz
) returns table (
  post_id        uuid,
  body           text,
  family_id      uuid,
  family_name    text,
  author_handle  text,
  author_name    text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.body,
    p.family_id,
    f.name,
    auth_p.handle,
    coalesce(auth_p.display_name, auth_p.handle),
    p.created_at
  from public.posts p
  join public.families f on f.id = p.family_id
  join public.profiles auth_p on auth_p.id = p.author_id
  join public.family_members fm on fm.family_id = p.family_id
  where p.visibility = 'family'
    and p.kind = 'update'
    and fm.profile_id = p_profile_id
    and fm.status = 'active'
    and p.created_at > p_since
    and not exists (
      select 1 from public.post_views pv
      where pv.post_id = p.id and pv.profile_id = p_profile_id
    )
    -- Don't email the author about their own post
    and p.author_id <> p_profile_id
  order by p.created_at desc
  limit 50;
$$;

grant execute on function public.unread_family_updates_for(uuid, timestamptz) to service_role;

-- DONE.
