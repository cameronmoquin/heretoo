-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 020: post.slugline column
-- ════════════════════════════════════════════════════════════════════════
-- Adds an optional, small attribution line that renders bottom-right on
-- a PostCard. First use case: Shakespeare bot posts. The body is the
-- pure quote ("To be, or not to be…"), and the slugline says
-- "— Hamlet · Hamlet · III.i" so the attribution is visually
-- secondary to the line itself.
--
-- Generic on purpose — any post can carry a slugline. Future uses:
-- citing source on a longform post, attributing a translation, etc.
-- Free-form text, capped client-side at 120 chars to keep the bottom-
-- right corner from blowing up.
-- ════════════════════════════════════════════════════════════════════════

alter table public.posts
  add column if not exists slugline text;

-- DONE.
