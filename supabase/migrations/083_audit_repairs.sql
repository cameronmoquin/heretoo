-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 083: what the audit found, closed
-- ════════════════════════════════════════════════════════════════════════
-- Every hole below was PROVEN with a live probe from a throwaway
-- anonymous session, not inferred:
--
--   A. any signed-in account could insert an art_works row with
--      source='ad' and have it render in the art/ad rotation — the
--      entire approval pipeline 082 exists to enforce, bypassed.
--   B. any signed-in account could write arbitrary objects into the
--      world-readable hunt-photos bucket (and the policy allowed
--      deleting anyone's clue photos platform-wide).
--   C. a throwaway guest could post publicly, comment, and react.
--      Guests exist to answer one message (080); the feed's write
--      surface was open to them.
--
-- Plus two dead letters found by reading, not probing:
--   D. comments_disabled was unenforceable — 002's FOR ALL policy
--      OR'd past 006's mute gate, exactly the way posts_author_write
--      did before 066 fixed it for posts.
--   E. the babybook owner could not delete or curate a member's rows,
--      and a member could not remove a blob they replaced.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── The guest test. Declared once, used everywhere below. ────────────
-- An anonymous session is role `authenticated`, so nothing distinguished
-- it from a member. This does.
create or replace function public.uid_is_guest()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

revoke all on function public.uid_is_guest() from public, anon;
grant execute on function public.uid_is_guest() to authenticated;


-- ── A. The gallery is curated, not open ──────────────────────────────
-- Ingest and approved ads are written with the service role, which
-- bypasses RLS. No client writes art, ever.
drop policy if exists art_uploader_write on public.art_works;

drop policy if exists art_read on public.art_works;
create policy art_read on public.art_works
  for select to anon, authenticated
  using (true);


-- ── B. hunt-photos: your own cache's folder, and only yours ──────────
-- The old pair allowed any authenticated user to write anywhere in the
-- bucket and delete anything in it. Path is {cache_id}/…, so the first
-- folder segment names the cache.
drop policy if exists hunt_photos_insert on storage.objects;
create policy hunt_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hunt-photos'
    and not public.uid_is_guest()
    and exists (
      select 1 from public.hunt_caches c
      where c.id::text = (storage.foldername(name))[1]
        and c.creator_id = auth.uid()
    )
  );

drop policy if exists hunt_photos_delete on storage.objects;
create policy hunt_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hunt-photos'
    and exists (
      select 1 from public.hunt_caches c
      where c.id::text = (storage.foldername(name))[1]
        and c.creator_id = auth.uid()
    )
  );


-- ── C. A guest answers a message. That is all. ───────────────────────
-- posts: guests write nothing. Members keep 065's rules verbatim.
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.uid_is_guest()
    and (
      visibility in ('public', 'connections', 'private')
      or (
        visibility = 'family'
        and family_id is not null
        and exists (
          select 1 from public.family_members fm
          where fm.family_id = posts.family_id
            and fm.profile_id = auth.uid()
            and fm.status = 'active'
        )
      )
      or (
        visibility = 'direct'
        and direct_recipient_id is not null
        and direct_recipient_id <> auth.uid()
      )
    )
  );


-- ── D. Comments: per-verb, and the mute gate finally bites ───────────
-- 002's `comments_self` was FOR ALL, so it OR'd past 006's insert
-- check and past every later rule. Replaced with explicit verbs.
drop policy if exists comments_self on public.comments;
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.uid_is_guest()
    and exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and coalesce(p.comments_disabled, false) = false
    )
  );

drop policy if exists comments_update_self on public.comments;
create policy comments_update_self on public.comments
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- The post's author may remove a comment on their own post; everyone
-- else may remove only their own.
drop policy if exists comments_delete_self on public.comments;
create policy comments_delete_self on public.comments
  for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.posts p
      where p.id = comments.post_id and p.author_id = auth.uid()
    )
  );


-- Reactions: same guest rule.
drop policy if exists reactions_self on public.post_reactions;
create policy reactions_self on public.post_reactions
  for insert to authenticated
  with check (auth.uid() = profile_id and not public.uid_is_guest());

drop policy if exists reactions_delete_self on public.post_reactions;
create policy reactions_delete_self on public.post_reactions
  for delete to authenticated
  using (auth.uid() = profile_id);

-- Read stays exactly as 002 wrote it: scoped to posts you can see.
drop policy if exists reactions_read on public.post_reactions;
create policy reactions_read on public.post_reactions
  for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_reactions.post_id)
  );


-- ── E. The babybook owner owns the book ──────────────────────────────
-- 078 widened read and insert to members but left 064's author-own
-- update/delete standing, so the owner could not curate or remove a
-- member's rows and PostgREST reported success on zero rows — the
-- deletion "worked" until the next refetch.
drop policy if exists babybook_entries_self_update on public.babybook_entries;
create policy babybook_entries_self_update on public.babybook_entries
  for update to authenticated
  using (auth.uid() = author_id or public.uid_owns_babybook(babybook_id))
  with check (auth.uid() = author_id or public.uid_owns_babybook(babybook_id));

drop policy if exists babybook_entries_self_delete on public.babybook_entries;
create policy babybook_entries_self_delete on public.babybook_entries
  for delete to authenticated
  using (auth.uid() = author_id or public.uid_owns_babybook(babybook_id));

drop policy if exists babybook_assets_self_update on public.babybook_assets;
create policy babybook_assets_self_update on public.babybook_assets
  for update to authenticated
  using (auth.uid() = author_id or public.uid_owns_babybook(babybook_id))
  with check (auth.uid() = author_id or public.uid_owns_babybook(babybook_id));

drop policy if exists babybook_assets_self_delete on public.babybook_assets;
create policy babybook_assets_self_delete on public.babybook_assets
  for delete to authenticated
  using (auth.uid() = author_id or public.uid_owns_babybook(babybook_id));

-- A member may remove a blob they replaced; the owner may remove any.
drop policy if exists babybook_assets_author_delete on storage.objects;
create policy babybook_assets_author_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.babybooks b
      where b.id::text = (storage.foldername(name))[1]
        and public.uid_in_babybook(b.id)
    )
  );

-- The roster is visible to everyone in the book, not just to yourself.
drop policy if exists babybook_members_select on public.babybook_members;
create policy babybook_members_select on public.babybook_members
  for select to authenticated
  using (public.uid_in_babybook(babybook_id));

-- 078 revoked and never granted back; every other locked table states
-- its grants explicitly.
grant select, insert, delete on table public.babybook_members to authenticated;


-- ── The retired overload, at last ────────────────────────────────────
drop function if exists public.create_seed_invite(text, text);

commit;

notify pgrst, 'reload schema';

-- ── Verify (each should return zero rows / be blocked) ───────────────
--   Insert into art_works as a normal signed-in user  → denied
--   Write to hunt-photos outside your own cache       → denied
--   Post publicly from an anonymous session           → denied
--   Comment on a post with comments_disabled = true   → denied
-- DONE.
