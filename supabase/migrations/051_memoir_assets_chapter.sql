-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 051: chapter_assignment + ordering on memoir_assets
-- ════════════════════════════════════════════════════════════════════════
-- Photos need to land in a specific chapter of the book. Mirrors the
-- same column on memoir_responses (life_chapter / thematic_thread key,
-- nullable for unassigned).
-- ════════════════════════════════════════════════════════════════════════

alter table public.memoir_assets
  add column if not exists chapter_assignment text,
  add column if not exists ordering_hint int;

create index if not exists memoir_assets_chapter_idx
  on public.memoir_assets (project_id, chapter_assignment, ordering_hint);

-- DONE.
