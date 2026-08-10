-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 086: the trivia score is the server's to keep
-- ════════════════════════════════════════════════════════════════════════
-- trivia_attempts stored a was_correct the CLIENT computed, and the
-- insert policy checked only that you were inserting as yourself. Any
-- member could POST a thousand rows with was_correct = true and take
-- the cross-cohort standings, which is the whole point of the game.
--
-- answer_trivia(question_id, chosen_index) now reads the key, decides,
-- writes the attempt, and returns the verdict. It is the only way an
-- attempt is ever recorded.
--
-- KNOWN AND ACCEPTED: correct_index stays readable by members of the
-- cohort a question belongs to. RLS is row-level, so hiding one column
-- means revoking it from the role, and the author of a question has to
-- see the answer to their own question on the manage screen. Reading
-- ahead is therefore still possible for someone who opens a console —
-- but it no longer buys a forged score, and this is a game played
-- among people who know each other. The forgery was the real hole.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. No client writes an attempt directly, ever ────────────────────
drop policy if exists trivia_attempts_insert on public.trivia_attempts;
drop policy if exists trivia_attempts_self on public.trivia_attempts;

drop policy if exists trivia_attempts_read on public.trivia_attempts;
create policy trivia_attempts_read on public.trivia_attempts
  for select to authenticated
  using (player_id = auth.uid());
-- No insert / update / delete policy for clients. The definer below is
-- the only writer, and it bypasses RLS by design.


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
  q_family_id  uuid;
  q_correct    int;
  q_expl       text;
  caller       uuid := auth.uid();
  ok           boolean;
begin
  if caller is null then
    raise exception 'Must be signed in';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Guests do not play';
  end if;

  select tq.family_id, tq.correct_index, tq.explanation
    into q_family_id, q_correct, q_expl
    from public.trivia_questions tq
   where tq.id = p_question_id;

  if q_family_id is null and q_correct is null then
    raise exception 'Question not found';
  end if;

  -- You answer your own cohort's questions.
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = q_family_id
      and fm.profile_id = caller
      and fm.status = 'active'
  ) then
    raise exception 'Not your question';
  end if;

  ok := (q_correct = p_chosen_index);

  insert into public.trivia_attempts (question_id, player_id, chosen_index, was_correct)
    values (p_question_id, caller, p_chosen_index, ok)
    on conflict do nothing;

  return query select ok, q_correct, q_expl;
end$$;

revoke all on function public.answer_trivia(uuid, int) from public, anon, authenticated;
grant execute on function public.answer_trivia(uuid, int) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────────────────
--   insert into trivia_attempts directly  → denied
--   select public.answer_trivia(id, 0)    → scores honestly, records once
-- DONE.
