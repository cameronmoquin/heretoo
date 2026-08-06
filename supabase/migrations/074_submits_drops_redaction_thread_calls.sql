-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 074: submits and drops, redaction, thread calls
-- ════════════════════════════════════════════════════════════════════════
-- The feed contribution forks two ways now:
--
--   SUBMIT  persists. expires_at is null. No burn.
--   DROP    drops out after a day. expires_at = insert time + 24h.
--           A drop may also burn on reading (destruct_on_view).
--
-- THE BURN IS A REDACTION NOW, NOT A DISAPPEARANCE. The old rule hid a
-- burned drop from the viewer who had seen it, which made a burned
-- message indistinguishable from one that never existed. The new rule:
-- the first non-author reading physically redacts the row — body wiped,
-- media rows deleted, burned_at stamped — and the tombstone stays
-- visible to everyone who could have seen the drop. "One look, then
-- nothing" was always the composer's promise; now the nothing is
-- visibly a nothing.
--
-- VIDEO CALLS MOVE INTO MESSAGING. video_calls gains thread_id and the
-- family scoping becomes one of two scopes. A call belongs to exactly
-- one: a family (legacy) or a message thread.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Safe to re-run.
-- Grant rule (migration 059's lesson): name public, anon AND
-- authenticated in every revoke.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Columns ────────────────────────────────────────────────────────
alter table public.posts add column if not exists expires_at timestamptz;
alter table public.posts add column if not exists burned_at  timestamptz;

comment on column public.posts.expires_at is
  'Drops carry insert time + 24h. Submits carry null. Past this instant the row is invisible to everyone, author included.';
comment on column public.posts.burned_at is
  'Set when a destruct_on_view drop was first read by a non-author. The body is physically wiped at the same instant; the row remains as a redacted tombstone.';

create index if not exists posts_expires_idx
  on public.posts (expires_at) where expires_at is not null;


-- ── 2. posts_read, third edition ──────────────────────────────────────
-- Changes from 065's edition:
--   - expired drops are gone for everyone, the author included
--   - burned rows are VISIBLE (they are tombstones now); the per-viewer
--     uid_has_seen_post() hide is retired
drop policy if exists posts_read on public.posts;

create policy posts_read on public.posts
  for select to authenticated using (
    (expires_at is null or expires_at > now())
    and (
      auth.uid() = author_id

      or visibility = 'public'

      or (visibility = 'family' and family_id is not null and exists (
        select 1 from public.family_members fm
        where fm.family_id = posts.family_id
          and fm.profile_id = auth.uid()
          and fm.status = 'active'
      ) and (
        posts.update_recipient_ids is null
        or array_length(posts.update_recipient_ids, 1) is null
        or auth.uid() = any(posts.update_recipient_ids)
      ))

      or (visibility = 'connections' and (
        author_id in (
          select profile_id from public.family_network_reach(auth.uid(), 3)
        )
        or exists (
          select 1 from public.connections c
          where c.status = 'accepted'
            and ((c.requester_id = auth.uid() and c.recipient_id = posts.author_id)
              or (c.recipient_id = auth.uid() and c.requester_id = posts.author_id))
        )
      ))

      or (visibility = 'direct' and direct_recipient_id = auth.uid())
    )
  );


-- ── 3. open_drop: record the read, and burn what burns ────────────────
-- SECURITY DEFINER because a reader cannot UPDATE the author's post.
-- The visibility guard is therefore restated here explicitly — a caller
-- can only open what posts_read would have shown them.
create or replace function public.open_drop(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  allowed boolean := false;
begin
  select id, author_id, visibility, family_id, direct_recipient_id,
         destruct_on_view, burned_at, expires_at
    into p
    from public.posts where id = p_post_id;
  if not found then return; end if;
  if p.expires_at is not null and p.expires_at <= now() then return; end if;

  if p.author_id = auth.uid() then
    allowed := true;
  elsif p.visibility = 'public' then
    allowed := true;
  elsif p.visibility = 'family' and p.family_id is not null then
    allowed := exists (
      select 1 from public.family_members fm
      where fm.family_id = p.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active');
  elsif p.visibility = 'direct' then
    allowed := p.direct_recipient_id = auth.uid();
  end if;
  if not allowed then return; end if;

  insert into public.post_views (post_id, profile_id)
    values (p_post_id, auth.uid())
    on conflict do nothing;

  -- The burn. First non-author read wins; everything after reads ash.
  if p.destruct_on_view and p.burned_at is null and p.author_id <> auth.uid() then
    update public.posts
       set body = null, burned_at = now()
     where id = p_post_id and burned_at is null;
    delete from public.post_media where post_id = p_post_id;
  end if;
end;
$$;

revoke all on function public.open_drop(uuid) from public, anon, authenticated;
grant execute on function public.open_drop(uuid) to authenticated;


-- ── 4. Video calls belong to a thread or a family, never neither ──────
alter table public.video_calls
  add column if not exists thread_id uuid references public.message_threads(id) on delete cascade;
alter table public.video_calls alter column family_id drop not null;

alter table public.video_calls drop constraint if exists video_calls_scope_check;
alter table public.video_calls add constraint video_calls_scope_check check (
  (family_id is not null and thread_id is null)
  or (family_id is null and thread_id is not null)
);

create index if not exists video_calls_thread_active_idx
  on public.video_calls (thread_id, started_at desc) where ended_at is null;

-- One reusable answer to "may this person touch this call".
create or replace function public.uid_in_call_scope(p_family_id uuid, p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_family_id is not null then exists (
      select 1 from public.family_members fm
      where fm.family_id = p_family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active')
    when p_thread_id is not null then exists (
      select 1 from public.message_threads mt
      where mt.id = p_thread_id
        and (mt.participant_a = auth.uid() or mt.participant_b = auth.uid()))
    else false
  end;
$$;

revoke all on function public.uid_in_call_scope(uuid, uuid) from public, anon, authenticated;
grant execute on function public.uid_in_call_scope(uuid, uuid) to authenticated;

drop policy if exists video_calls_read on public.video_calls;
create policy video_calls_read on public.video_calls
  for select to authenticated
  using (public.uid_in_call_scope(family_id, thread_id));

drop policy if exists video_calls_insert on public.video_calls;
create policy video_calls_insert on public.video_calls
  for insert to authenticated
  with check (
    auth.uid() = host_id
    and public.uid_in_call_scope(family_id, thread_id)
  );

drop policy if exists video_calls_update on public.video_calls;
create policy video_calls_update on public.video_calls
  for update to authenticated
  using (public.uid_in_call_scope(family_id, thread_id));

drop policy if exists video_call_participants_read on public.video_call_participants;
create policy video_call_participants_read on public.video_call_participants
  for select to authenticated
  using (exists (
    select 1 from public.video_calls vc
    where vc.id = video_call_participants.call_id
      and public.uid_in_call_scope(vc.family_id, vc.thread_id)
  ));

drop policy if exists video_call_participants_insert on public.video_call_participants;
create policy video_call_participants_insert on public.video_call_participants
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.video_calls vc
      where vc.id = video_call_participants.call_id
        and public.uid_in_call_scope(vc.family_id, vc.thread_id)
    )
  );


commit;

notify pgrst, 'reload schema';

-- ── Verify ────────────────────────────────────────────────────────────
--   select column_name from information_schema.columns
--    where table_name='posts' and column_name in ('expires_at','burned_at');
--   select 1 from pg_proc where proname = 'open_drop';
-- DONE.
