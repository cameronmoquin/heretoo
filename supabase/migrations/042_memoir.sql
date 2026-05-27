-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 042: The Memoir
-- ════════════════════════════════════════════════════════════════════════
-- A guided life-story practice. Each day the platform offers the user
-- a single open-ended prompt — "What's a smell from childhood that
-- brings you straight back?" — and they answer in their own words.
-- Over a year the answers compile into a memoir. The user can keep
-- responses private (most), share specific ones with their family,
-- and eventually print the whole thing as a book.
--
-- This is the highest-leverage feature for the boomer generation.
-- Memoir is the thing they wish they'd asked their parents to write,
-- and the thing their grandchildren will wish they'd asked them. The
-- platform makes it a 5-minute daily ritual.
--
-- Refusal list:
--   - No "memoir scoring" or completion percentage. Not a quest.
--   - No public memoir leaderboards.
--   - No AI-generated memoir text. The user's voice is the entire
--     point. Read-aloud of the user's own writing is fine.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Curated prompt library (seeded by this migration) ────────────────

create table if not exists public.memoir_prompts (
  id            uuid primary key default gen_random_uuid(),
  prompt        text not null,
  category      text not null,
  -- Position in the recommended order — early prompts are gentler,
  -- later prompts get more reflective. The cron walks roughly in
  -- order but allows random within a category.
  position      int not null default 0,
  retired       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists memoir_prompts_position_idx
  on public.memoir_prompts (position) where retired = false;

alter table public.memoir_prompts enable row level security;

drop policy if exists memoir_prompts_read on public.memoir_prompts;
create policy memoir_prompts_read on public.memoir_prompts
  for select to authenticated using (true);

-- Seeded prompts. Open-ended on purpose — the kind that produce a
-- story, not a fact. Boomers will recognize each one as the door
-- into a memory.

insert into public.memoir_prompts (prompt, category, position) values
  -- Childhood
  ('What''s a smell from childhood that brings you straight back?', 'childhood', 1),
  ('Tell us about a teacher who scared you and a teacher who saved you.', 'childhood', 2),
  ('Who taught you how to swim, and where?', 'childhood', 3),
  ('What did Sundays look like growing up?', 'childhood', 4),
  ('What did your house smell like at dinner?', 'childhood', 5),
  ('Who was the meanest kid in your neighborhood?', 'childhood', 6),
  ('What was your favorite hiding place?', 'childhood', 7),
  ('Tell us about a song you sang as a child that you can still sing now.', 'childhood', 8),
  ('What did your mother carry in her purse?', 'childhood', 9),
  ('Where did you eat dinner as a child, and who was there?', 'childhood', 10),
  ('What was the first death you remember?', 'childhood', 11),
  ('Tell us about the longest you ever waited for something.', 'childhood', 12),
  ('What did you steal as a kid? Did anyone find out?', 'childhood', 13),
  ('What did you build with your own hands?', 'childhood', 14),
  ('What was the worst thing your sibling ever did to you?', 'childhood', 15),

  -- Family of origin
  ('What did your father do for work, and did he like it?', 'origin', 16),
  ('What did your mother want for herself that she didn''t get?', 'origin', 17),
  ('Tell us about a meal your grandmother made that you can taste right now.', 'origin', 18),
  ('Where did your grandparents come from? What did they leave behind?', 'origin', 19),
  ('What family secret did you discover late?', 'origin', 20),
  ('Was there a grandfather you wish you''d known better?', 'origin', 21),
  ('What did your parents fight about?', 'origin', 22),
  ('Who in your family was the storyteller?', 'origin', 23),
  ('What did your family do on Sunday afternoons?', 'origin', 24),
  ('What do you wish you''d asked your mother before she stopped answering?', 'origin', 25),

  -- Coming of age
  ('What did your bedroom look like when you were sixteen?', 'coming-of-age', 26),
  ('Tell us about the first time you fell in love.', 'coming-of-age', 27),
  ('What car do you remember from when you were learning to drive?', 'coming-of-age', 28),
  ('Where were you the night you learned about something hard for the first time?', 'coming-of-age', 29),
  ('What music played at your high school dances?', 'coming-of-age', 30),
  ('Did you have a job in high school? What did you spend the money on?', 'coming-of-age', 31),
  ('What did you think you''d be when you grew up — and how off were you?', 'coming-of-age', 32),
  ('Who was the person you most wanted to please when you were eighteen?', 'coming-of-age', 33),
  ('What''s a moment in your twenties you wish you could redo?', 'coming-of-age', 34),
  ('Where did you go on the first big trip you took without your parents?', 'coming-of-age', 35),

  -- Love and marriage
  ('Tell us how you met your spouse — the version with the smell of the room.', 'love', 36),
  ('What''s a song that reminds you of your wedding?', 'love', 37),
  ('What was your first apartment together?', 'love', 38),
  ('What did your spouse give up for the family that you wish was acknowledged?', 'love', 39),
  ('What''s the worst fight you ever had — and what did it teach you?', 'love', 40),
  ('Tell us about a date you remember in detail.', 'love', 41),
  ('What did you learn about love from someone who didn''t deserve it?', 'love', 42),
  ('What ritual got you through the hard years?', 'love', 43),

  -- Work and purpose
  ('What was the first paying job you ever had?', 'work', 44),
  ('Tell us about a boss who shaped you.', 'work', 45),
  ('What did you do at work that you were quietly proud of?', 'work', 46),
  ('When did you almost quit and didn''t?', 'work', 47),
  ('What''s a skill you have that nobody seems to value?', 'work', 48),
  ('Tell us about a coworker you still think about.', 'work', 49),
  ('What advice did you give your kids about work that you wish you''d taken?', 'work', 50),

  -- Parenting
  ('Tell us about the day you became a parent.', 'parenting', 51),
  ('What''s a thing you swore you''d never do as a parent — and then did?', 'parenting', 52),
  ('Tell us about a bedtime ritual.', 'parenting', 53),
  ('What did your child teach you about yourself?', 'parenting', 54),
  ('What''s a moment with your child you keep replaying?', 'parenting', 55),

  -- Reflections
  ('What''s a regret that turned out to be a gift?', 'reflection', 56),
  ('Where do you most want your ashes scattered?', 'reflection', 57),
  ('What''s a photograph you wish you had?', 'reflection', 58),
  ('Tell us about a stranger who was kind to you when you needed it.', 'reflection', 59),
  ('What do you want your grandchildren to remember about you?', 'reflection', 60)
on conflict do nothing;

-- 2. memoir_responses ─────────────────────────────────────────────────

create table if not exists public.memoir_responses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  prompt_id       uuid not null references public.memoir_prompts(id) on delete cascade,
  body            text not null check (length(body) between 1 and 8000),
  audio_url       text,
  -- When true, a sibling post in the user's family carries the same
  -- text. shared_post_id links to that post for de-dup edits.
  is_shared       boolean not null default false,
  shared_post_id  uuid references public.posts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, prompt_id)
);

