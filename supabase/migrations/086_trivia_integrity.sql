-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 086: the trivia score is the server's to keep
-- ════════════════════════════════════════════════════════════════════════
-- trivia_attempts stored a was_correct the CLIENT computed, and the
-- insert policy checked only that you were inserting as yourself. Any
-- member could POST a thousand rows with was_correct=true and take the
-- cross-cohort standings, which is the whole point of the game. The
-- answer key was readable too: correct_index sits on trivia_questions,
-- and RLS is row-level, so a member could read every answer before
-- playing.
--
-- Both are fixed the same way: the server scores the answer, and the
-- key stops being client-readable.
--
--   answer_trivia(question_id, chosen_index) reads the key, decides,
--   writes the attempt, and returns the verdict. It is the only way to
--   record one.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. No client writes an attempt directly, ever ────────────────────
drop policy if exists trivia_attempts_insert on public.trivia_attempts;
drop policy if exists trivia_attempts_self on public.trivia_attempts;
create policy trivia_attempts_read on public.trivia_attempts
  for select to authenticated
  using (player_id = auth.uid());
-- No insert/update/delete policy for clients. The definer below is the
-- only writer.


-- ── 2. The server scores it ──────────────────────────────────────────
create or replace function public.answer_trivia(
  p_question_id uuid,
  p_chosen_index int
)
returns table (was_correct boolean, correct_index int, explanation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  q      record;
  caller uuid := auth.uid();
  ok     boolean;
begin
  if caller is null then
    raise exception 'Must be signed in';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Guests do not play';
  end if;

  select tq.id, tq.family_id, tq.correct_index, tq.explanation
    into q
    from public.trivia_questions tq
   where tq.id = p_question_id;
  if not found then
    raise exception 'Question not found';
  end if;

  -- You play your own cohort's questions.
  if q.family_id is not null and not exists (
    select 1 from public.family_members fm
    where fm.family_id = q.family_id
      and fm.profile_id = caller
      and fm.status = 'active'
  ) then
    raise exception 'Not your question';
  end if;

  -- One attempt per question per player. A second call returns the
  -- verdict without recording anything new.
  ok := (q.correct_index = p_chosen_index);
  insert into public.trivia_attempts (question_id, player_id, chosen_index, was_correct)
    values (p_question_id, caller, p_chosen_index, ok)
    on conflict do nothing;

  return query select ok, q.correct_index, q.explanation;
end$$;

revoke all on function public.answer_trivia(uuid, int) from public, anon, authenticated;
grant execute on function public.answer_trivia(uuid, int) to authenticated;


-- ── 3. The answer key leaves the client ──────────────────────────────
-- RLS cannot hide a column, so the readable surface becomes a view
-- without the key, and the table stops being client-readable.
drop policy if exists trivia_questions_read on public.trivia_questions;
create policy trivia_questions_read on public.trivia_questions
  for select to authenticated
  using (
    family_id is null
    or exists (
      select 1 from public.family_members fm
      where fm.family_id = trivia_questions.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- The column-level lock. Postgres checks column privileges before RLS,
-- so this is what actually keeps the key.
revoke select on public.trivia_questions from authenticated;
grant select (
  id, family_id, prompt, choices, retired_at, created_at, created_by
) on public.trivia_questions to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   select correct_index from trivia_questions  → permission denied
--   insert into trivia_attempts                 → denied
--   select public.answer_trivia('<uuid>', 0)    → scores honestly
-- DONE.
