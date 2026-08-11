-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 088: the square view, corrected
-- ════════════════════════════════════════════════════════════════════════
-- 087 closed the leak and broke the room. The view was declared
-- security_invoker, which runs it with the CALLER's privileges — and
-- 087 had just revoked the caller's SELECT on author_id, the column the
-- view needs to compute is_mine. So every read returned
-- "permission denied for table loft_posts".
--
-- A definer view is the right instrument here: it reads the column so
-- the caller never has to. auth.uid() still resolves inside it, because
-- that reads the request's JWT claim rather than the database role, so
-- is_mine is still answered per-reader.
--
-- Nothing is lost by not being invoker: loft_posts_read grants every
-- authenticated user every row anyway (044), so RLS was doing no
-- row-filtering to preserve. The view does the filtering that actually
-- matters — only the live square, never an expired post.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. 087 must be run
-- first (this depends on its column revoke).
-- ════════════════════════════════════════════════════════════════════════

begin;

drop view if exists public.square;

create view public.square as
  select
    l.id,
    l.body,
    l.pseudonym,
    l.created_at,
    l.expires_at,
    (l.author_id = auth.uid()) as is_mine
  from public.loft_posts l
  where l.expires_at > now();

comment on view public.square is
  'The live pseudonymous square, without the author. Definer semantics on purpose: the view reads author_id so no client ever has to, and is_mine answers the only question the client asked it for.';

revoke all on public.square from public, anon, authenticated;
grant select on public.square to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   as a member:  select * from square       → rows, is_mine, no author
--   as a member:  select author_id from loft_posts → permission denied
-- DONE.
