-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 014: Shakespeare quotes catalogue
-- ════════════════════════════════════════════════════════════════════════
-- Cameron seeded the public feed with 50 Shakespeare quotes in one go.
-- Going forward we want a *scheduled* drip — 3 per day, no repeats
-- until everything's been posted.
--
-- This table holds the quote catalogue and tracks the last time each
-- one was posted. A Netlify Scheduled Function runs 3x daily, picks
-- the quote with the oldest `last_posted_at` (nulls first), inserts
-- a public post under the @shakespeare bot, and bumps the timestamp.
-- Auto-recycles forever once exhausted.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.shakespeare_quotes (
  id              serial primary key,
  quote           text not null,
  character       text not null,
  play            text not null,
  last_posted_at  timestamptz,
  post_id         uuid references public.posts(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (quote)
);

create index if not exists shakespeare_last_posted_idx
  on public.shakespeare_quotes(last_posted_at nulls first);

alter table public.shakespeare_quotes enable row level security;

-- Anyone signed in can read (they show on profile / about pages later).
drop policy if exists shakespeare_read on public.shakespeare_quotes;
create policy shakespeare_read on public.shakespeare_quotes
  for select to authenticated, anon using (true);

-- Writes only via service role (the scheduled function) — no client RLS.
-- DONE.
