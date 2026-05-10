-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 041: Video calls
-- ════════════════════════════════════════════════════════════════════════
-- Family-scoped video conferencing. Peer-to-peer WebRTC with Supabase
-- Realtime as the signaling channel. No media server, no third-party
-- SDK. Mesh topology — works for up to ~6 peers comfortably; we cap
-- at 4 in client to leave headroom on weaker connections.
--
-- Schema:
--   video_calls — one row per call session.
--   video_call_participants — one row per joined participant (call ×
--     user). Joined_at + left_at let us reconstruct who was there.
--
-- Refusal list:
--   - No call recording. The whole point of family video is presence,
--     not archive.
--   - No call ratings, no "rate your call" prompts.
--   - No analytics on call duration sent anywhere off-platform.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.video_calls (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  host_id       uuid not null references public.profiles(id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  -- Optional name like "Sunday lunch" — defaults to a polite empty.
  label         text,
  -- Auto-end after 4 hours of being active to avoid orphan calls in
  -- the family chat. The cleanup function bumps ended_at.
  created_at    timestamptz not null default now()
);

create index if not exists video_calls_family_active_idx
  on public.video_calls (family_id, started_at desc) where ended_at is null;

alter table public.video_calls enable row level security;

drop policy if exists video_calls_read on public.video_calls;
create policy video_calls_read on public.video_calls
  for select to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = video_calls.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

drop policy if exists video_calls_insert on public.video_calls;
create policy video_calls_insert on public.video_calls
  for insert to authenticated
  with check (
    auth.uid() = host_id
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = video_calls.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

drop policy if exists video_calls_update on public.video_calls;
create policy video_calls_update on public.video_calls
  for update to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = video_calls.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- 2. participants ────────────────────────────────────────────────────

create table if not exists public.video_call_participants (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid not null references public.video_calls(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz,
  unique (call_id, user_id)
);

create index if not exists video_call_participants_call_idx
  on public.video_call_participants (call_id, joined_at);

alter table public.video_call_participants enable row level security;

drop policy if exists video_call_participants_read on public.video_call_participants;
create policy video_call_participants_read on public.video_call_participants
  for select to authenticated
  using (
    exists (
      select 1 from public.video_calls vc
      join public.family_members fm on fm.family_id = vc.family_id
      where vc.id = video_call_participants.call_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

drop policy if exists video_call_participants_insert on public.video_call_participants;
create policy video_call_participants_insert on public.video_call_participants
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.video_calls vc
      join public.family_members fm on fm.family_id = vc.family_id
      where vc.id = video_call_participants.call_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

drop policy if exists video_call_participants_update on public.video_call_participants;
create policy video_call_participants_update on public.video_call_participants
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. RPC: end stale calls ────────────────────────────────────────────
-- Called by an hourly Netlify cron. Marks any call still ongoing
-- past 4 hours as ended.

create or replace function public.cleanup_stale_video_calls()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  affected int;
begin
  update public.video_calls
    set ended_at = now()
    where ended_at is null
      and started_at < (now() - interval '4 hours');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.cleanup_stale_video_calls() from public, authenticated;

-- DONE.
