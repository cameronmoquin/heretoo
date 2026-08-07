-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 076: the memoir interview gets a spine
-- ════════════════════════════════════════════════════════════════════════
-- The prompt library (048) was always structured — ten life chapters in
-- chronological order, numbered prompts inside each — but the picker
-- rolled dice: 35% of picks jumped to a random thematic thread and ties
-- broke on random(). The interview READ as random because the picker
-- was.
--
-- Now the interview is a build, in order:
--
--   1. It opens with the only first question a life story has:
--      when and where were you born.
--   2. The chronological spine runs whole, chapter by chapter,
--      prompts in their numbered order: before_me → earliest_memories
--      → childhood → adolescence → young_adulthood →
--      coming_into_yourself → building_a_life → middle → older → now.
--   3. When the spine is answered, the thematic threads follow, one at
--      a time, in a fixed order: food, money, hands, body, music,
--      faith, places, work, losses, people, things you have kept,
--      things you have buried, what you believe now, what you would
--      tell your younger self.
--
-- photo_specific prompts stay OUT of this sequence — they belong to
-- the photos flow, where a photograph is the question.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The opening question ───────────────────────────────────────────
-- Slug sorts before before_me_001, so ordering alone puts it first.
INSERT INTO public.memoir_prompts
  (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES (
  '00000000-0000-4000-a000-000000000076',
  'before_me_000',
  'life_chapter',
  'before_me',
  $$When and where were you born?$$,
  $$[
    {"question":"What have you been told about that day?","condition_hint":"user_gave_date_and_place"},
    {"question":"Who was there?","condition_hint":"user_mentioned_family_present"},
    {"question":"What was that place like then?","condition_hint":"user_named_a_town_or_hospital"}
  ]$$::jsonb,
  ARRAY[]::text[],
  1,
  false
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  difficulty = EXCLUDED.difficulty;


-- ── 2. The picker, without dice ───────────────────────────────────────
create or replace function public.pick_next_memoir_prompt(p_project_id uuid)
returns table (
  id                uuid,
  slug              text,
  category          text,
  chapter_or_thread text,
  primary_question  text,
  follow_ups        jsonb,
  tags              text[],
  difficulty        int,
  triggers_warning  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.memoir_projects
     where memoir_projects.id = p_project_id and author_id = auth.uid()
  ) then
    return;
  end if;

  return query
    select p.id, p.slug, p.category, p.chapter_or_thread,
           p.primary_question, p.follow_ups, p.tags,
           p.difficulty, p.triggers_warning
      from public.memoir_prompts p
     where p.slug is not null
       and coalesce(p.chapter_or_thread, '') <> 'photo_specific'
       and not exists (
         select 1 from public.memoir_responses r
          where r.project_id = p_project_id
            and r.prompt_id = p.id
       )
     order by
       coalesce(array_position(ARRAY[
         'before_me', 'earliest_memories', 'childhood', 'adolescence',
         'young_adulthood', 'coming_into_yourself', 'building_a_life',
         'middle', 'older', 'now',
         'food', 'money', 'hands', 'body', 'music', 'faith', 'places',
         'work', 'losses', 'people', 'things_you_have_kept',
         'things_you_have_buried', 'what_you_believe_now',
         'what_you_would_tell_younger_self'
       ], p.chapter_or_thread), 99),
       p.slug
     limit 1;
end$$;

revoke all on function public.pick_next_memoir_prompt(uuid) from public, anon, authenticated;
grant execute on function public.pick_next_memoir_prompt(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ── Verify ────────────────────────────────────────────────────────────
--   A fresh project's first pick should return slug 'before_me_000':
--   the born question. Answered prompts never repeat; the arc advances
--   one chapter at a time.
-- DONE.