create index if not exists memoir_responses_user_idx
  on public.memoir_responses (user_id, created_at desc);

alter table public.memoir_responses enable row level security;

-- Default: only the author reads their own responses.
drop policy if exists memoir_responses_self_read on public.memoir_responses;
create policy memoir_responses_self_read on public.memoir_responses
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists memoir_responses_insert on public.memoir_responses;
create policy memoir_responses_insert on public.memoir_responses
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists memoir_responses_update on public.memoir_responses;
create policy memoir_responses_update on public.memoir_responses
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists memoir_responses_delete on public.memoir_responses;
create policy memoir_responses_delete on public.memoir_responses
  for delete to authenticated
  using (auth.uid() = user_id);

-- 3. RPC: today's prompt for the viewer ──────────────────────────────
-- Picks the next prompt the user hasn't answered yet, in roughly the
-- recommended order (gentle → reflective).

create or replace function public.todays_memoir_prompt()
returns table (
  id       uuid,
  prompt   text,
  category text,
  "position" int
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.prompt, p.category, p."position"
  from public.memoir_prompts p
  where p.retired = false
    and not exists (
      select 1 from public.memoir_responses r
      where r.user_id = auth.uid() and r.prompt_id = p.id
    )
  order by p."position" asc
  limit 1;
$$;

grant execute on function public.todays_memoir_prompt() to authenticated;

-- 4. RPC: count of answered prompts for the viewer ──────────────────

create or replace function public.memoir_progress_for_viewer()
returns table (
  answered_count int,
  total_count    int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.memoir_responses where user_id = auth.uid()),
    (select count(*)::int from public.memoir_prompts where retired = false);
$$;

grant execute on function public.memoir_progress_for_viewer() to authenticated;

-- 5. Trigger: bump updated_at ────────────────────────────────────────

create or replace function public.touch_memoir_responses_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists memoir_responses_touch_updated on public.memoir_responses;
create trigger memoir_responses_touch_updated
  before update on public.memoir_responses
  for each row execute function public.touch_memoir_responses_updated_at();

-- DONE.
