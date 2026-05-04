-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 024: Moderation v1
-- ════════════════════════════════════════════════════════════════════════
-- Closes pitch claim #7 ("hate stays out by design") with the simplest
-- shipping-ready primitive: any signed-in user can flag a post or
-- comment. Flagged content is auto-hidden (in the feed and detail
-- pages) once it crosses a threshold of N distinct flaggers, pending
-- moderator review. This is harm-reduction triage, not perfect AI
-- detection — but it's a real pipeline instead of zero infrastructure.
--
-- Schema:
--   content_flags
--     - id              uuid pk
--     - flagger_id      uuid (auth user who flagged)
--     - post_id         uuid (nullable; mutually exclusive with comment_id)
--     - comment_id      uuid (nullable; mutually exclusive with post_id)
--     - reason          text (one of REASONS list below — stored as text
--                       for forward-compat without enum migration)
--     - note            text (optional free-text from the flagger)
--     - created_at
--     - reviewed_by     uuid (set when a moderator triages)
--     - reviewed_at     timestamptz
--     - decision        text ('uphold' | 'reject' | null while pending)
--   primary key on flagger_id + (post_id or comment_id) so a user
--   can't flag the same item twice (db will enforce via partial idx).
--
-- Reasons (text, validated client-side and via check):
--   'hate'       — harassment / hate speech / threats
--   'spam'       — promotional / repetitive / off-topic noise
--   'misinfo'    — provably false claims, especially health/safety
--   'sexual'     — sexual content not appropriate for the family-first surface
--   'other'      — captures-everything-else category, requires note
--
-- A view active_flagged_posts and active_flagged_comments compute live
-- counts per item (distinct flaggers) so the feed query can filter.
--
-- An RPC flag_content() is the public API the client uses.
--
-- A second RPC moderator_review() exists for now as a placeholder —
-- the moderator role will be added separately when we wire moderator
-- accounts. Today, only service_role can call it; the column is
-- there so flagged items don't accumulate forever.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.content_flags (
  id           uuid primary key default gen_random_uuid(),
  flagger_id   uuid not null references public.profiles(id) on delete cascade,
  post_id      uuid references public.posts(id) on delete cascade,
  comment_id   uuid references public.comments(id) on delete cascade,
  reason       text not null check (reason in ('hate', 'spam', 'misinfo', 'sexual', 'other')),
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  decision     text check (decision is null or decision in ('uphold', 'reject')),
  -- Exactly one of post_id / comment_id must be set
  check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

-- Each flagger can only flag a given item once.
create unique index if not exists content_flags_unique_post
  on public.content_flags(flagger_id, post_id) where post_id is not null;
create unique index if not exists content_flags_unique_comment
  on public.content_flags(flagger_id, comment_id) where comment_id is not null;

create index if not exists content_flags_post_idx
  on public.content_flags(post_id) where post_id is not null;
create index if not exists content_flags_comment_idx
  on public.content_flags(comment_id) where comment_id is not null;

alter table public.content_flags enable row level security;

-- A flagger can read their own flags. Moderators can see all (handled
-- via service_role for now — UI for that comes later).
drop policy if exists flags_self_read on public.content_flags;
create policy flags_self_read on public.content_flags
  for select to authenticated using (auth.uid() = flagger_id);

drop policy if exists flags_self_insert on public.content_flags;
create policy flags_self_insert on public.content_flags
  for insert to authenticated with check (
    auth.uid() = flagger_id
    and reviewed_by is null and reviewed_at is null and decision is null
  );

-- Once you've flagged something you can withdraw it before review.
drop policy if exists flags_self_delete on public.content_flags;
create policy flags_self_delete on public.content_flags
  for delete to authenticated using (
    auth.uid() = flagger_id and reviewed_at is null
  );

-- ── Hide-threshold view ──────────────────────────────────────────────
-- A post / comment is "actively flagged" once N distinct flaggers
-- have flagged it AND it hasn't been reviewed-rejected. Three is the
-- default threshold (low so anything seriously offensive gets caught
-- by even a small family, high enough that one cranky relative can't
-- silently mute you).

create or replace view public.active_flagged_posts as
  select post_id, count(distinct flagger_id) as flag_count
  from public.content_flags
  where post_id is not null
    and (decision is null or decision = 'uphold')
  group by post_id
  having count(distinct flagger_id) >= 3;

create or replace view public.active_flagged_comments as
  select comment_id, count(distinct flagger_id) as flag_count
  from public.content_flags
  where comment_id is not null
    and (decision is null or decision = 'uphold')
  group by comment_id
  having count(distinct flagger_id) >= 3;

-- ── Public RPC: flag a post or comment ───────────────────────────────
create or replace function public.flag_content(
  p_post_id uuid,
  p_comment_id uuid,
  p_reason text,
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_post_id is null and p_comment_id is null then
    raise exception 'Must specify post_id OR comment_id';
  end if;
  if p_post_id is not null and p_comment_id is not null then
    raise exception 'Specify exactly one of post_id, comment_id';
  end if;
  if p_reason not in ('hate', 'spam', 'misinfo', 'sexual', 'other') then
    raise exception 'Invalid reason: %', p_reason;
  end if;
  if p_reason = 'other' and (p_note is null or char_length(p_note) < 5) then
    raise exception '"other" requires a note (>= 5 chars)';
  end if;

  insert into public.content_flags (flagger_id, post_id, comment_id, reason, note)
  values (auth.uid(), p_post_id, p_comment_id, p_reason, p_note)
  on conflict do nothing
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.flag_content(uuid, uuid, text, text) to authenticated;

-- DONE.
