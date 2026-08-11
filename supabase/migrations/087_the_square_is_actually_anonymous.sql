-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 087: the square is actually anonymous
-- ════════════════════════════════════════════════════════════════════════
-- The public square is the one surface whose entire premise is that
-- nobody knows who wrote it. It was not anonymous. loft_posts_read
-- (044:19-21) grants SELECT on every column to any authenticated user,
-- and loft_posts.author_id is a foreign key to profiles — so one
-- request returned the mask and the face together:
--
--   GET /loft_posts?select=*        → author_id
--   GET /profiles?id=eq.<author_id> → the real name
--
-- Proven in production before writing this: a throwaway member account
-- resolved a pseudonymous post to its author's display name in two
-- requests, no privileges beyond signing up.
--
-- The fix is to stop handing the column out. The client only ever
-- needed author_id to answer "is this mine" (LoftCard.tsx:29), so a
-- view answers that question and keeps the identity:
--
--   public.square — id, body, pseudonym, created_at, expires_at, is_mine
--
-- security_invoker so the caller's RLS still applies. The column
-- privilege is what actually enforces this: Postgres checks column
-- grants before RLS, so no policy edit can leak it back by accident.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace view public.square
with (security_invoker = true) as
  select
    l.id,
    l.body,
    l.pseudonym,
    l.created_at,
    l.expires_at,
    (l.author_id = auth.uid()) as is_mine
  from public.loft_posts l;

comment on view public.square is
  'The pseudonymous square, without the author. is_mine answers the only question the client ever asked author_id, and the column itself never leaves the database.';

grant select on public.square to authenticated;

-- The lock. Every column except the identity.
revoke select on public.loft_posts from authenticated;
grant select (id, body, pseudonym, created_at, expires_at)
  on public.loft_posts to authenticated;

-- Writing is unchanged: 085 already requires a non-guest author whose
-- claimed loft_handle matches the pseudonym, and the delete policy
-- still keys on author_id, which RLS may read even when the client
-- may not select it.

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   select author_id from loft_posts  → permission denied for column
--   select * from square              → rows, with is_mine, no author
-- DONE.
