-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 055: the brain
-- ════════════════════════════════════════════════════════════════════════
-- Canon distillations of Cameron's slate (novels, screenplays, libretti,
-- shorts) live here, one row per work: frontmatter fields + the full
-- brain markdown. This is the platform's private knowledge of its own
-- author's universe. Consumers are server-side features (character
-- bots, serialized fiction, the parlor, meme captions) via the service
-- role.
--
-- RLS: enabled with NO policies. The repo is public and the works are
-- unpublished; nothing here is client-readable. Only the service role
-- (which bypasses RLS) can touch it. When a work is published and its
-- material should surface, a feature exposes CURATED slices through its
-- own RPC, never this table directly.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.brain_entries (
  slug         text primary key,
  title        text not null,
  form         text,
  status       text,
  master       text,
  words_read   integer,
  content_md   text not null,
  updated_at   timestamptz not null default now()
);

alter table public.brain_entries enable row level security;
-- Deliberately no policies: service-role only.

-- DONE.
