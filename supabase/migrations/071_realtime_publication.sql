-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 071: publish the tables realtime is listening to
-- ════════════════════════════════════════════════════════════════════════
-- A message from one person did not appear on the other person's screen
-- until something else refetched.
--
-- The client is not at fault: useChat subscribes to postgres_changes on
-- `messages` filtered by thread_id, and useFeed does the same on `posts`.
-- But a postgres_changes subscription only ever fires for tables in the
-- `supabase_realtime` publication, and across seventy migrations nothing
-- has ever added one. Every realtime subscription in this app has been
-- listening to a channel the database was never asked to speak on.
--
-- Optimistic sends hid it from the sender — their own message appears
-- from onMutate regardless — so this only ever showed up as "the other
-- person's message did not arrive", which is the harder half to notice
-- while testing alone.
--
-- Idempotent: adding a table that is already published raises
-- 42710 (duplicate_object), which is caught and ignored per table.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. The publication ───────────────────────────────────────────────
-- Supabase creates `supabase_realtime` on project setup, but create it
-- if some path has not: `add table` against a missing publication is a
-- hard error, and this should work on a fresh database too.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end$$;


-- ── 2. The tables the client actually subscribes to ──────────────────
--   messages       useChat, per-thread inserts
--   posts          useFeedRealtime, feed inserts
--   post_reactions hearts landing while someone is reading
--   comments       replies landing while someone is reading
--
-- RLS still applies to realtime payloads, so publishing a table does not
-- widen who can see a row — a subscriber receives only what they could
-- have selected anyway.
do $$
declare
  t text;
begin
  foreach t in array array['messages', 'posts', 'post_reactions', 'comments']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'published %', t;
    exception
      when duplicate_object then raise notice '% already published', t;
      when undefined_table  then raise notice '% does not exist, skipped', t;
    end;
  end loop;
end$$;


-- ── 3. Replica identity, so updates and deletes carry their old row ──
-- Without this an UPDATE or DELETE payload arrives with only the primary
-- key, which is enough for the invalidate-and-refetch the client does
-- today but not for anything reading payload.old later.
alter table public.messages       replica identity full;
alter table public.posts          replica identity full;
alter table public.post_reactions replica identity full;
alter table public.comments       replica identity full;


-- ── 4. Verify ────────────────────────────────────────────────────────
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' order by tablename;
--   -- expect comments, messages, post_reactions, posts
--
-- Then open a thread as two different people and send one message. It
-- should land without a refresh.

-- DONE.
