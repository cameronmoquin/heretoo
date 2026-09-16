-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 097: the historical faculty keeps a ledger
-- ════════════════════════════════════════════════════════════════════════
-- Two pieces of bookkeeping for the figures who replace Shakespeare.
--
-- 1. The bank learns when each fact was last taught, so the daily drip
--    walks the whole curriculum oldest-first instead of repeating
--    favorites (the exact pattern shakespeare_quotes.last_posted_at
--    served).
--
-- 2. A reply ledger, keyed by the user comment answered, so a figure
--    answers each question exactly once no matter how often the worker
--    wakes. RLS on, no policies: the workers hold the service role and
--    clients have no business here.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

alter table public.fsot_questions
  add column if not exists last_posted_at timestamptz,
  add column if not exists posted_post_id uuid references public.posts(id) on delete set null;

create index if not exists fsot_questions_drip_idx
  on public.fsot_questions (last_posted_at nulls first);

create table if not exists public.fsot_replies (
  comment_id  uuid primary key references public.comments(id) on delete cascade,
  post_id     uuid references public.posts(id) on delete cascade,
  figure      text,
  created_at  timestamptz not null default now()
);

alter table public.fsot_replies enable row level security;
-- No policies on purpose: service-role only.

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   select count(*) from fsot_questions where last_posted_at is null;
--   → the whole bank, until the first drip runs
-- DONE.
