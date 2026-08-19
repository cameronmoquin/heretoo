-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 091: the memoir stops naming itself
-- ════════════════════════════════════════════════════════════════════════
-- memoir_projects.title has defaulted to 'My Life, So Far' since 047 —
-- a phrase nobody cleared, stamped onto every project and shown as the
-- page heading. A page heading is the page's name, and a book's title
-- belongs to its author. The default becomes the plain room name, and
-- every project still carrying the old default is cleaned to match.
-- A title the author typed themselves is left exactly alone.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.memoir_projects alter column title set default 'Memoir';

update public.memoir_projects
  set title = 'Memoir'
  where title = 'My Life, So Far';

commit;

-- ── Verify ───────────────────────────────────────────────────────────
--   select distinct title from memoir_projects;  → no 'My Life, So Far'
-- DONE.
