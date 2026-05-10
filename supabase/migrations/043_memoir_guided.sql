-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 043: Memoir guidance toggle + per-prompt starters
-- ════════════════════════════════════════════════════════════════════════
-- People need to be guided when they're staring at a blank page. The
-- Memoir feature now offers:
--   - Inline starter suggestions per prompt (5 specific angles to begin)
--   - On-demand grammar/spell check (the user asks; never automatic)
--   - A structural overview that groups responses by life chapter
-- The user can turn guidance off in profile settings.
--
-- This migration adds the toggle to profiles and seeds per-prompt
-- starter suggestions for each of the 60 prompts shipped in 042.
-- The starters are NOT AI-generated. They're written by us as
-- doorways into the prompt — concrete, sensory, specific. You pick
-- one and start there.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Profile setting ────────────────────────────────────────────────

alter table public.profiles
  add column if not exists memoir_guided boolean not null default true;

-- 2. Starter suggestions per prompt ─────────────────────────────────

alter table public.memoir_prompts
  add column if not exists starters text[] not null default '{}';

-- Seeded starters per prompt. Each row gets 4-5 concrete angles a
-- writer can pick up and run with. The cursor doesn't blink at them.

update public.memoir_prompts set starters = array[
  'The kitchen on a Sunday morning',
  'A car on a long drive',
  'Your grandmother''s hands',
  'A particular soap or detergent',
  'A school cafeteria'
] where prompt like 'What''s a smell from childhood%';

update public.memoir_prompts set starters = array[
  'Start with the one you''re afraid to remember',
  'Tell us their full name first',
  'A line they said that you can still hear',
  'A specific classroom — describe the desks',
  'What you wore to school that year'
] where prompt like 'Tell us about a teacher who scared you%';

update public.memoir_prompts set starters = array[
  'A pool, a lake, an ocean, or a bathtub',
  'Name the person and what they yelled across the water',
  'What the bottom felt like under your feet',
  'The first time you went under and came back up',
  'Whether you were brave or afraid'
] where prompt like 'Who taught you how to swim%';

update public.memoir_prompts set starters = array[
  'Church or no church, and what came after',
  'A specific Sunday dinner — what was on the table',
  'What was on the radio or TV',
  'Whose house you went to',
  'What you wore'
] where prompt like 'What did Sundays look like growing up%';

update public.memoir_prompts set starters = array[
  'A specific dish — onions, garlic, something simmering',
  'The ventilation, or lack of it',
  'What smelled wrong on the bad days',
  'Bread baking, oil heating, a pot left too long',
  'Your father coming in from work'
] where prompt like 'What did your house smell like at dinner%';

update public.memoir_prompts set starters = array[
  'Their first and last name',
  'Why they were mean — what they were afraid of',
  'What they did to you, specifically, once',
  'Whether they got better or worse later',
  'Whether you still think about them'
] where prompt like 'Who was the meanest kid in your neighborhood%';

update public.memoir_prompts set starters = array[
  'A closet — the sound of the hangers',
  'Behind a couch or a chair',
  'A spot outside, in nature',
  'Under a bed or table',
  'Somewhere only you knew'
] where prompt like 'What was your favorite hiding place%';

update public.memoir_prompts set starters = array[
  'A song from school',
  'A song your mother sang while doing the dishes',
  'A song from church or temple',
  'A jingle from television',
  'A song you sang to yourself when you were scared'
] where prompt like 'Tell us about a song you sang as a child%';

update public.memoir_prompts set starters = array[
  'Lipstick, a comb, mints',
  'Photos of you',
  'Receipts she never threw away',
  'Something she carried in case of emergency',
  'What it smelled like when you opened it'
] where prompt like 'What did your mother carry in her purse%';

update public.memoir_prompts set starters = array[
  'The kitchen table, the dining room, or the TV trays',
  'Who sat where',
  'Who said grace, or didn''t',
  'What was always on the table',
  'What was never allowed'
] where prompt like 'Where did you eat dinner as a child%';

-- For prompts we haven't hand-curated, leave starters empty — the
-- guidance widget falls back to a generic helper line. Adding more
-- specific starters is an editorial follow-up.

-- 3. Audit table for grammar-check runs (privacy-by-construction) ───
-- Stores ONLY metadata + counts. The text itself never persists.

create table if not exists public.memoir_edit_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  response_id   uuid references public.memoir_responses(id) on delete set null,
  text_length   int not null,
  edits_offered int not null,
  ran_at        timestamptz not null default now()
);

create index if not exists memoir_edit_runs_user_idx
  on public.memoir_edit_runs (user_id, ran_at desc);

alter table public.memoir_edit_runs enable row level security;

drop policy if exists memoir_edit_runs_self_read on public.memoir_edit_runs;
create policy memoir_edit_runs_self_read on public.memoir_edit_runs
  for select to authenticated using (auth.uid() = user_id);

-- Inserts come from the service-role function only.

-- 4. Refresh todays_memoir_prompt to include starters ─────────────────

create or replace function public.todays_memoir_prompt()
returns table (
  id        uuid,
  prompt    text,
  category  text,
  position  int,
  starters  text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.prompt, p.category, p.position, p.starters
  from public.memoir_prompts p
  where p.retired = false
    and not exists (
      select 1 from public.memoir_responses r
      where r.user_id = auth.uid() and r.prompt_id = p.id
    )
  order by p.position asc
  limit 1;
$$;

grant execute on function public.todays_memoir_prompt() to authenticated;

-- DONE.
