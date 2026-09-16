-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 096: the FSOT knowledge bank gets a home
-- ════════════════════════════════════════════════════════════════════════
-- The feed is turning incidentally educational: historical figures will
-- post facts about US foreign affairs, wars, and diplomacy, and answer
-- replies FROM THIS TABLE — never from imagination. The schema is the
-- fsot-trainer's own (same columns, same names), so the trainer's
-- bank.sql loads here verbatim: run this migration, then paste bank.sql
-- into the same SQL editor and run it.
--
-- Clients read; nothing client-side writes. The posting and reply
-- workers use the service role. Re-importing after a bank rebuild:
-- truncate public.fsot_questions first, then paste the new bank.sql.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.fsot_questions (
  id           text primary key,
  topic        text not null,
  subtopic     text,
  difficulty   integer,
  prompt       text not null,
  options      jsonb,
  answer       integer,
  explanation  text
);

alter table public.fsot_questions enable row level security;

drop policy if exists fsot_questions_read on public.fsot_questions;
create policy fsot_questions_read on public.fsot_questions
  for select to authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policies: the bank is loaded by hand in
-- the SQL editor and read by service-role workers. A client cannot
-- teach the teacher.

create index if not exists fsot_questions_topic_idx
  on public.fsot_questions (topic, subtopic);

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   after pasting bank.sql:
--   select topic, count(*) from fsot_questions group by 1 order by 1;
--   → nine topics with healthy counts
-- DONE.
