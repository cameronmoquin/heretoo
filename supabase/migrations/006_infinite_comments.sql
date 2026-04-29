-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 006: Infinite-depth comments + per-post mute
-- ════════════════════════════════════════════════════════════════════════
-- Drops the 1-level-only constraint from migration 002 so a comment can
-- be a reply to a reply to a reply, etc. Adds a `comments_disabled`
-- flag on posts so an author can mute their own thread.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Remove the single-level enforcement trigger.
drop trigger if exists comments_enforce_depth on public.comments;
drop function if exists public.enforce_comment_depth() cascade;

-- 2. Per-post comments toggle. Defaults to false (open).
alter table public.posts
  add column if not exists comments_disabled boolean not null default false;

-- 3. Block new comment INSERTs when the parent post has comments_disabled.
--    Original `comments_self` policy in 002 is `auth.uid() = author_id`
--    for ALL — we want to keep delete/edit unchanged but tighten insert.
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and not exists (
      select 1 from public.posts p
      where p.id = comments.post_id
        and p.comments_disabled = true
    )
  );

-- DONE.
