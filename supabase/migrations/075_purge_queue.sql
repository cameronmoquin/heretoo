-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 075: the purge queue
-- ════════════════════════════════════════════════════════════════════════
-- Makes the burn and the expiry PHYSICAL. 074 made a burned drop
-- unreachable; this file makes sure the bytes follow.
--
-- The problem it solves: open_drop deletes the post_media rows at burn
-- time, and those rows are the only record of where the blobs live —
-- so the files themselves were orphaned forever, still fetchable by
-- URL. Now the paths are captured into purge_queue in the same
-- transaction, and the drop-purge worker deletes the actual objects
-- (storage files, Mux assets) on the hour.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The queue ──────────────────────────────────────────────────────
create table if not exists public.purge_queue (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null,
  storage_path text not null,
  media_type   text,
  queued_at    timestamptz not null default now(),
  purged_at    timestamptz
);

comment on table public.purge_queue is
  'Blob paths awaiting physical deletion by the drop-purge worker. Rows land here in the same transaction that removes their post_media rows, so no file is ever orphaned without a forwarding address.';

create index if not exists purge_queue_pending_idx
  on public.purge_queue (queued_at) where purged_at is null;

-- Service-role only. RLS on with no policies denies every client role;
-- the explicit revoke (059's lesson: name all three) makes sure a
-- future default grant cannot quietly open it either.
alter table public.purge_queue enable row level security;
revoke all on table public.purge_queue from public, anon, authenticated;


-- ── 2. open_drop v2 — enqueue the blobs before deleting the rows ──────
-- Identical to 074's edition except the insert into purge_queue, which
-- runs BEFORE the post_media delete, inside the same transaction. If
-- the enqueue fails the burn fails whole — failing toward keeping
-- content, never toward orphaning it.
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

  if p.destruct_on_view and p.burned_at is null and p.author_id <> auth.uid() then
    insert into public.purge_queue (post_id, storage_path, media_type)
      select pm.post_id, pm.storage_path, pm.media_type
        from public.post_media pm
       where pm.post_id = p_post_id;
    update public.posts
       set body = null, burned_at = now()
     where id = p_post_id and burned_at is null;
    delete from public.post_media where post_id = p_post_id;
  end if;
end;
$$;

revoke all on function public.open_drop(uuid) from public, anon, authenticated;
grant execute on function public.open_drop(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify ────────────────────────────────────────────────────────────
--   select 1 from pg_tables where tablename = 'purge_queue';
-- DONE.
