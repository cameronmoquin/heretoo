-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 089: the 24-hour timer becomes a choice
-- ════════════════════════════════════════════════════════════════════════
-- Nothing forces expiry any more. A public submission stays unless its
-- author arms the hourglass; expires_at = null means it stays. The
-- cohort/DM side already works this way (posts.expires_at was always
-- nullable); this brings the square level with it.
--
-- WHAT STAYS PUT, deliberately:
--   · The column DEFAULT (now() + 24h) survives. Any old cached bundle
--     still inserts without the column, and its author was told
--     "24 hours, then gone" by the UI they are looking at — the default
--     keeps that promise for them. The new client always sends the
--     field explicitly, so the default never touches it.
--   · Existing rows keep their stamps. Everyone who posted so far
--     posted under the 24-hour promise; none of them are silently
--     converted to permanent.
--   · purge_expired_loft_posts() is untouched: `expires_at <= now()` is
--     NULL for a null stamp, and a NULL predicate deletes nothing.
--
-- This also RE-STATES the square view in full, carrying 088's definer
-- fix, so it lands correctly whether or not 088 was ever run. (087 must
-- have run; the live 403 on loft_posts says it has.)
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 1. Null means "stays".
alter table public.loft_posts alter column expires_at drop not null;

-- 2. The read policy honors persistence.
drop policy if exists loft_posts_read on public.loft_posts;
create policy loft_posts_read on public.loft_posts
  for select to authenticated
  using (expires_at is null or expires_at > now());

-- 3. The square shows what is alive: unexpired, or never expiring.
--    Definer semantics per 088 — the view reads author_id so no client
--    ever has to, and is_mine answers the only question asked of it.
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
  where l.expires_at is null or l.expires_at > now();

comment on view public.square is
  'The live pseudonymous square, without the author. Definer semantics on purpose (088); null expires_at means the submission stays (089).';

revoke all on public.square from public, anon, authenticated;
grant select on public.square to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   insert into loft_posts (author_id, body, pseudonym, expires_at)
--     values (auth.uid(), 'stays', '<your handle>', null);
--   select body, expires_at from square;   → the row, null stamp
--   select author_id from loft_posts;      → permission denied (087)
-- DONE.
