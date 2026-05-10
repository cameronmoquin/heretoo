-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 039: Family Trivia
-- ════════════════════════════════════════════════════════════════════════
-- Each family has a small trivia bank that any active member can
-- contribute to. Questions are about the family — what year did Mom
-- start her garden? Who said the line about the burnt lasagna at
-- Easter? — written by someone in the family for the others to play.
--
-- Tone:
--   - No public leaderboard across families. The whole spec refuses
--     status anxiety; trivia keeps that line.
--   - Per-user counters within a single family ("you got 7 of 12 right
--     this month") are fine. Visible only to the user themselves.
--   - "On a streak" / "X days in a row" mechanics are explicitly out.
--     Streaks weaponize loss aversion; the spec says no.
--
-- Refusal list:
--   - No AI-generated questions. The whole point is that a real
--     family member wrote each one.
--   - No external trivia content (random pop culture, sports, etc.).
--     If you want NYT Mini, NYT Mini is a tab away.
-- ════════════════════════════════════════════════════════════════════════

-- 1. trivia_questions ──────────────────────────────────────────────────

create table if not exists public.trivia_questions (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade,
  question      text not null check (length(question) between 4 and 400),
  -- Four multiple-choice options as a jsonb array of strings.
  choices       jsonb not null,
  -- Index (0..3) of the correct choice.
  correct_index int not null check (correct_index between 0 and 3),
  explanation   text check (explanation is null or length(explanation) <= 800),
  -- Optional subject — if a Subject is set, the question only surfaces
  -- when the player has opted into trivia that mentions the subject.
  subject       text,
  retired_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- jsonb shape check: array of exactly 4 strings.
alter table public.trivia_questions
  add constraint trivia_questions_choices_shape
  check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4);

create index if not exists trivia_questions_family_idx
  on public.trivia_questions (family_id, created_at desc);

alter table public.trivia_questions enable row level security;

-- Active family members read.
drop policy if exists trivia_questions_read on public.trivia_questions;
create policy trivia_questions_read on public.trivia_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = trivia_questions.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- Active family members can author. The author_id must match.
drop policy if exists trivia_questions_insert on public.trivia_questions;
create policy trivia_questions_insert on public.trivia_questions
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = trivia_questions.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- Author can edit/retire their own.
drop policy if exists trivia_questions_update on public.trivia_questions;
create policy trivia_questions_update on public.trivia_questions
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists trivia_questions_delete on public.trivia_questions;
create policy trivia_questions_delete on public.trivia_questions
  for delete to authenticated
  using (auth.uid() = author_id);

-- 2. trivia_attempts ──────────────────────────────────────────────────

create table if not exists public.trivia_attempts (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid not null references public.trivia_questions(id) on delete cascade,
  player_id     uuid not null references public.profiles(id) on delete cascade,
  chosen_index  int not null check (chosen_index between 0 and 3),
  was_correct   boolean not null,
  attempted_at  timestamptz not null default now()
);

create index if not exists trivia_attempts_player_idx
  on public.trivia_attempts (player_id, attempted_at desc);
create index if not exists trivia_attempts_question_idx
  on public.trivia_attempts (question_id, attempted_at desc);

alter table public.trivia_attempts enable row level security;

-- Player sees their own history.
drop policy if exists trivia_attempts_self_read on public.trivia_attempts;
create policy trivia_attempts_self_read on public.trivia_attempts
  for select to authenticated
  using (auth.uid() = player_id);

drop policy if exists trivia_attempts_insert on public.trivia_attempts;
create policy trivia_attempts_insert on public.trivia_attempts
  for insert to authenticated
  with check (auth.uid() = player_id);

-- 3. RPC: pick a random unanswered (or rarely-answered) question ──────
-- Returns one question the caller has not answered today, drawn at
-- random from the family's bank (excluding retired questions and the
-- caller's own questions). The "answered today" filter prevents
-- back-to-back repeats.

create or replace function public.next_trivia_question(p_family_id uuid)
returns table (
  id            uuid,
  question      text,
  choices       jsonb,
  author_handle text,
  author_name   text
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select auth.uid() as id
  ),
  answered_today as (
    select question_id
    from public.trivia_attempts ta, viewer v
    where ta.player_id = v.id
      and ta.attempted_at > (now() - interval '24 hours')
  )
  select
    q.id,
    q.question,
    q.choices,
    p.handle,
    coalesce(p.display_name, p.handle)
  from public.trivia_questions q
  join viewer v on true
  left join public.profiles p on p.id = q.author_id
  where q.family_id = p_family_id
    and q.retired_at is null
    and q.author_id <> v.id
    and q.id not in (select question_id from answered_today)
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = q.family_id
        and fm.profile_id = v.id
        and fm.status = 'active'
    )
  order by random()
  limit 1;
$$;

grant execute on function public.next_trivia_question(uuid) to authenticated;

-- 4. RPC: count of correct vs total for the viewer in a family ────────

create or replace function public.trivia_score_for_viewer(p_family_id uuid)
returns table (
  correct_count int,
  total_count   int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where ta.was_correct)::int as correct_count,
    count(*)::int                                as total_count
  from public.trivia_attempts ta
  join public.trivia_questions q on q.id = ta.question_id
  where ta.player_id = auth.uid()
    and q.family_id = p_family_id;
$$;

grant execute on function public.trivia_score_for_viewer(uuid) to authenticated;

-- DONE.
