-- Memoir prompt library v1 — 390 prompts seeded from memoir_prompt_library_v1.json

-- The legacy `prompt` column (from 042) was NOT NULL. The new seed
-- writes `primary_question` instead. Relax the constraint so seed
-- rows that omit `prompt` succeed; the column stays for back-compat.
alter table public.memoir_prompts
  alter column prompt drop not null;

-- Retire all existing seeded prompts. The retired_at column is added by a later migration;
-- guard the update so this migration is idempotent if the column does not yet exist.
do $retire$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'memoir_prompts'
       and column_name = 'retired_at'
  ) then
    update public.memoir_prompts set retired_at = now() where retired_at is null;
  end if;
end
$retire$;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a65fde8f-728c-41d4-954f-b6634e427930', 'before_me_001', 'life_chapter', 'before_me', $$What did your parents do for work when you were born?$$, $$[{"question":"Was that work they were proud of?","condition_hint":"user_named_specific_work"},{"question":"Did either of them want to be doing something else?","condition_hint":"user_mentioned_aspiration_or_regret"},{"question":"What did the house smell like when they came home from work?","condition_hint":"user_described_evening_routine"},{"question":"Did you ever go with them to where they worked?","condition_hint":"user_mentioned_workplace_visit"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7e020c8d-ed0a-4779-a8e2-6c695362e67f', 'before_me_002', 'life_chapter', 'before_me', $$What were your parents' names, and what did people call them?$$, $$[{"question":"Were they ever called something different in different places?","condition_hint":"user_mentioned_nicknames"},{"question":"Did anyone call them by their childhood name?","condition_hint":"user_mentioned_old_name"},{"question":"What did you call each of them?","condition_hint":"user_did_not_say_what_they_called_parents"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0b407d31-7c3a-44e4-bc46-d032a3cd6ff4', 'before_me_003', 'life_chapter', 'before_me', $$Where were your parents born, and how did they end up where you were born?$$, $$[{"question":"Did they ever talk about the place they came from?","condition_hint":"user_mentioned_origin_place"},{"question":"Did they go back to visit?","condition_hint":"user_mentioned_homeland"},{"question":"Was there a language they spoke that you didn't?","condition_hint":"user_mentioned_language_or_immigration"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3b6d4ae1-d88e-443d-a78e-55a94ec21e3c', 'before_me_004', 'life_chapter', 'before_me', $$What do you know about your grandparents?$$, $$[{"question":"Did you ever meet any of them?","condition_hint":"user_described_grandparents"},{"question":"What's the oldest story about your family that you know?","condition_hint":"user_seemed_invested_in_lineage"},{"question":"Was there one grandparent who told you stories about the old days?","condition_hint":"user_mentioned_storytelling_grandparent"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ac98bf13-8560-4c68-9cac-0da3bbb63b75', 'before_me_005', 'life_chapter', 'before_me', $$What was happening in the world the year you were born?$$, $$[{"question":"Did your family ever talk about that time?","condition_hint":"user_named_a_historical_event"},{"question":"Was there anything happening in your hometown that year?","condition_hint":"user_named_hometown"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('94c54797-d81a-42bb-b4c5-d8435ed8a1d3', 'before_me_006', 'life_chapter', 'before_me', $$How did your parents meet?$$, $$[{"question":"Do you know the year?","condition_hint":"user_described_meeting"},{"question":"Was the family on either side happy about it?","condition_hint":"user_mentioned_family_reaction"},{"question":"How long before they were married?","condition_hint":"user_did_not_mention_marriage"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('af2d1237-09c2-4321-a489-b9b2defb26bf', 'before_me_007', 'life_chapter', 'before_me', $$Did you have older brothers or sisters when you were born?$$, $$[{"question":"How much older were they?","condition_hint":"user_mentioned_siblings"},{"question":"Did they help raise you?","condition_hint":"user_described_older_sibling_role"},{"question":"Were you the first child? The last? The middle?","condition_hint":"user_did_not_specify_birth_order"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1780c721-b1a7-46d1-b037-15ed1cbc734c', 'before_me_008', 'life_chapter', 'before_me', $$What was the house or apartment you were born into?$$, $$[{"question":"Do you remember it, or do you only know it from stories and photos?","condition_hint":"user_described_home"},{"question":"Did your family own it or rent?","condition_hint":"user_described_ownership"},{"question":"Was there a yard, a stoop, a balcony?","condition_hint":"user_described_outdoor_space"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('de557e82-5b2c-43ca-8f86-5010517ce095', 'before_me_009', 'life_chapter', 'before_me', $$Was there a story your family told about your birth?$$, $$[{"question":"Who told the story most often?","condition_hint":"user_recalled_a_birth_story"},{"question":"Did the story change depending on who told it?","condition_hint":"user_mentioned_multiple_versions"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fec4d24e-a453-4a17-805d-510c4cd99b05', 'before_me_010', 'life_chapter', 'before_me', $$What did your parents do during the war, or the depression, or whatever the big event of their generation was?$$, $$[{"question":"Did they talk about it, or stay quiet?","condition_hint":"user_described_parents_response_to_history"},{"question":"Was there a particular thing they refused to discuss?","condition_hint":"user_mentioned_silence_or_taboo"},{"question":"Did they keep anything from that time? A uniform, a letter, a ration book?","condition_hint":"user_mentioned_keepsake"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('dba3fe7a-1670-451b-b8b7-f839d963b5e7', 'before_me_011', 'life_chapter', 'before_me', $$What was your family's religion, if any?$$, $$[{"question":"Was it a strict household or a relaxed one?","condition_hint":"user_described_religious_practice"},{"question":"Did your parents agree about religion, or did they disagree?","condition_hint":"user_mentioned_disagreement"},{"question":"Did your grandparents practice differently than your parents?","condition_hint":"user_named_grandparents_practice"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a6d155c3-6727-49bf-a55b-cae8cd79d7ae', 'before_me_012', 'life_chapter', 'before_me', $$What languages were spoken in your home?$$, $$[{"question":"Did your parents speak something to each other that they didn't speak to you?","condition_hint":"user_described_multiple_languages"},{"question":"Are there words from that language you still use?","condition_hint":"user_mentioned_a_specific_word"},{"question":"Did you learn the language as a child or only later?","condition_hint":"user_described_language_acquisition"}]$$::jsonb, ARRAY['immigration']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3a669fc9-ce5e-4593-aa6e-48962a80cec2', 'before_me_013', 'life_chapter', 'before_me', $$What were your parents' hobbies?$$, $$[{"question":"Did they do those things alone or with each other?","condition_hint":"user_named_hobbies"},{"question":"Did you do any of those things with them?","condition_hint":"user_mentioned_shared_activity"},{"question":"Did they have time for hobbies, or were they too tired?","condition_hint":"user_described_parents_exhaustion"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('56d87a09-0663-4fcf-8d4e-8db4f0b12adb', 'before_me_014', 'life_chapter', 'before_me', $$Was there a person in your parents' life who shaped them, who you knew about even if you didn't know them?$$, $$[{"question":"What did your parents say about that person?","condition_hint":"user_named_a_significant_figure"},{"question":"Did you ever meet them?","condition_hint":"user_described_relationship"},{"question":"Did you understand at the time why they mattered?","condition_hint":"user_described_significance"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('284b262b-1180-46aa-8508-9a1d19f02142', 'before_me_015', 'life_chapter', 'before_me', $$What's something you wish you had asked your parents while they were alive?$$, $$[{"question":"Why didn't you ask?","condition_hint":"user_named_specific_question"},{"question":"Has anyone in your family asked it since?","condition_hint":"user_mentioned_others"},{"question":"If you could ask now, what do you think they would say?","condition_hint":"user_seemed_open_to_speculation"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ac11d00f-81ed-4300-be40-1e118dfc9af4', 'earliest_memories_001', 'life_chapter', 'earliest_memories', $$What is the earliest thing you remember?$$, $$[{"question":"How old do you think you were?","condition_hint":"user_described_a_specific_memory"},{"question":"Was it a place, a person, or a feeling?","condition_hint":"user_described_memory_type"},{"question":"Have you talked about this memory with anyone before?","condition_hint":"user_seemed_to_be_discovering_it"},{"question":"Did anyone in your family ever confirm that it really happened?","condition_hint":"user_seemed_uncertain_about_the_memory"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1fb35fbb-b911-4d5d-9336-9ac2c8a2fff2', 'earliest_memories_002', 'life_chapter', 'earliest_memories', $$What did your mother smell like?$$, $$[{"question":"When did you first notice that smell?","condition_hint":"user_named_a_specific_smell"},{"question":"Do you ever smell it now?","condition_hint":"user_associated_smell_with_a_place"},{"question":"Did her smell change as she got older?","condition_hint":"user_seemed_emotionally_open"},{"question":"Did your father smell different?","condition_hint":"user_did_not_mention_father"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c3447615-ee18-49f2-bfdd-d5052b3b7502', 'earliest_memories_003', 'life_chapter', 'earliest_memories', $$What did your father smell like?$$, $$[{"question":"Was it from his work? His soap? His tobacco?","condition_hint":"user_named_a_smell_source"},{"question":"Did it change when he came home in the evening?","condition_hint":"user_described_homecoming"},{"question":"Do you smell it on anyone else now?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('33c5fbb3-7b5e-46d7-a706-5f0f1af30b2f', 'earliest_memories_004', 'life_chapter', 'earliest_memories', $$What was your bed like as a small child?$$, $$[{"question":"Did you share a room with anyone?","condition_hint":"user_described_bed_or_bedroom"},{"question":"Was there something you slept with — a doll, a blanket, a stuffed animal?","condition_hint":"user_did_not_mention_comfort_object"},{"question":"Were you ever afraid in that room at night?","condition_hint":"user_mentioned_sleep_or_dreams"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4a54b8e3-632a-4655-b09c-b5c4751af2a4', 'earliest_memories_005', 'life_chapter', 'earliest_memories', $$What were the sounds of your childhood house?$$, $$[{"question":"Was there a clock that ticked? A radiator that knocked?","condition_hint":"user_named_specific_sounds"},{"question":"Could you hear neighbors?","condition_hint":"user_mentioned_neighbors"},{"question":"Was it a loud house or a quiet one?","condition_hint":"user_described_volume"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6414aed2-a34f-4a91-9ba3-6469f1d17c10', 'earliest_memories_006', 'life_chapter', 'earliest_memories', $$Who took care of you when your parents weren't there?$$, $$[{"question":"How often did your parents leave you with that person?","condition_hint":"user_named_a_caregiver"},{"question":"What did you eat at their house?","condition_hint":"user_described_extended_family_caregiver"},{"question":"Did they treat you differently than your parents did?","condition_hint":"user_described_relationship"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d71c19df-a562-4336-9aee-54fa1cb474c6', 'earliest_memories_007', 'life_chapter', 'earliest_memories', $$What did your parents argue about, when you were too young to understand?$$, $$[{"question":"Did they argue in front of you, or behind closed doors?","condition_hint":"user_described_arguments"},{"question":"Did you have a place you went to when they argued?","condition_hint":"user_described_coping"},{"question":"Were there things they never argued about that you wish they had?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('81b52be6-bf62-4fb4-8fed-9a4bf68f492d', 'earliest_memories_008', 'life_chapter', 'earliest_memories', $$What was the first time you remember being afraid?$$, $$[{"question":"What were you afraid of?","condition_hint":"user_described_fear"},{"question":"Who, if anyone, helped?","condition_hint":"user_mentioned_a_helper"},{"question":"Did you stay afraid of that thing, or did the fear pass?","condition_hint":"user_seemed_open_to_continuing"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('02187a38-ac66-483f-ad41-0c945c8d4776', 'earliest_memories_009', 'life_chapter', 'earliest_memories', $$What's the first food you remember loving?$$, $$[{"question":"Who made it?","condition_hint":"user_named_a_specific_food"},{"question":"Do you still eat it?","condition_hint":"user_seemed_nostalgic"},{"question":"Have you ever made it for your own children?","condition_hint":"user_mentioned_family_continuity"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('468c38a4-8bef-4b7f-9f77-d1dc0ddfd742', 'earliest_memories_010', 'life_chapter', 'earliest_memories', $$What's the first food you remember refusing?$$, $$[{"question":"Did your parents make you eat it anyway?","condition_hint":"user_named_a_specific_food"},{"question":"Do you eat it now?","condition_hint":"user_described_resolution"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4544c536-5dce-4721-91d1-f925296032da', 'earliest_memories_011', 'life_chapter', 'earliest_memories', $$What was the first song you remember someone singing to you?$$, $$[{"question":"Who sang it?","condition_hint":"user_named_a_song_or_lullaby"},{"question":"Did they sing it well or badly?","condition_hint":"user_described_singer"},{"question":"Have you sung it to anyone else?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c89edc97-c350-4df9-b0b0-f54889853e6f', 'earliest_memories_012', 'life_chapter', 'earliest_memories', $$What was the first place you remember being lost?$$, $$[{"question":"How long were you lost?","condition_hint":"user_described_being_lost"},{"question":"Who found you, and what did they say?","condition_hint":"user_described_being_found"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a2f8fffe-7267-4161-b134-bdaad89943b5', 'earliest_memories_013', 'life_chapter', 'earliest_memories', $$What did you call your grandparents?$$, $$[{"question":"Where did those names come from?","condition_hint":"user_named_grandparent_names"},{"question":"Did you have different names for the two sides of the family?","condition_hint":"user_mentioned_one_side_only"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('584fb3ca-323f-41c1-8487-82aa11948a12', 'earliest_memories_014', 'life_chapter', 'earliest_memories', $$What was your favorite place in your house when you were small?$$, $$[{"question":"What did you do there?","condition_hint":"user_described_a_place"},{"question":"Did anyone else know it was your favorite?","condition_hint":"user_described_secret_place"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f5fc1855-e168-4424-9a1a-14c6eeba6258', 'earliest_memories_015', 'life_chapter', 'earliest_memories', $$What was your father wearing when you were small?$$, $$[{"question":"Did he wear the same kind of clothes every day?","condition_hint":"user_described_specific_clothing"},{"question":"Did he change when he came home from work?","condition_hint":"user_mentioned_work_clothes"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b27c88e6-6feb-4253-a1ca-c9e8a575c3df', 'earliest_memories_016', 'life_chapter', 'earliest_memories', $$What was your mother wearing when you were small?$$, $$[{"question":"Did she dress up for any particular things?","condition_hint":"user_described_specific_clothing"},{"question":"Did she wear something every day that you remember?","condition_hint":"user_mentioned_uniform_or_apron"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3261909c-d47b-4e84-afd4-457225a15a74', 'earliest_memories_017', 'life_chapter', 'earliest_memories', $$Did you have a pet when you were small?$$, $$[{"question":"What was its name?","condition_hint":"user_described_a_pet"},{"question":"Whose pet was it really — yours, or your parents'?","condition_hint":"user_described_relationship_to_pet"},{"question":"How did you lose it?","condition_hint":"user_seemed_open_to_continuing"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b1f639de-eaff-4090-adac-afd5fcb0556b', 'earliest_memories_018', 'life_chapter', 'earliest_memories', $$Was there a neighbor you remember?$$, $$[{"question":"What did they look like?","condition_hint":"user_named_a_neighbor"},{"question":"Did your parents talk about them when they weren't there?","condition_hint":"user_described_complicated_relationship"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a057f90d-cccf-4728-b25e-107acae7297e', 'earliest_memories_019', 'life_chapter', 'earliest_memories', $$What did the floor of your childhood house feel like under your feet?$$, $$[{"question":"Was it cold in winter?","condition_hint":"user_described_floor_material"},{"question":"Did you walk barefoot, or did your parents make you wear slippers?","condition_hint":"user_described_household_rules"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fa3f2452-5454-41fc-b1e2-f15c799169a0', 'earliest_memories_020', 'life_chapter', 'earliest_memories', $$What's the first big event you remember happening to your family?$$, $$[{"question":"How did you find out about it?","condition_hint":"user_described_an_event"},{"question":"How did the adults around you behave?","condition_hint":"user_described_adult_behavior"},{"question":"Did anyone explain it to you, or did you have to piece it together?","condition_hint":"user_described_being_kept_in_the_dark"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('07e01de3-a78e-47ec-b804-c140e28b91d5', 'childhood_001', 'life_chapter', 'childhood', $$What did you do all day in the summer?$$, $$[{"question":"Where did you go?","condition_hint":"user_described_summer_routine"},{"question":"Were you alone or with other kids?","condition_hint":"user_described_companionship"},{"question":"What time did you have to be home?","condition_hint":"user_described_freedom"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e5c7a027-91c0-4c21-87e4-d7a57b31cd62', 'childhood_002', 'life_chapter', 'childhood', $$Who was your best friend in elementary school?$$, $$[{"question":"How did you meet?","condition_hint":"user_named_a_friend"},{"question":"What did you do together?","condition_hint":"user_described_friendship"},{"question":"Are you still in touch?","condition_hint":"user_seemed_reflective"},{"question":"What broke you up, if anything?","condition_hint":"user_mentioned_a_falling_out"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5ea54767-7c8f-4b14-b4e1-a529262eddf0', 'childhood_003', 'life_chapter', 'childhood', $$What did you want to be when you grew up?$$, $$[{"question":"Where did the idea come from?","condition_hint":"user_named_a_profession"},{"question":"Did anyone laugh at you for it, or take you seriously?","condition_hint":"user_described_adult_reaction"},{"question":"Did you grow up to be that?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cc319b18-4e69-4609-bc62-210c4a6f031b', 'childhood_004', 'life_chapter', 'childhood', $$What was your school like?$$, $$[{"question":"Was it big or small?","condition_hint":"user_described_school"},{"question":"Did you like going?","condition_hint":"user_described_attitude"},{"question":"Was there a teacher who paid particular attention to you?","condition_hint":"user_did_not_mention_teacher"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('427c330b-342b-406e-bcc4-1b812b612f72', 'childhood_005', 'life_chapter', 'childhood', $$Tell me about a teacher who mattered.$$, $$[{"question":"What did they teach?","condition_hint":"user_named_a_teacher"},{"question":"What did they say to you that you remember?","condition_hint":"user_described_teacher_role"},{"question":"Did they live to see what you became?","condition_hint":"user_seemed_emotionally_open"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('03a0cb54-0aa7-41da-aabd-a271e01ad0d3', 'childhood_006', 'life_chapter', 'childhood', $$What did you do when you were in trouble at home?$$, $$[{"question":"Was your mother stricter, or your father?","condition_hint":"user_described_being_punished"},{"question":"What was the worst thing you ever did?","condition_hint":"user_seemed_open_to_continuing"},{"question":"Did you ever get caught doing something nobody knew about until later?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('20433a64-4423-48a4-82bf-8e6ac7d3944e', 'childhood_007', 'life_chapter', 'childhood', $$What was the first chore you had?$$, $$[{"question":"How old were you?","condition_hint":"user_named_a_chore"},{"question":"Did you get paid for it?","condition_hint":"user_described_payment"},{"question":"Did you do it well, or badly?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['money','work']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e2836244-420c-4364-9862-8946afc0e0cb', 'childhood_008', 'life_chapter', 'childhood', $$What was the first thing you bought with your own money?$$, $$[{"question":"Where did the money come from?","condition_hint":"user_named_a_purchase"},{"question":"Did your parents approve of what you bought?","condition_hint":"user_described_parental_reaction"},{"question":"Do you still have it?","condition_hint":"user_seemed_to_value_object"}]$$::jsonb, ARRAY['money']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7a21c0dc-e2b0-414c-ab40-dca0b3659b75', 'childhood_009', 'life_chapter', 'childhood', $$What did Sundays look like in your family?$$, $$[{"question":"Was there church?","condition_hint":"user_described_sunday_routine"},{"question":"What was the meal?","condition_hint":"user_did_not_mention_food"},{"question":"Was there an aunt or uncle who always came?","condition_hint":"user_described_family_gathering"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fdd7bfb8-4130-49ce-abe1-110c71add203', 'childhood_010', 'life_chapter', 'childhood', $$Tell me about a holiday you remember from childhood.$$, $$[{"question":"Whose house were you at?","condition_hint":"user_named_a_holiday"},{"question":"Was there a particular food that was always there?","condition_hint":"user_described_holiday"},{"question":"Was there an argument that always happened?","condition_hint":"user_seemed_open_to_continuing"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('344c4c03-9b53-4979-9df9-6f02f84a95d6', 'childhood_011', 'life_chapter', 'childhood', $$What did your bedroom look like when you were ten?$$, $$[{"question":"What was on the walls?","condition_hint":"user_described_room"},{"question":"What was under the bed?","condition_hint":"user_did_not_mention_hiding_places"},{"question":"Did you keep anything secret in that room?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9d50625e-501b-4b21-9c35-dedd157c857a', 'childhood_012', 'life_chapter', 'childhood', $$What did you read as a child?$$, $$[{"question":"Did anyone read to you, or did you read alone?","condition_hint":"user_named_books"},{"question":"Was there a book that scared you?","condition_hint":"user_described_reading_habits"},{"question":"Was there a book you read over and over?","condition_hint":"user_seemed_invested_in_books"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6c9aa87c-d146-46b5-9a8a-e786072cbb27', 'childhood_013', 'life_chapter', 'childhood', $$What did you play, and with what?$$, $$[{"question":"Did you have a favorite toy?","condition_hint":"user_named_games_or_toys"},{"question":"Did you ever build something — a fort, a dollhouse, a model?","condition_hint":"user_did_not_mention_building"},{"question":"Did you play with siblings or alone?","condition_hint":"user_described_solitary_or_social_play"}]$$::jsonb, ARRAY['hands']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5de21903-2c28-4f97-b658-5fa6ef2d73dd', 'childhood_014', 'life_chapter', 'childhood', $$What's the first time you remember feeling proud of yourself?$$, $$[{"question":"Did anyone notice?","condition_hint":"user_described_an_accomplishment"},{"question":"Did you tell your parents?","condition_hint":"user_described_parental_response"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0904ab47-caa8-4764-8aca-f173ed2db075', 'childhood_015', 'life_chapter', 'childhood', $$What's the first time you remember feeling ashamed?$$, $$[{"question":"Did anyone see it happen?","condition_hint":"user_described_shame"},{"question":"Have you ever told anyone about it?","condition_hint":"user_seemed_to_be_telling_for_first_time"},{"question":"Do you forgive that child you were?","condition_hint":"user_seemed_emotionally_open"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('40e5d7c6-1a14-4bbf-9052-959917ff82da', 'childhood_016', 'life_chapter', 'childhood', $$What was illness like in your family when you were a kid?$$, $$[{"question":"Was there a doctor who came to the house?","condition_hint":"user_described_illness"},{"question":"Was anyone seriously sick during your childhood?","condition_hint":"user_seemed_open_to_continuing"},{"question":"What did your mother do when you were sick?","condition_hint":"user_described_caretaking"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f9bbee00-f38b-4a82-b0cf-229f14c40d31', 'childhood_017', 'life_chapter', 'childhood', $$Did anyone die in your family while you were a child?$$, $$[{"question":"Were you allowed to go to the funeral?","condition_hint":"user_described_a_death"},{"question":"How did the adults around you talk about it?","condition_hint":"user_described_grief"},{"question":"Did you understand what was happening?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('dcbf9f4e-2e5c-4002-8048-204840af52ae', 'childhood_018', 'life_chapter', 'childhood', $$Was there a neighbor's house that was different from yours?$$, $$[{"question":"How was it different?","condition_hint":"user_described_neighbor_house"},{"question":"Did you want your house to be like theirs?","condition_hint":"user_described_envy_or_comparison"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('912efd07-789a-41b4-8a88-bbca0484653a', 'childhood_019', 'life_chapter', 'childhood', $$What did you do when nobody was watching?$$, $$[{"question":"Did you have a hiding place?","condition_hint":"user_described_secret_activity"},{"question":"Did anyone ever catch you?","condition_hint":"user_seemed_to_be_telling_a_specific_story"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1cc75521-5c26-46b9-908f-8505a11a05d3', 'childhood_020', 'life_chapter', 'childhood', $$What was the first lie you remember telling?$$, $$[{"question":"Who did you tell it to?","condition_hint":"user_named_a_lie"},{"question":"Did they believe you?","condition_hint":"user_described_consequences"},{"question":"Do you still tell that kind of lie?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6b675e54-21c7-479d-8600-5e7c0d16ef2f', 'childhood_021', 'life_chapter', 'childhood', $$Where did you walk to as a kid?$$, $$[{"question":"How far was it?","condition_hint":"user_named_destinations"},{"question":"Did your parents know you were there?","condition_hint":"user_described_independence"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e704c90a-b86f-4956-a6a6-f24e6cfc745a', 'childhood_022', 'life_chapter', 'childhood', $$What did your mother make for dinner most nights?$$, $$[{"question":"Did she like cooking?","condition_hint":"user_named_dinner_foods"},{"question":"Did your father help?","condition_hint":"user_described_kitchen_dynamics"},{"question":"Was there one meal she made that you would eat tonight if you could?","condition_hint":"user_seemed_nostalgic"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('63204952-86d7-44a0-b628-6cfd3e853a96', 'childhood_023', 'life_chapter', 'childhood', $$What did your father do on weekends?$$, $$[{"question":"Did he have a project that was always going?","condition_hint":"user_described_father_activity"},{"question":"Did you help him?","condition_hint":"user_described_father_son_or_father_daughter_time"},{"question":"Did he teach you how to do something?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5778d143-1151-47f5-bf15-028f2f4be491', 'childhood_024', 'life_chapter', 'childhood', $$What was the first time you remember being away from home overnight?$$, $$[{"question":"Where were you?","condition_hint":"user_described_being_away"},{"question":"Were you homesick?","condition_hint":"user_described_loneliness"},{"question":"Did anyone come for you when you wanted to go home?","condition_hint":"user_mentioned_being_picked_up"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e5044d62-d2e0-41cc-abe5-d8bb7be0fe32', 'childhood_025', 'life_chapter', 'childhood', $$Was there a weekly TV show or radio program your family listened to together?$$, $$[{"question":"Where did you sit?","condition_hint":"user_named_a_program"},{"question":"Did you talk about it afterward?","condition_hint":"user_described_family_routine"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4c15ca61-aa61-4e6d-8852-ffce23e79b2d', 'childhood_026', 'life_chapter', 'childhood', $$What was the first money you remember earning?$$, $$[{"question":"What did you do for it?","condition_hint":"user_described_first_earnings"},{"question":"What did you do with it?","condition_hint":"user_described_spending"}]$$::jsonb, ARRAY['money','work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6208bed1-d7f6-4542-9a07-49fdc6502d0b', 'childhood_027', 'life_chapter', 'childhood', $$Did your family take vacations?$$, $$[{"question":"Where did you go?","condition_hint":"user_described_vacations"},{"question":"Did your father drive, and how long did it take?","condition_hint":"user_mentioned_road_trip"},{"question":"Was there a place you went every year?","condition_hint":"user_mentioned_recurring_destination"}]$$::jsonb, ARRAY['places']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8ee2c3b5-b106-4574-ba8e-4605baf54954', 'childhood_028', 'life_chapter', 'childhood', $$What was your family car?$$, $$[{"question":"What color, what make?","condition_hint":"user_named_a_car"},{"question":"Where did everyone sit?","condition_hint":"user_described_seating"},{"question":"Did it ever break down somewhere memorable?","condition_hint":"user_described_car_trouble"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('352935eb-7f28-4d19-a38b-7c35c993b5dc', 'childhood_029', 'life_chapter', 'childhood', $$Was there an aunt or uncle who was different from your parents?$$, $$[{"question":"What did they do that was different?","condition_hint":"user_described_aunt_or_uncle"},{"question":"Did your parents approve of them?","condition_hint":"user_described_family_dynamics"},{"question":"Did you wish you had grown up at their house?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('65414923-754b-4bcd-95d9-f14b36d3d9e7', 'childhood_030', 'life_chapter', 'childhood', $$What did you fight about with your siblings?$$, $$[{"question":"Who usually won?","condition_hint":"user_described_sibling_dynamics"},{"question":"Did your parents intervene, or let you work it out?","condition_hint":"user_described_parental_response"},{"question":"Do you still have those fights with them now?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('51d05ef4-6867-4c66-8cc5-b24a7cd6c4a7', 'childhood_031', 'life_chapter', 'childhood', $$Did you ever steal something as a child?$$, $$[{"question":"From who?","condition_hint":"user_admitted_to_stealing"},{"question":"Did you get caught?","condition_hint":"user_described_consequences"},{"question":"Have you thought about that since?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d1087a3e-d437-4eaa-bf83-46c3fdce1f4e', 'childhood_032', 'life_chapter', 'childhood', $$What did you pray for, if you prayed?$$, $$[{"question":"Did anyone teach you how to pray?","condition_hint":"user_described_prayer"},{"question":"Do you still pray for the same things?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e984eafd-8e00-40af-a897-dceaf811d0a8', 'childhood_033', 'life_chapter', 'childhood', $$Did you have an imaginary friend?$$, $$[{"question":"What was their name?","condition_hint":"user_described_imaginary_friend"},{"question":"Did your parents play along, or tell you they weren't real?","condition_hint":"user_described_parental_response"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('666b7d6a-827c-449e-b212-2130b62ffe35', 'childhood_034', 'life_chapter', 'childhood', $$Was there a particular sound you remember being terrified of?$$, $$[{"question":"Where were you when you heard it?","condition_hint":"user_named_a_sound"},{"question":"Did anyone explain it to you?","condition_hint":"user_described_resolution"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0244879e-63a3-4851-834c-dcaaf5eca8a9', 'childhood_035', 'life_chapter', 'childhood', $$What's something you knew as a child that the adults around you didn't think you knew?$$, $$[{"question":"Did you ever bring it up?","condition_hint":"user_described_a_secret_knowledge"},{"question":"Has anyone confirmed it to you since?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c23f3ab2-0939-4180-bcc7-e9914d8f80a5', 'adolescence_001', 'life_chapter', 'adolescence', $$When did you stop being a child?$$, $$[{"question":"Was there a specific event, or was it gradual?","condition_hint":"user_named_an_event"},{"question":"Did anyone notice the change?","condition_hint":"user_described_a_transition"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d9c27655-d196-4d40-9b08-57b8484dbf43', 'adolescence_002', 'life_chapter', 'adolescence', $$What did your high school look like?$$, $$[{"question":"Was it close to home, or did you have to travel?","condition_hint":"user_described_school"},{"question":"Did you eat lunch in the cafeteria, or somewhere else?","condition_hint":"user_described_lunch"},{"question":"Was there a place at school you avoided?","condition_hint":"user_described_safe_or_unsafe_zones"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('26ff8182-904c-483e-8f52-16384a4fa033', 'adolescence_003', 'life_chapter', 'adolescence', $$Who did you sit with at lunch?$$, $$[{"question":"How did that group form?","condition_hint":"user_named_friends"},{"question":"Were you the same group all four years?","condition_hint":"user_described_changes"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5982c0b1-5625-4a05-8110-3c0877c5dbc6', 'adolescence_004', 'life_chapter', 'adolescence', $$What was your first job?$$, $$[{"question":"How much did you make?","condition_hint":"user_named_a_job"},{"question":"Was it a place that's still there?","condition_hint":"user_described_a_specific_workplace"},{"question":"Did you keep any of that money, or did you spend it as you got it?","condition_hint":"user_described_money_habits"}]$$::jsonb, ARRAY['work','money']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7a8b9a0f-f2eb-4ba3-a039-fcb85d5f12cb', 'adolescence_005', 'life_chapter', 'adolescence', $$Did you have a favorite teacher in high school?$$, $$[{"question":"What did they teach?","condition_hint":"user_named_a_teacher"},{"question":"Did they know they mattered to you?","condition_hint":"user_described_relationship"},{"question":"Have you ever told them since?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('65473759-fd45-4f62-98c4-e4b7730433e7', 'adolescence_006', 'life_chapter', 'adolescence', $$Did you have a teacher who didn't like you?$$, $$[{"question":"Why didn't they?","condition_hint":"user_described_a_difficult_teacher"},{"question":"Did you do something to deserve it, or was it unfair?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('23ab8df0-3212-411d-9121-9ecca5528036', 'adolescence_007', 'life_chapter', 'adolescence', $$What was the first concert or live music you saw?$$, $$[{"question":"Who took you?","condition_hint":"user_named_a_concert"},{"question":"Were you old enough to be there?","condition_hint":"user_described_age"},{"question":"Have you seen them since?","condition_hint":"user_seemed_invested_in_the_artist"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('87073150-6a1d-43f3-ab81-d15a49e90091', 'adolescence_008', 'life_chapter', 'adolescence', $$What did you wear that you regret?$$, $$[{"question":"Who told you it looked good?","condition_hint":"user_described_clothing"},{"question":"Do you have a photo?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4d1f4b13-a362-4e49-8a6d-085c6827b793', 'adolescence_009', 'life_chapter', 'adolescence', $$What music did you listen to that your parents hated?$$, $$[{"question":"Where did you listen — your room, the car, headphones?","condition_hint":"user_named_music"},{"question":"Did your parents try to ban it?","condition_hint":"user_described_conflict"},{"question":"Do you still listen to it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('86736a91-4bd6-4f0d-80ba-3fb4a11c4861', 'adolescence_010', 'life_chapter', 'adolescence', $$Tell me about your first crush.$$, $$[{"question":"Did they know?","condition_hint":"user_described_a_crush"},{"question":"How did it end?","condition_hint":"user_seemed_open_to_continuing"},{"question":"Where are they now, if you know?","condition_hint":"user_seemed_curious"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f5773020-a024-4dfc-bb2f-3abb64a4325a', 'adolescence_011', 'life_chapter', 'adolescence', $$Tell me about your first kiss.$$, $$[{"question":"Where were you?","condition_hint":"user_described_a_first_kiss"},{"question":"Did anyone interrupt?","condition_hint":"user_seemed_amused"},{"question":"Did you tell anyone afterward?","condition_hint":"user_described_aftermath"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('dae521d0-9cae-40dd-b838-5e56e5d38539', 'adolescence_012', 'life_chapter', 'adolescence', $$Did you have a part of town you avoided, or one you weren't supposed to go to?$$, $$[{"question":"Did you go anyway?","condition_hint":"user_named_a_place"},{"question":"Why was it forbidden?","condition_hint":"user_described_taboo"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('df808ee5-c79d-45de-9c64-0062ded51300', 'adolescence_013', 'life_chapter', 'adolescence', $$What was the worst trouble you got into in high school?$$, $$[{"question":"Did your parents find out?","condition_hint":"user_described_trouble"},{"question":"Did anything change after that?","condition_hint":"user_described_consequences"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('25fa5bad-b471-4a02-be0e-49bd9cfb2519', 'adolescence_014', 'life_chapter', 'adolescence', $$Were you athletic, artistic, neither, both?$$, $$[{"question":"Did you have a coach or a teacher who took it seriously?","condition_hint":"user_described_a_pursuit"},{"question":"Did you ever quit, and why?","condition_hint":"user_described_quitting_or_continuing"},{"question":"Do you still do it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['body','hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cea8ff76-1910-4ce3-8220-ee70536fec8f', 'adolescence_015', 'life_chapter', 'adolescence', $$What was your relationship with your siblings during these years?$$, $$[{"question":"Did you fight more or less than as kids?","condition_hint":"user_described_sibling_relationship"},{"question":"Was one of them in charge, in some way?","condition_hint":"user_described_dynamics"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5ddaa2ae-735b-419e-a9ee-ae11f9634bb1', 'adolescence_016', 'life_chapter', 'adolescence', $$Did you sneak out at night?$$, $$[{"question":"Where did you go?","condition_hint":"user_admitted_to_sneaking_out"},{"question":"Did you ever get caught?","condition_hint":"user_described_consequences"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('75690c3b-de86-4854-8fe7-01159cc471f8', 'adolescence_017', 'life_chapter', 'adolescence', $$What did your parents fight about during your high school years?$$, $$[{"question":"Did the fights change as you got older?","condition_hint":"user_described_parental_conflict"},{"question":"Did you ever try to mediate?","condition_hint":"user_described_mediation"},{"question":"Did they ever ask your opinion?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2357c81d-6f2d-4d66-b6a5-4d8eed8bcd7a', 'adolescence_018', 'life_chapter', 'adolescence', $$Did you have a part-time job during school?$$, $$[{"question":"How did the job affect your schoolwork?","condition_hint":"user_named_a_job"},{"question":"Did you ever fall asleep in class because of it?","condition_hint":"user_described_exhaustion"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('741998a4-6cf7-47d9-a17d-c4ba6ec2155e', 'adolescence_019', 'life_chapter', 'adolescence', $$What did you do on Friday nights?$$, $$[{"question":"Where did you go?","condition_hint":"user_described_friday_routine"},{"question":"Was there a particular place teenagers gathered in your town?","condition_hint":"user_named_a_gathering_place"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('708bafc8-4e80-4ac2-bbd8-da49d3c6c7db', 'adolescence_020', 'life_chapter', 'adolescence', $$Did you ever feel like you didn't belong to your own family?$$, $$[{"question":"Why?","condition_hint":"user_admitted_feeling_outside"},{"question":"Did anyone in the family see it?","condition_hint":"user_described_isolation"},{"question":"Do you still feel that way?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('554bb6c3-62dd-409a-9a2f-e8f0e094adea', 'adolescence_021', 'life_chapter', 'adolescence', $$Was there an adult outside your family who you went to with problems?$$, $$[{"question":"How did you meet?","condition_hint":"user_named_an_adult"},{"question":"What did your parents think of them?","condition_hint":"user_described_parents_response"},{"question":"Are they still alive?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('37574475-7596-4828-8249-495b626b6ae0', 'adolescence_022', 'life_chapter', 'adolescence', $$Did you fall in love during high school?$$, $$[{"question":"Did the family approve?","condition_hint":"user_described_high_school_love"},{"question":"How did it end?","condition_hint":"user_seemed_open_to_continuing"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cbd0f27d-4cb1-4dcc-b6a1-947a6b1b127e', 'adolescence_023', 'life_chapter', 'adolescence', $$Were you ever bullied?$$, $$[{"question":"Did adults know?","condition_hint":"user_admitted_to_being_bullied"},{"question":"Did you ever fight back?","condition_hint":"user_described_response"},{"question":"Where is that person now?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d0fa54c7-a198-46a1-8bcd-62fd346aeeb5', 'adolescence_024', 'life_chapter', 'adolescence', $$Did you ever bully anyone?$$, $$[{"question":"Why?","condition_hint":"user_admitted_to_bullying"},{"question":"Have you thought about them since?","condition_hint":"user_seemed_reflective"},{"question":"Have you ever apologized?","condition_hint":"user_seemed_to_carry_guilt"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('512faaee-ceea-4ed9-9b30-652d3375a473', 'adolescence_025', 'life_chapter', 'adolescence', $$What were your political views as a teenager?$$, $$[{"question":"Where did they come from?","condition_hint":"user_described_views"},{"question":"Did they match your parents'?","condition_hint":"user_described_family_alignment"},{"question":"Have they changed?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ef4a2fc0-7d13-4266-b13d-ab71651046b4', 'adolescence_026', 'life_chapter', 'adolescence', $$What did you read in high school that mattered to you?$$, $$[{"question":"Was it assigned, or did you find it on your own?","condition_hint":"user_named_a_book"},{"question":"Have you read it again as an adult?","condition_hint":"user_seemed_invested_in_the_book"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('328cd2c7-baa3-4e01-90b2-94f47f86b878', 'adolescence_027', 'life_chapter', 'adolescence', $$Did you drive a car in high school?$$, $$[{"question":"What kind of car?","condition_hint":"user_described_a_car"},{"question":"Whose was it?","condition_hint":"user_described_ownership"},{"question":"Where did you drive that you weren't supposed to?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('dc649b2b-f774-47d0-96b7-fe936026f802', 'adolescence_028', 'life_chapter', 'adolescence', $$When did you first try alcohol?$$, $$[{"question":"With who?","condition_hint":"user_described_first_drink"},{"question":"Did your parents know?","condition_hint":"user_described_aftermath"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1c4cf03c-9df5-4ad4-9998-4ea1a707e962', 'adolescence_029', 'life_chapter', 'adolescence', $$When did you first know what you didn't want for your life?$$, $$[{"question":"What was it?","condition_hint":"user_described_a_realization"},{"question":"Did you avoid it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e9cfc465-c22b-4c0f-8e39-a34fae7ea56f', 'adolescence_030', 'life_chapter', 'adolescence', $$What did you do the night you graduated high school?$$, $$[{"question":"Who were you with?","condition_hint":"user_described_graduation_night"},{"question":"Did you know what you were going to do next?","condition_hint":"user_described_uncertainty_or_certainty"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('65aa9c8e-a5c6-466a-88ae-9ea550d3a7c4', 'young_adulthood_001', 'life_chapter', 'young_adulthood', $$What did you do the year after high school?$$, $$[{"question":"Was that what you had planned?","condition_hint":"user_described_year_after"},{"question":"Did anyone help you decide, or did you decide alone?","condition_hint":"user_described_decision_making"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e84a2a86-bd53-4435-b464-b261d4829c11', 'young_adulthood_002', 'life_chapter', 'young_adulthood', $$What was the first place you lived as an adult?$$, $$[{"question":"How did you find it?","condition_hint":"user_described_first_place"},{"question":"Who did you live with?","condition_hint":"user_described_roommates"},{"question":"What was wrong with it?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3728886a-1ea6-4a9f-8fd5-4778224d1ef5', 'young_adulthood_003', 'life_chapter', 'young_adulthood', $$Did you go to college, and if so, where and why?$$, $$[{"question":"Was there pressure from your family?","condition_hint":"user_named_a_school"},{"question":"Did you finish?","condition_hint":"user_described_college_experience"},{"question":"Was it worth it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('959d908d-8d94-4575-a08a-852ee6cb37c7', 'young_adulthood_004', 'life_chapter', 'young_adulthood', $$If you didn't go to college, what did you do instead?$$, $$[{"question":"Why didn't you go?","condition_hint":"user_described_alternative_path"},{"question":"Do you wish you had?","condition_hint":"user_seemed_reflective"},{"question":"Did you ever go later?","condition_hint":"user_described_later_education"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ad42ee73-ffcc-4009-970b-29ac7642e8de', 'young_adulthood_005', 'life_chapter', 'young_adulthood', $$Did you serve in the military?$$, $$[{"question":"Why did you enlist?","condition_hint":"user_described_service"},{"question":"Where were you stationed?","condition_hint":"user_described_deployment"},{"question":"How did it change you?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7013513a-0bae-49d4-a42e-93d2e646ebb6', 'young_adulthood_006', 'life_chapter', 'young_adulthood', $$What was your first real heartbreak?$$, $$[{"question":"Did you see it coming?","condition_hint":"user_described_heartbreak"},{"question":"Who did you call?","condition_hint":"user_described_support"},{"question":"How long did you take to get over it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('414073ca-d72f-4eac-9855-d84c635a72cd', 'young_adulthood_007', 'life_chapter', 'young_adulthood', $$What did you eat in your twenties?$$, $$[{"question":"Did you cook, or did you go out?","condition_hint":"user_described_eating"},{"question":"Was there a place you went every week?","condition_hint":"user_named_a_regular_place"}]$$::jsonb, ARRAY['food']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ddb61def-3650-4625-bf3b-b7ca7192cdfd', 'young_adulthood_008', 'life_chapter', 'young_adulthood', $$Did you travel?$$, $$[{"question":"Where did you go first?","condition_hint":"user_described_travel"},{"question":"Who did you go with?","condition_hint":"user_described_companions"},{"question":"Did you ever go somewhere alone?","condition_hint":"user_described_solo_travel"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d3bdc127-bcd3-424b-90a1-1e316e54c1d4', 'young_adulthood_009', 'life_chapter', 'young_adulthood', $$What kind of work did you do in your twenties?$$, $$[{"question":"Was it what you wanted to be doing?","condition_hint":"user_named_jobs"},{"question":"Did you have a boss who shaped you?","condition_hint":"user_described_boss"},{"question":"Did you quit anything dramatically?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e3d81a5d-2d4c-4cf7-87c7-76daf5750d14', 'young_adulthood_010', 'life_chapter', 'young_adulthood', $$When did you meet your spouse, or someone you considered marrying?$$, $$[{"question":"What were you doing the day you met?","condition_hint":"user_described_meeting"},{"question":"Did you know right away?","condition_hint":"user_described_recognition"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4048eb63-5568-4638-821e-bf12aacf799f', 'young_adulthood_011', 'life_chapter', 'young_adulthood', $$Did you live with someone before you got married?$$, $$[{"question":"Was that a scandal in your family?","condition_hint":"user_described_cohabitation"},{"question":"How did you decide to marry?","condition_hint":"user_described_decision"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5d776cfc-69c2-41ab-8040-d2507e9ec428', 'young_adulthood_012', 'life_chapter', 'young_adulthood', $$Tell me about your wedding.$$, $$[{"question":"Where was it?","condition_hint":"user_described_wedding"},{"question":"Who came who shouldn't have, or who didn't come who should have?","condition_hint":"user_seemed_invested"},{"question":"What did your mother wear?","condition_hint":"user_described_family_at_wedding"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('683b79a3-3e86-4665-9421-05d4ee386bef', 'young_adulthood_013', 'life_chapter', 'young_adulthood', $$Did you ever almost marry someone you didn't?$$, $$[{"question":"What stopped you?","condition_hint":"user_admitted_to_almost_marriage"},{"question":"Where are they now?","condition_hint":"user_seemed_reflective"},{"question":"Have you wondered what would have happened?","condition_hint":"user_seemed_open_to_speculation"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('069c07c3-9374-4d9c-a3b7-df1f34f2a774', 'young_adulthood_014', 'life_chapter', 'young_adulthood', $$What was the apartment or house you got married in or moved into together?$$, $$[{"question":"How did you furnish it?","condition_hint":"user_described_first_marital_home"},{"question":"Did you fight about furniture?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('381341f9-4b2b-4212-b0c7-6ad7d86a3b3f', 'young_adulthood_015', 'life_chapter', 'young_adulthood', $$Did you have a pet as a young adult?$$, $$[{"question":"Was it your idea or your partner's?","condition_hint":"user_named_a_pet"},{"question":"How did it die?","condition_hint":"user_seemed_open_to_continuing"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('445c991d-45af-4cf1-baf0-9d397eba8357', 'young_adulthood_016', 'life_chapter', 'young_adulthood', $$What did you and your friends do on weekends in your twenties?$$, $$[{"question":"Was there a regular place?","condition_hint":"user_described_routine"},{"question":"Are any of those friends still in your life?","condition_hint":"user_described_friends"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8968982f-51b7-4784-bbf7-5c40b99fe78a', 'young_adulthood_017', 'life_chapter', 'young_adulthood', $$Did you have a friend who died young?$$, $$[{"question":"How did you find out?","condition_hint":"user_described_a_death"},{"question":"Did you go to the funeral?","condition_hint":"user_described_grief"},{"question":"Do you still think about them?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9d0bec43-a699-4c78-b6ee-117e6c6fab61', 'young_adulthood_018', 'life_chapter', 'young_adulthood', $$What did you spend money on that you regret?$$, $$[{"question":"Were you embarrassed at the time, or only later?","condition_hint":"user_named_a_purchase"},{"question":"Did anyone try to talk you out of it?","condition_hint":"user_described_advice"}]$$::jsonb, ARRAY['money']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('02a204e3-be8f-41e3-afe3-dcaf3cd662a3', 'young_adulthood_019', 'life_chapter', 'young_adulthood', $$What did you spend money on that turned out to be worth it?$$, $$[{"question":"Do you still have it?","condition_hint":"user_named_a_purchase"},{"question":"Would you spend that money the same way today?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['money']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6027b324-a1de-4c4b-ac94-540a6f2bda8d', 'young_adulthood_020', 'life_chapter', 'young_adulthood', $$Did you have a moment in your twenties when you realized your parents were just people?$$, $$[{"question":"What happened?","condition_hint":"user_described_a_realization"},{"question":"Did your relationship with them change after that?","condition_hint":"user_described_changed_relationship"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6d92333f-3e07-478e-976d-8b8c40cc3c2c', 'young_adulthood_021', 'life_chapter', 'young_adulthood', $$Did you ever lose a job?$$, $$[{"question":"Why?","condition_hint":"user_admitted_to_being_fired"},{"question":"How long before you found another?","condition_hint":"user_described_unemployment"},{"question":"Did it change how you worked after that?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('82a880fe-631a-4e42-bae8-a0f6c3b58d11', 'young_adulthood_022', 'life_chapter', 'young_adulthood', $$When did you start to feel like an adult?$$, $$[{"question":"Was there a specific moment?","condition_hint":"user_described_adulthood"},{"question":"Did anyone treat you differently after that?","condition_hint":"user_described_recognition"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('03032896-3d0a-4823-be68-36350e6b7933', 'young_adulthood_023', 'life_chapter', 'young_adulthood', $$Did you ever live alone?$$, $$[{"question":"Did you like it?","condition_hint":"user_described_solitude"},{"question":"How long did you do it?","condition_hint":"user_described_duration"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7aad911f-43db-4230-b7ba-e4dc604c3761', 'young_adulthood_024', 'life_chapter', 'young_adulthood', $$Did you ever live somewhere you didn't want to be?$$, $$[{"question":"Why were you there?","condition_hint":"user_described_unwanted_location"},{"question":"How did you get out?","condition_hint":"user_described_escape"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e78cc565-f6de-4b84-8afb-3d149d71eb97', 'young_adulthood_025', 'life_chapter', 'young_adulthood', $$What did you read in your twenties that changed how you thought?$$, $$[{"question":"Who recommended it?","condition_hint":"user_named_a_book"},{"question":"Have you read it again since?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4fa13ee1-80a3-4862-b06f-ff12fccbbef8', 'young_adulthood_026', 'life_chapter', 'young_adulthood', $$Did you go to a wedding in your twenties that became a story?$$, $$[{"question":"What happened?","condition_hint":"user_named_a_wedding"},{"question":"Are those people still married?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4b4cc0af-9ec2-4e70-b4cb-779155c9a506', 'young_adulthood_027', 'life_chapter', 'young_adulthood', $$Did anyone in your family disapprove of who you were becoming?$$, $$[{"question":"Who?","condition_hint":"user_described_disapproval"},{"question":"Did you ever talk about it?","condition_hint":"user_described_conversation_or_silence"},{"question":"Did they come around?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a4a1fedd-56e8-4693-9ca1-8951807812fb', 'young_adulthood_028', 'life_chapter', 'young_adulthood', $$Did you ever think about not having children?$$, $$[{"question":"What changed your mind, if it changed?","condition_hint":"user_described_thinking_about_children"},{"question":"Did you talk to your partner about it?","condition_hint":"user_described_couple_conversation"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2d93572f-d1e9-4f0f-9526-a2bba125614b', 'young_adulthood_029', 'life_chapter', 'young_adulthood', $$Did you ever get into a fight, physical or verbal, that you remember?$$, $$[{"question":"With who?","condition_hint":"user_described_a_fight"},{"question":"Did anything good come of it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c047ff6e-5794-4727-9719-2ee8b38159f0', 'young_adulthood_030', 'life_chapter', 'young_adulthood', $$What was your favorite place to go when you needed to be alone in your twenties?$$, $$[{"question":"Why that place?","condition_hint":"user_named_a_place"},{"question":"Is it still there?","condition_hint":"user_seemed_nostalgic"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('59fec548-4871-4390-8dbc-89d18514e835', 'coming_into_yourself_001', 'life_chapter', 'coming_into_yourself', $$When did you stop trying to please your parents?$$, $$[{"question":"Was there a specific moment?","condition_hint":"user_described_a_shift"},{"question":"Did they notice?","condition_hint":"user_described_parental_response"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3004593f-1598-4be5-8eef-06bfdc1cf498', 'coming_into_yourself_002', 'life_chapter', 'coming_into_yourself', $$What was the first big decision you made that nobody else could make for you?$$, $$[{"question":"How long did you sit with it before deciding?","condition_hint":"user_described_a_decision"},{"question":"Did you tell anyone before you did it?","condition_hint":"user_described_keeping_or_sharing"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1f875862-006a-46a0-8ba7-df99eb5a9bb0', 'coming_into_yourself_003', 'life_chapter', 'coming_into_yourself', $$When did you become a parent, if you did?$$, $$[{"question":"Were you ready?","condition_hint":"user_described_becoming_parent"},{"question":"Did you call your own mother first, or someone else?","condition_hint":"user_described_who_to_call"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f3cd68e8-474e-4e1e-955d-47df31f138df', 'coming_into_yourself_004', 'life_chapter', 'coming_into_yourself', $$What were the first 24 hours with your first child like?$$, $$[{"question":"Where were you?","condition_hint":"user_described_first_baby"},{"question":"What surprised you?","condition_hint":"user_described_surprise"},{"question":"Was your partner steady, or panicking?","condition_hint":"user_described_partner"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('38bfd01d-77b2-4462-97db-80bf8d3a9deb', 'coming_into_yourself_005', 'life_chapter', 'coming_into_yourself', $$Tell me about the first house you owned.$$, $$[{"question":"How long did it take you to feel like it was yours?","condition_hint":"user_described_a_house"},{"question":"What broke first?","condition_hint":"user_described_repairs"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('698910c6-a4f3-4acd-bebd-298d901f0e54', 'coming_into_yourself_006', 'life_chapter', 'coming_into_yourself', $$When did you find work that felt like yours, not just a job?$$, $$[{"question":"How long did it take to find?","condition_hint":"user_described_meaningful_work"},{"question":"Are you still doing it, or something related?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('23c931e7-f76a-4e79-98c6-b5e1f47ee45e', 'coming_into_yourself_007', 'life_chapter', 'coming_into_yourself', $$Did you ever start your own business?$$, $$[{"question":"What was it?","condition_hint":"user_named_a_business"},{"question":"Did it work?","condition_hint":"user_described_outcome"},{"question":"Would you do it again?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('328fea5c-6ba9-4838-a765-c9e638edd197', 'coming_into_yourself_008', 'life_chapter', 'coming_into_yourself', $$Did you change your mind about something big in this stretch of your life?$$, $$[{"question":"What was it?","condition_hint":"user_described_change_of_mind"},{"question":"What changed it?","condition_hint":"user_described_cause"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5fd3e6eb-7095-4140-adbd-39fc232854bb', 'coming_into_yourself_009', 'life_chapter', 'coming_into_yourself', $$Did you lose a friend in this period?$$, $$[{"question":"To death, or to drift?","condition_hint":"user_described_loss"},{"question":"Have you tried to repair it?","condition_hint":"user_described_drift"}]$$::jsonb, ARRAY['losses']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('57a34476-cc18-41cc-bac2-af5e61ae1946', 'coming_into_yourself_010', 'life_chapter', 'coming_into_yourself', $$Did you have a teacher, mentor, or boss in your thirties who shaped you?$$, $$[{"question":"How did you meet?","condition_hint":"user_named_a_mentor"},{"question":"What did they teach you?","condition_hint":"user_described_lessons"},{"question":"Have you been that for someone else since?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('017f54c7-c69d-447f-880d-4095796e51f8', 'coming_into_yourself_011', 'life_chapter', 'coming_into_yourself', $$When did you first feel responsible for someone else's life?$$, $$[{"question":"Was it your child, your parent, or someone else?","condition_hint":"user_described_responsibility"},{"question":"Did you feel ready?","condition_hint":"user_described_readiness"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2c05ad87-78ec-4b6f-9fc8-9626e555cdeb', 'coming_into_yourself_012', 'life_chapter', 'coming_into_yourself', $$Did you have a moment when you realized you couldn't have everything you wanted?$$, $$[{"question":"What did you give up?","condition_hint":"user_described_a_choice"},{"question":"Do you regret it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('80e122bd-064f-4d2e-8250-0b6751e1bc68', 'coming_into_yourself_013', 'life_chapter', 'coming_into_yourself', $$Did you go through a time of religious doubt or change?$$, $$[{"question":"What started it?","condition_hint":"user_described_religious_shift"},{"question":"Where did it land?","condition_hint":"user_described_resolution"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fce06787-a81c-4042-a3eb-fd24daf1a4c0', 'coming_into_yourself_014', 'life_chapter', 'coming_into_yourself', $$What's the first thing you bought that felt like a real adult purchase?$$, $$[{"question":"Why that?","condition_hint":"user_named_a_purchase"},{"question":"Do you still have it?","condition_hint":"user_seemed_invested"}]$$::jsonb, ARRAY['money']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('98e4afcb-c111-4979-97ee-46ea98a54d1f', 'coming_into_yourself_015', 'life_chapter', 'coming_into_yourself', $$Did you have a falling out with a sibling in this period?$$, $$[{"question":"What was it about?","condition_hint":"user_admitted_a_falling_out"},{"question":"Did you mend it?","condition_hint":"user_described_resolution_or_continued_estrangement"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1a17ad89-e4ce-4615-b09b-f0708ab17be5', 'coming_into_yourself_016', 'life_chapter', 'coming_into_yourself', $$When did your parents start to age in front of you?$$, $$[{"question":"Which one first?","condition_hint":"user_described_aging_parent"},{"question":"How did it change how you talked to them?","condition_hint":"user_described_changed_dynamic"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('bc7d3f48-cbd8-4ca8-ae0f-a98da9147a6c', 'coming_into_yourself_017', 'life_chapter', 'coming_into_yourself', $$Did you have a moment in your thirties or forties when you had to ask for help?$$, $$[{"question":"Who did you ask?","condition_hint":"user_described_asking_for_help"},{"question":"Was that hard for you?","condition_hint":"user_described_difficulty"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4cfc508e-68d5-4b53-97b2-c318741a9dd6', 'coming_into_yourself_018', 'life_chapter', 'coming_into_yourself', $$Did your marriage have a hard year that you remember?$$, $$[{"question":"What was the year?","condition_hint":"user_described_marital_difficulty"},{"question":"How did you get through it?","condition_hint":"user_described_resolution"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('793b921b-d579-4050-b476-5c6fa2d9dc63', 'coming_into_yourself_019', 'life_chapter', 'coming_into_yourself', $$Did you ever leave a job that everyone thought you should keep?$$, $$[{"question":"Why did you leave?","condition_hint":"user_described_leaving"},{"question":"Was it the right call?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a6b6f509-0319-43ee-bae1-4149190c02f1', 'coming_into_yourself_020', 'life_chapter', 'coming_into_yourself', $$What's the first time you remember being someone's elder, someone they came to for advice?$$, $$[{"question":"Who came to you?","condition_hint":"user_described_being_consulted"},{"question":"Did you give them good advice?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a362a044-4c21-47f4-be8b-d1d3bda56f8c', 'coming_into_yourself_021', 'life_chapter', 'coming_into_yourself', $$Did you ever go back to school as an adult?$$, $$[{"question":"What for?","condition_hint":"user_described_returning_to_school"},{"question":"How did it feel different than the first time?","condition_hint":"user_described_difference"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0a99daba-3b5e-4725-8fe1-84c67a28a6ee', 'coming_into_yourself_022', 'life_chapter', 'coming_into_yourself', $$Did you find a hobby in this period that became important to you?$$, $$[{"question":"What is it?","condition_hint":"user_named_a_hobby"},{"question":"Has it changed over time?","condition_hint":"user_described_evolution"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b3fd4813-6e4a-4196-984e-f55ad1dbdd90', 'coming_into_yourself_023', 'life_chapter', 'coming_into_yourself', $$Did you write anything in this period — letters, journals, anything?$$, $$[{"question":"Do you still have them?","condition_hint":"user_admitted_to_writing"},{"question":"Have you ever read them again?","condition_hint":"user_described_rereading"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('66221847-ec4a-48d1-ab27-c49b8a775c51', 'coming_into_yourself_024', 'life_chapter', 'coming_into_yourself', $$Was there a teacher of your own children who you came to admire?$$, $$[{"question":"What did they do for your child?","condition_hint":"user_named_a_teacher"},{"question":"Did you tell them?","condition_hint":"user_described_gratitude"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4a964022-0b57-4a71-a5da-2e1c795680fb', 'coming_into_yourself_025', 'life_chapter', 'coming_into_yourself', $$What's a moment from your forties you would step back into if you could?$$, $$[{"question":"Why that one?","condition_hint":"user_described_a_moment"},{"question":"Who else was there?","condition_hint":"user_seemed_nostalgic"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ff22ca67-a64a-4b52-aa80-e8067dfd7d04', 'building_a_life_001', 'life_chapter', 'building_a_life', $$What was the longest stretch you stayed in one job?$$, $$[{"question":"Why did you stay?","condition_hint":"user_named_long_job"},{"question":"Why did you eventually leave, or are you still there?","condition_hint":"user_described_leaving_or_continuing"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('641a8be6-8488-4df3-b912-68a7cf9923d8', 'building_a_life_002', 'life_chapter', 'building_a_life', $$What did you fight for at work that you won?$$, $$[{"question":"Who fought against it?","condition_hint":"user_described_a_battle"},{"question":"Did it last?","condition_hint":"user_described_legacy"}]$$::jsonb, ARRAY['work']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('71efa577-afdf-4772-b2e3-4f1b80a5051b', 'building_a_life_003', 'life_chapter', 'building_a_life', $$What did you fight for at work that you lost?$$, $$[{"question":"How did you handle losing?","condition_hint":"user_described_a_loss"},{"question":"Was it the right thing to lose?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2324c193-9dcc-4021-90da-954228a673f8', 'building_a_life_004', 'life_chapter', 'building_a_life', $$What's the longest you ever stayed in one house?$$, $$[{"question":"Why did you leave, or why did you stay?","condition_hint":"user_named_long_residence"},{"question":"Did your children grow up there?","condition_hint":"user_described_family_in_place"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4e872293-f6c2-4085-8ae1-e16ae1418201', 'building_a_life_005', 'life_chapter', 'building_a_life', $$Tell me about a kitchen you cooked in for a long time.$$, $$[{"question":"What did you make in it most?","condition_hint":"user_described_a_kitchen"},{"question":"Is it still standing?","condition_hint":"user_seemed_nostalgic"}]$$::jsonb, ARRAY['food','places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('837017a2-4581-4d46-8994-67a3545206c1', 'building_a_life_006', 'life_chapter', 'building_a_life', $$What recipes did you cook over and over for your family?$$, $$[{"question":"Where did the recipes come from?","condition_hint":"user_named_recipes"},{"question":"Did you write them down, or are they in your head?","condition_hint":"user_described_oral_tradition"},{"question":"Has anyone in the family taken them up?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('60d2d9e1-d60e-4515-8a5e-0d9c165d0ec3', 'building_a_life_007', 'life_chapter', 'building_a_life', $$What did you build with your hands in this stretch?$$, $$[{"question":"Is it still standing?","condition_hint":"user_described_building"},{"question":"Did anyone help you?","condition_hint":"user_described_collaboration"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('90d9ce26-8be2-4597-97a9-ee542ce53797', 'building_a_life_008', 'life_chapter', 'building_a_life', $$What was the family vacation you took most often?$$, $$[{"question":"Where did you go?","condition_hint":"user_named_a_vacation"},{"question":"Was there a year it was hard to afford?","condition_hint":"user_described_financial_difficulty"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d9beb0c1-6a70-407b-a5ca-8ae2809c2d49', 'building_a_life_009', 'life_chapter', 'building_a_life', $$Tell me about a holiday tradition that was just yours.$$, $$[{"question":"Where did it come from?","condition_hint":"user_described_tradition"},{"question":"Has it survived?","condition_hint":"user_described_continuation"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3cd93abd-fb53-4cc1-bd8b-955a8513fd50', 'building_a_life_010', 'life_chapter', 'building_a_life', $$Was there a year you almost lost your house?$$, $$[{"question":"How did you get through it?","condition_hint":"user_admitted_to_financial_crisis"},{"question":"Did your children know?","condition_hint":"user_described_family_awareness"}]$$::jsonb, ARRAY['money']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4055c158-f68b-4f31-9ea6-af521ffbd60f', 'building_a_life_011', 'life_chapter', 'building_a_life', $$Did you have a year when everything went right?$$, $$[{"question":"What year?","condition_hint":"user_described_a_good_year"},{"question":"What did it feel like at the end of it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e689e38a-9581-43cc-81f8-0508025c7ed3', 'building_a_life_012', 'life_chapter', 'building_a_life', $$Did you have a year when everything went wrong?$$, $$[{"question":"What year?","condition_hint":"user_described_a_bad_year"},{"question":"How did it end?","condition_hint":"user_described_resolution"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('71158c5a-4406-4768-9c27-e36a633d95ad', 'building_a_life_013', 'life_chapter', 'building_a_life', $$When did your children start surprising you?$$, $$[{"question":"With what?","condition_hint":"user_described_being_surprised"},{"question":"Did the surprises change as they got older?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fc276120-8716-4370-86d5-b2441720ad46', 'building_a_life_014', 'life_chapter', 'building_a_life', $$Did you have to have a hard conversation with one of your children?$$, $$[{"question":"What was it about?","condition_hint":"user_described_a_hard_conversation"},{"question":"How did it go?","condition_hint":"user_described_outcome"},{"question":"Have you had it again?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('04f67098-824a-4217-a2f9-f472bec9f07a', 'building_a_life_015', 'life_chapter', 'building_a_life', $$Did your children's friends come around the house?$$, $$[{"question":"Was there one you particularly liked?","condition_hint":"user_described_kids_friends"},{"question":"Was there one you wished would stay home?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f351cfa8-9232-48f8-abf0-8e094dc6a3a6', 'building_a_life_016', 'life_chapter', 'building_a_life', $$Did you ever lose a parent in this period?$$, $$[{"question":"Were you with them at the end?","condition_hint":"user_described_a_death"},{"question":"Did you have a chance to say what you wanted?","condition_hint":"user_described_final_words"},{"question":"How did your siblings handle it?","condition_hint":"user_described_family_grief"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f8c34924-915f-4b34-a733-31e529c4e400', 'building_a_life_017', 'life_chapter', 'building_a_life', $$Did your friendships shift as your children grew up?$$, $$[{"question":"Did you make new friends through your kids?","condition_hint":"user_described_friendship_shift"},{"question":"Did you lose old friends?","condition_hint":"user_described_drifting"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1f8d21fe-1420-4401-8590-6bf034efbc25', 'building_a_life_018', 'life_chapter', 'building_a_life', $$What's the most money you ever spent on something?$$, $$[{"question":"What was it?","condition_hint":"user_named_a_purchase"},{"question":"Was it worth it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['money']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1b7ec6b3-8daf-4105-8d3e-6532f6671e6e', 'building_a_life_019', 'life_chapter', 'building_a_life', $$Was there a year you and your spouse drifted?$$, $$[{"question":"How did you find each other again?","condition_hint":"user_admitted_to_drift"},{"question":"Did you talk about it?","condition_hint":"user_described_conversation_or_silence"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a983cbd9-24a3-436f-9e4b-cfd7accb88a4', 'building_a_life_020', 'life_chapter', 'building_a_life', $$Was there a year your spouse was your hero?$$, $$[{"question":"What did they do?","condition_hint":"user_described_spouse_action"},{"question":"Did you tell them?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f3062469-8a31-4552-adb6-8b29b795b04b', 'building_a_life_021', 'life_chapter', 'building_a_life', $$Did you ever have a brush with serious illness, your own?$$, $$[{"question":"How did it change you?","condition_hint":"user_described_illness"},{"question":"Did your family know?","condition_hint":"user_described_disclosure"}]$$::jsonb, ARRAY['body']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c87fe5f4-3de8-438f-911f-745e6ecc145c', 'building_a_life_022', 'life_chapter', 'building_a_life', $$Did one of your children have a serious health scare?$$, $$[{"question":"How old were they?","condition_hint":"user_described_child_illness"},{"question":"What did it teach you?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d8ca57c7-ac5b-4fb8-8b04-0558a7d237c2', 'building_a_life_023', 'life_chapter', 'building_a_life', $$What did your weeks look like — the rhythm, the schedule?$$, $$[{"question":"Was there a day you protected for yourself?","condition_hint":"user_described_routine"},{"question":"Did the rhythm change as your kids got older?","condition_hint":"user_described_evolution"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4bb360ac-6861-4dc7-87a8-aab170e6fe26', 'building_a_life_024', 'life_chapter', 'building_a_life', $$Did you teach your children something specific that you wanted them to carry?$$, $$[{"question":"Have they carried it?","condition_hint":"user_described_a_lesson"},{"question":"Are they teaching it to their own kids?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5f3b4c7c-1e2d-4668-9bf6-2939290b87c9', 'building_a_life_025', 'life_chapter', 'building_a_life', $$Was there a time you and your spouse argued in front of the kids?$$, $$[{"question":"Did you talk about it afterward?","condition_hint":"user_described_an_argument"},{"question":"Have your kids brought it up since?","condition_hint":"user_described_legacy"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8d9956ad-42e3-4b52-9f78-1f64dea8ae10', 'building_a_life_026', 'life_chapter', 'building_a_life', $$What was the longest stretch you went without seeing your siblings?$$, $$[{"question":"Why?","condition_hint":"user_described_distance"},{"question":"How did you finally see them again?","condition_hint":"user_described_reunion"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f0ec9e77-606e-4510-919b-7a17128896b0', 'building_a_life_027', 'life_chapter', 'building_a_life', $$Did you have a friend in this period who got you through something?$$, $$[{"question":"What did they do?","condition_hint":"user_named_a_friend"},{"question":"Are they still in your life?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8f36c1ee-7711-4aad-8bd9-b53802dc0a69', 'building_a_life_028', 'life_chapter', 'building_a_life', $$What's a fight you wish you hadn't had?$$, $$[{"question":"With who?","condition_hint":"user_described_a_fight"},{"question":"Did you ever apologize?","condition_hint":"user_described_apology"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a5c4da16-7024-458b-9587-fe05a0e0f6dd', 'building_a_life_029', 'life_chapter', 'building_a_life', $$What's an accomplishment from this stretch nobody knows about?$$, $$[{"question":"Why didn't you tell anyone?","condition_hint":"user_described_a_private_accomplishment"},{"question":"Are you ready to tell anyone now?","condition_hint":"user_seemed_open"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('32176e57-ddf4-47d8-9187-3bd671524a2f', 'building_a_life_030', 'life_chapter', 'building_a_life', $$What were you wrong about for a long time before you knew it?$$, $$[{"question":"How did you find out?","condition_hint":"user_admitted_to_being_wrong"},{"question":"Did anyone try to tell you?","condition_hint":"user_described_warning"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1bb74102-ccb6-46b4-b40d-00c5cb55e5f6', 'middle_001', 'life_chapter', 'middle', $$What was the year your last child left home?$$, $$[{"question":"What was the day they actually left like?","condition_hint":"user_described_empty_nest"},{"question":"Did you and your spouse change the house?","condition_hint":"user_described_house_change"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('725c1d8f-a5ee-41c9-930d-7286041a5cbb', 'middle_002', 'life_chapter', 'middle', $$What did you take up in your fifties or sixties that surprised you?$$, $$[{"question":"What drew you to it?","condition_hint":"user_named_an_activity"},{"question":"Are you any good at it?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fd983a8b-95db-47a4-97c7-a72832941225', 'middle_003', 'life_chapter', 'middle', $$Did you start to think about retirement, and what did that thinking look like?$$, $$[{"question":"Were you ready, financially?","condition_hint":"user_described_retirement_planning"},{"question":"Were you ready, emotionally?","condition_hint":"user_described_emotional_readiness"}]$$::jsonb, ARRAY['money','work']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cfe2ac81-b565-4bcf-8426-e35fb83c2ac9', 'middle_004', 'life_chapter', 'middle', $$Did one of your parents die in this period?$$, $$[{"question":"How long had you known it was coming?","condition_hint":"user_described_parent_death"},{"question":"Did you take care of them at the end?","condition_hint":"user_described_caretaking"},{"question":"How did your relationship to your other parent change?","condition_hint":"user_described_surviving_parent"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1d5ca280-bbc8-47fc-90fb-c5d06595648a', 'middle_005', 'life_chapter', 'middle', $$Did your relationship with your siblings change after a parent died?$$, $$[{"question":"How?","condition_hint":"user_described_sibling_shift"},{"question":"Was there a fight about possessions?","condition_hint":"user_described_estate"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('bb9ed4e4-1919-454d-bb9a-224e36c17cb9', 'middle_006', 'life_chapter', 'middle', $$Did you become a grandparent?$$, $$[{"question":"Where were you when you found out?","condition_hint":"user_described_becoming_grandparent"},{"question":"How was holding your grandchild different from holding your own child?","condition_hint":"user_described_difference"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('001eb88f-883f-4c76-8290-0e59bada2ce2', 'middle_007', 'life_chapter', 'middle', $$What did you do for your grandchildren that nobody asked you to do?$$, $$[{"question":"How did their parents react?","condition_hint":"user_described_grandparent_role"},{"question":"Did your grandchildren know it was you?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1fd7702e-e011-449e-88e0-a307c46abdbe', 'middle_008', 'life_chapter', 'middle', $$Did you and your spouse travel together when the kids were grown?$$, $$[{"question":"Where did you go that surprised you?","condition_hint":"user_described_travel"},{"question":"Did you fight on the trip?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d4fd3c60-2808-4db5-a0d7-6071934715d5', 'middle_009', 'life_chapter', 'middle', $$Did you have a health scare that changed how you live?$$, $$[{"question":"What changed afterward?","condition_hint":"user_described_health_scare"},{"question":"Did you tell your children right away, or wait?","condition_hint":"user_described_disclosure"}]$$::jsonb, ARRAY['body']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b89e8d66-5d3a-48b7-885d-1b54a743f30a', 'middle_010', 'life_chapter', 'middle', $$Did you have a friend die in this period?$$, $$[{"question":"How did you find out?","condition_hint":"user_described_friend_death"},{"question":"What do you carry of theirs?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2810665e-136c-4d68-b175-68e04f21a028', 'middle_011', 'life_chapter', 'middle', $$When did you first feel old?$$, $$[{"question":"What was the moment?","condition_hint":"user_described_feeling_old"},{"question":"Did anyone confirm it?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY['body']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e5ca7956-42ee-432b-b254-e06b98b295f0', 'middle_012', 'life_chapter', 'middle', $$Did you take on care of an aging parent?$$, $$[{"question":"Did your siblings share the work?","condition_hint":"user_described_caretaking"},{"question":"What did you give up?","condition_hint":"user_described_sacrifice"},{"question":"Would you do it the same way again?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f5f1e25d-31cc-487d-8f58-8b327056115f', 'middle_013', 'life_chapter', 'middle', $$Did you change your work in your fifties?$$, $$[{"question":"Why?","condition_hint":"user_described_work_change"},{"question":"Was the new work better?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('100171cf-195b-4218-975a-4c70a3eb2650', 'middle_014', 'life_chapter', 'middle', $$Did you reconcile with someone in this period?$$, $$[{"question":"Who?","condition_hint":"user_admitted_to_reconciliation"},{"question":"What had happened?","condition_hint":"user_described_the_break"},{"question":"Are you on solid ground now?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c587ff51-6ec3-46a9-bef3-84f601b908b2', 'middle_015', 'life_chapter', 'middle', $$Did you and your spouse renew anything — vows, promises, the house?$$, $$[{"question":"What did you renew?","condition_hint":"user_described_renewal"},{"question":"Was it a hard year that came before it?","condition_hint":"user_described_context"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('003eea6c-fb31-4909-a8ed-ea805a44ae34', 'middle_016', 'life_chapter', 'middle', $$Did your political views change in this stretch?$$, $$[{"question":"What changed them?","condition_hint":"user_described_political_shift"},{"question":"Did your family change with you, or stay the same?","condition_hint":"user_described_family_alignment"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('04429702-97df-435e-9043-7821624b35d1', 'middle_017', 'life_chapter', 'middle', $$Was there a year your spouse needed you in a way you hadn't been needed before?$$, $$[{"question":"What did you do?","condition_hint":"user_described_caretaking"},{"question":"Did your relationship change after?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fdb941fc-0e79-4cd3-a3ba-40968ab5ecce', 'middle_018', 'life_chapter', 'middle', $$Did you go back to a place that had been important to you?$$, $$[{"question":"Was it the same?","condition_hint":"user_described_returning"},{"question":"Why did you go?","condition_hint":"user_described_motivation"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('70f41c25-513b-420b-bf74-b3b922c457e6', 'middle_019', 'life_chapter', 'middle', $$Did you make a new friend after fifty?$$, $$[{"question":"How did you meet?","condition_hint":"user_described_new_friendship"},{"question":"Do you trust them the way you trust your old friends?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('38756f08-8d52-456e-876e-f2ae6220653b', 'middle_020', 'life_chapter', 'middle', $$Did you write a letter you'd been putting off?$$, $$[{"question":"Who to?","condition_hint":"user_admitted_to_a_letter"},{"question":"Did they write back?","condition_hint":"user_described_response"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('31427331-464f-4d0e-ad77-b802b77fb1fa', 'middle_021', 'life_chapter', 'middle', $$What did you let go of in this period?$$, $$[{"question":"Was it a possession, a habit, or a person?","condition_hint":"user_described_letting_go"},{"question":"Was it hard?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('949695f0-253b-4bbe-9c63-5eea28906157', 'middle_022', 'life_chapter', 'middle', $$What did you take up in this period?$$, $$[{"question":"Why now, and not earlier?","condition_hint":"user_named_a_new_pursuit"},{"question":"Has it become important?","condition_hint":"user_described_importance"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7658a21d-53a4-4dc5-b41a-463f37511638', 'middle_023', 'life_chapter', 'middle', $$Was there a moment when you realized you were the elder in the room?$$, $$[{"question":"What was the room?","condition_hint":"user_described_being_the_elder"},{"question":"Did the role surprise you?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1e763433-5c70-418c-9a38-49549dcc9458', 'middle_024', 'life_chapter', 'middle', $$What did you stop being afraid of?$$, $$[{"question":"What replaced the fear?","condition_hint":"user_described_releasing_fear"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f5b214cf-b4c6-4f59-b617-3a2f0b4f3dfb', 'middle_025', 'life_chapter', 'middle', $$What started to scare you that didn't used to?$$, $$[{"question":"How do you handle it?","condition_hint":"user_described_new_fear"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5139038f-cb61-4760-b595-e6cf4b299f9a', 'older_001', 'life_chapter', 'older', $$What was the day you retired, if you retired?$$, $$[{"question":"Did anyone celebrate?","condition_hint":"user_described_retirement"},{"question":"Did you know what you'd do the next day?","condition_hint":"user_described_uncertainty"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('93338ed7-87c4-459c-90ae-d76cb632a93e', 'older_002', 'life_chapter', 'older', $$What does a typical Tuesday look like for you now?$$, $$[{"question":"Is that pace what you wanted?","condition_hint":"user_described_routine"},{"question":"Has it changed in the last five years?","condition_hint":"user_described_evolution"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d389ce75-56f2-4597-953f-cfca9d8b0a4d', 'older_003', 'life_chapter', 'older', $$Are you in the same house you raised your children in?$$, $$[{"question":"If yes, has it gotten too big?","condition_hint":"user_described_same_house"},{"question":"If no, where did you go and why?","condition_hint":"user_described_moving"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3bbf6db9-d92f-49a9-aeba-e1641a8ba4ad', 'older_004', 'life_chapter', 'older', $$What's a pleasure you've discovered in your later years?$$, $$[{"question":"What surprised you about it?","condition_hint":"user_named_a_pleasure"},{"question":"Have you tried to share it with anyone?","condition_hint":"user_described_sharing"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('27942e81-7441-4c51-b381-57da7e9ba64b', 'older_005', 'life_chapter', 'older', $$What do you eat now that you didn't used to?$$, $$[{"question":"What changed?","condition_hint":"user_described_food_change"},{"question":"Do you cook for yourself, or does someone cook for you?","condition_hint":"user_described_kitchen_situation"}]$$::jsonb, ARRAY['food','body']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('54482757-f19d-43a4-8b44-938d22250262', 'older_006', 'life_chapter', 'older', $$What do you no longer eat that you used to love?$$, $$[{"question":"Why?","condition_hint":"user_described_food_loss"},{"question":"Do you miss it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY['food','body']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8543e7a9-34f3-45ab-96d5-b49643ae131a', 'older_007', 'life_chapter', 'older', $$Have you lost a friend recently?$$, $$[{"question":"How did you find out?","condition_hint":"user_described_a_recent_loss"},{"question":"Have you been to the funeral?","condition_hint":"user_described_attending"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('41217f7d-7b6e-45ae-a765-7112fef2bc85', 'older_008', 'life_chapter', 'older', $$What do you talk to your spouse about now that you didn't used to?$$, $$[{"question":"What's gone quiet?","condition_hint":"user_described_marital_conversation"},{"question":"Do you watch the same things together?","condition_hint":"user_described_companionship"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('707c277b-337f-4903-85b5-447819f58b77', 'older_009', 'life_chapter', 'older', $$Have you had to stop driving, or are you still driving?$$, $$[{"question":"How did that decision get made?","condition_hint":"user_described_driving"},{"question":"How has your day changed because of it?","condition_hint":"user_described_consequences"}]$$::jsonb, ARRAY['body']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('95daa963-eb3f-4a9f-b70b-5b07b280a4d7', 'older_010', 'life_chapter', 'older', $$Are you in pain, and what kind?$$, $$[{"question":"How do you manage it?","condition_hint":"user_described_pain"},{"question":"Has it changed how you move through your day?","condition_hint":"user_described_adaptation"}]$$::jsonb, ARRAY['body']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('20e27e7e-ba2f-4a5a-9abe-2aedab3f78fb', 'older_011', 'life_chapter', 'older', $$What do your grandchildren know about you that your children don't?$$, $$[{"question":"How did that come about?","condition_hint":"user_described_grandchild_relationship"},{"question":"Does it bother your children?","condition_hint":"user_seemed_amused_or_reflective"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('49677373-f316-4109-8327-feb5636d3677', 'older_012', 'life_chapter', 'older', $$What do you regret, if you regret anything?$$, $$[{"question":"Have you talked about it with anyone?","condition_hint":"user_admitted_to_regret"},{"question":"Is there anything you can still do about it?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ab842492-66cf-4a9e-89eb-2e51f0b0d0c4', 'older_013', 'life_chapter', 'older', $$What are you proud of, that you can say it now without flinching?$$, $$[{"question":"Does anyone in your family know how proud you are?","condition_hint":"user_admitted_to_pride"},{"question":"Have you written it down before?","condition_hint":"user_seemed_open"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1e2658fa-7717-4b7f-95f6-11245835ade0', 'older_014', 'life_chapter', 'older', $$What's your relationship to faith now?$$, $$[{"question":"Has it changed in the last decade?","condition_hint":"user_described_current_faith"},{"question":"Do you pray, and what do you pray for?","condition_hint":"user_described_prayer"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('eb2f7e9d-ddd5-4244-a927-2983b21ba432', 'older_015', 'life_chapter', 'older', $$What do you do when you can't sleep?$$, $$[{"question":"How long has that been your routine?","condition_hint":"user_described_insomnia"},{"question":"Who do you think about at three in the morning?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('81eaf165-dded-4b79-89d4-74e5ad167308', 'older_016', 'life_chapter', 'older', $$What music do you listen to now?$$, $$[{"question":"Has it changed?","condition_hint":"user_described_current_music"},{"question":"Is there a song that always makes you cry?","condition_hint":"user_described_emotional_song"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5f7ab2cb-6da3-4c0b-9ec7-508c6d3b8f32', 'older_017', 'life_chapter', 'older', $$What's a place you still want to see?$$, $$[{"question":"Why haven't you gone?","condition_hint":"user_named_a_place"},{"question":"Will you go?","condition_hint":"user_seemed_open"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('63e22261-8cba-4270-86cf-85a94228e690', 'older_018', 'life_chapter', 'older', $$What's a person you still want to see, and haven't?$$, $$[{"question":"What's stopped you?","condition_hint":"user_named_a_person"},{"question":"What would you say to them?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('609c8f5d-26b8-48a8-9d82-4a491f439907', 'older_019', 'life_chapter', 'older', $$What do you want your grandchildren to remember about you?$$, $$[{"question":"Have you told them, or shown them?","condition_hint":"user_described_legacy_intention"},{"question":"Is there a specific thing you want them to inherit?","condition_hint":"user_described_inheritance"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b4162604-a2e2-4c58-a61b-0e176ab86d77', 'older_020', 'life_chapter', 'older', $$What do you want your children to forgive you for?$$, $$[{"question":"Have you asked them?","condition_hint":"user_admitted_to_seeking_forgiveness"},{"question":"Do you think they have already forgiven you?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('bfb2a968-a971-4090-94ab-de3149cbdd0a', 'now_001', 'life_chapter', 'now', $$What did you do this morning?$$, $$[{"question":"Is that what you do most mornings?","condition_hint":"user_described_morning"},{"question":"Was anyone with you?","condition_hint":"user_described_company"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6416c017-5289-4c36-8876-9761bd135f59', 'now_002', 'life_chapter', 'now', $$What's on your kitchen counter right now?$$, $$[{"question":"Whose mess is it?","condition_hint":"user_described_kitchen"},{"question":"Is there something there that's been there for years?","condition_hint":"user_described_persistence"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cb9705d2-b6d9-4dbc-a884-0f2a9a60cff1', 'now_003', 'life_chapter', 'now', $$Who did you last call on the phone?$$, $$[{"question":"What did you talk about?","condition_hint":"user_named_a_caller"},{"question":"How long do your calls usually last?","condition_hint":"user_described_call_length"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('502a45b3-f628-487e-a019-085a9f576353', 'now_004', 'life_chapter', 'now', $$What's the last thing that made you laugh?$$, $$[{"question":"Did you tell anyone?","condition_hint":"user_described_laughter"},{"question":"Was it the kind of laughter that made you tired afterward?","condition_hint":"user_described_intensity"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e0d472ba-e0de-406c-a3dc-4d1056bd0d7f', 'now_005', 'life_chapter', 'now', $$What's the last thing that made you cry?$$, $$[{"question":"Did anyone see?","condition_hint":"user_described_crying"},{"question":"Was it grief, or something else?","condition_hint":"user_described_cause"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('197c80e6-440b-4de1-88f2-d2dc16a59c82', 'now_006', 'life_chapter', 'now', $$What's a small pleasure of your daily life right now?$$, $$[{"question":"How long have you had it?","condition_hint":"user_named_a_pleasure"},{"question":"Would you give it up for anything?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b39621ba-829e-4d1e-bb40-c8e7ce1eeeca', 'now_007', 'life_chapter', 'now', $$What's the last thing you bought that you're glad about?$$, $$[{"question":"Where did you find it?","condition_hint":"user_named_a_purchase"},{"question":"Did you debate it before you bought it?","condition_hint":"user_seemed_amused"}]$$::jsonb, ARRAY['money']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('36c54c0e-8766-4003-b9c4-20f717e57ec9', 'now_008', 'life_chapter', 'now', $$What chair do you sit in most?$$, $$[{"question":"How did it come into your life?","condition_hint":"user_described_a_chair"},{"question":"Does anyone else sit in it?","condition_hint":"user_described_chair_ownership"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('08e511e1-0455-47a3-84b2-0b97e8c11cdb', 'now_009', 'life_chapter', 'now', $$What's on your bedside table?$$, $$[{"question":"Is the book one you'll finish?","condition_hint":"user_described_bedside"},{"question":"What's been there longest?","condition_hint":"user_described_persistence"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('909ce408-49e3-4fd2-ad5e-75e6eb4efdfd', 'now_010', 'life_chapter', 'now', $$Who is the first person you would call with bad news?$$, $$[{"question":"Have you always called that person?","condition_hint":"user_named_a_person"},{"question":"Why them?","condition_hint":"user_described_relationship"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b9f6dfcb-94b8-4a64-8a19-cedca47187c8', 'now_011', 'life_chapter', 'now', $$Who is the first person you would call with good news?$$, $$[{"question":"Is it the same person, or different?","condition_hint":"user_named_a_person"},{"question":"How do they take good news?","condition_hint":"user_described_response"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('495536fa-b453-43c7-81fa-9e973afbef57', 'now_012', 'life_chapter', 'now', $$What's the last meal you cooked?$$, $$[{"question":"Did you cook for yourself or for someone else?","condition_hint":"user_named_a_meal"},{"question":"Was it new, or something you've made forever?","condition_hint":"user_described_familiarity"}]$$::jsonb, ARRAY['food']::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f0bc0518-2a3a-4b4d-aea9-1f0061f64899', 'now_013', 'life_chapter', 'now', $$What's the last book you finished?$$, $$[{"question":"Would you recommend it?","condition_hint":"user_named_a_book"},{"question":"Are you reading anything now?","condition_hint":"user_described_current_reading"}]$$::jsonb, ARRAY[]::text[], 1, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8f354d4d-1288-4c1c-acd2-a3921510fd7a', 'now_014', 'life_chapter', 'now', $$What do you wish you were doing today?$$, $$[{"question":"Why aren't you?","condition_hint":"user_described_unmet_desire"},{"question":"Could you do it tomorrow?","condition_hint":"user_described_possibility"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6f263c9d-9ebc-4e4c-b279-ba8d84b1bdee', 'now_015', 'life_chapter', 'now', $$What's something you want to say while you can still say it?$$, $$[{"question":"Who do you want to say it to?","condition_hint":"user_described_an_unspoken_thing"},{"question":"Will you?","condition_hint":"user_seemed_reflective"}]$$::jsonb, ARRAY[]::text[], 4, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('96c831b6-c9ba-4d86-ab72-e1039c76df72', 'food_001', 'thematic_thread', 'food', $$What's the meal you've cooked the most times in your life?$$, $$[{"question":"Where did you learn it?","condition_hint":"continuation_0"},{"question":"Has it changed over the years?","condition_hint":"continuation_1"},{"question":"Has anyone in your family taken it up?","condition_hint":"continuation_2"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('514665a5-4bad-4ae2-8a69-b01729c1f08a', 'food_002', 'thematic_thread', 'food', $$What's a meal somebody else made for you that you'll never forget?$$, $$[{"question":"Who made it?","condition_hint":"continuation_0"},{"question":"What was the occasion?","condition_hint":"continuation_1"},{"question":"Have you tried to recreate it?","condition_hint":"continuation_2"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9426dd98-94d5-4952-b109-6c6b40c3f0b0', 'food_003', 'thematic_thread', 'food', $$What's a food you only eat in one season?$$, $$[{"question":"When did that start?","condition_hint":"continuation_0"},{"question":"Where do you eat it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3070bfe0-cdec-43f3-9666-b0be9fd86519', 'food_004', 'thematic_thread', 'food', $$What's a food you ate as a child that you can't find anymore?$$, $$[{"question":"Have you tried to make it?","condition_hint":"continuation_0"},{"question":"Who made it for you?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7199a535-a4df-4434-8475-417f822828bc', 'food_005', 'thematic_thread', 'food', $$Tell me about a kitchen that wasn't yours where you cooked a lot.$$, $$[{"question":"Whose kitchen?","condition_hint":"continuation_0"},{"question":"What did you make there?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f37e6c4d-494c-4db4-87ac-0a1f9b9ad824', 'food_006', 'thematic_thread', 'food', $$What's a food you refused for years and finally tried?$$, $$[{"question":"What changed your mind?","condition_hint":"continuation_0"},{"question":"Do you eat it now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c47f96ba-3f60-4c53-978c-c2262ff1c727', 'food_007', 'thematic_thread', 'food', $$What's a meal that meant a marriage was ending, or beginning?$$, $$[{"question":"Who else was at the table?","condition_hint":"continuation_0"},{"question":"What was the meal?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f00c2cc2-2635-4c9d-bc5e-2f8b4495565b', 'food_008', 'thematic_thread', 'food', $$What's a food you make when you're sad?$$, $$[{"question":"Did your mother make it for you?","condition_hint":"continuation_0"},{"question":"Do you make it for anyone else?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5d88702d-89bb-497e-803d-10e768dec4e2', 'food_009', 'thematic_thread', 'food', $$What's a food you make when you're celebrating?$$, $$[{"question":"What are you celebrating most often?","condition_hint":"continuation_0"},{"question":"Who's the celebration with?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('56566939-13e4-42a1-bc85-6f5ff1b055a5', 'food_010', 'thematic_thread', 'food', $$Tell me about a Thanksgiving that went wrong.$$, $$[{"question":"Who was there?","condition_hint":"continuation_0"},{"question":"What happened?","condition_hint":"continuation_1"},{"question":"Did you laugh about it later?","condition_hint":"continuation_2"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('45a40e85-c1f8-4c6f-9dd1-1f1138c3fe40', 'food_011', 'thematic_thread', 'food', $$Tell me about a holiday meal that became a tradition.$$, $$[{"question":"Who started it?","condition_hint":"continuation_0"},{"question":"Has it survived?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8da78350-3d3b-474f-81b1-dfdc89256c36', 'food_012', 'thematic_thread', 'food', $$What's a food your family argued about?$$, $$[{"question":"Who was on which side?","condition_hint":"continuation_0"},{"question":"Has the argument been settled?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c4c695d4-b0c3-4238-a39f-6527fc15fd06', 'food_013', 'thematic_thread', 'food', $$What did you eat in college, or at your first job?$$, $$[{"question":"Was it a place or a kind of food?","condition_hint":"continuation_0"},{"question":"Could you eat it now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cc5f38b1-9e7c-4849-b2f5-2fe5ab4da75d', 'food_014', 'thematic_thread', 'food', $$What's a food you eat alone that you wouldn't serve to anyone else?$$, $$[{"question":"Why is it private?","condition_hint":"continuation_0"},{"question":"How long has it been your secret meal?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7f8ce682-ef9b-474a-abbf-a23cedb9dfea', 'food_015', 'thematic_thread', 'food', $$What's a meal you'd want at the end of your life?$$, $$[{"question":"Who would be at the table?","condition_hint":"continuation_0"},{"question":"Where would it be?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['food']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0e9a687b-ffe6-42ac-8dff-d9e13a755355', 'money_001', 'thematic_thread', 'money', $$What did you understand about money as a child?$$, $$[{"question":"Where did the lessons come from?","condition_hint":"continuation_0"},{"question":"Did your parents disagree about money?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8b64cff7-fa59-4e95-a5f5-2e2975bd44ac', 'money_002', 'thematic_thread', 'money', $$What's the most you've ever made in a year?$$, $$[{"question":"Did you save any of it?","condition_hint":"continuation_0"},{"question":"Did anyone find out?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a7e6241a-8436-4811-abd4-02d51b514228', 'money_003', 'thematic_thread', 'money', $$What's the least you've ever made in a year?$$, $$[{"question":"How did you survive?","condition_hint":"continuation_0"},{"question":"Who helped, if anyone?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ab9bf967-62b6-4757-846c-6bddabb3966e', 'money_004', 'thematic_thread', 'money', $$What did you do the first time someone owed you money?$$, $$[{"question":"Did you get it back?","condition_hint":"continuation_0"},{"question":"Has it changed how you lend?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5b1812e3-6e95-4e66-8057-6160828381cb', 'money_005', 'thematic_thread', 'money', $$What's the biggest financial mistake you've made?$$, $$[{"question":"Did anyone warn you?","condition_hint":"continuation_0"},{"question":"What did you learn?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('15529d87-5033-4ddf-8fe0-e6b5f433ed92', 'money_006', 'thematic_thread', 'money', $$What did you spend money on that turned out to be the best thing?$$, $$[{"question":"Was it expensive at the time?","condition_hint":"continuation_0"},{"question":"Would you do it again?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('811105de-e5a5-452e-a210-3b250de0a8d4', 'money_007', 'thematic_thread', 'money', $$Did you and your spouse ever fight about money?$$, $$[{"question":"What was it about?","condition_hint":"continuation_0"},{"question":"Have you made peace with it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b3d9547c-e453-4895-9e60-c67f267055b0', 'money_008', 'thematic_thread', 'money', $$Did you ever have to ask for money from family?$$, $$[{"question":"Who?","condition_hint":"continuation_0"},{"question":"Did it change the relationship?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1023ad16-b23a-4020-843e-37b872dc8b57', 'money_009', 'thematic_thread', 'money', $$Have you ever had more money than you knew what to do with?$$, $$[{"question":"What did you do with it?","condition_hint":"continuation_0"},{"question":"Did it change you?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('833f6048-58b9-4e99-b607-370c500d746d', 'money_010', 'thematic_thread', 'money', $$What do you want your children or grandchildren to inherit, and what don't you?$$, $$[{"question":"Have you written it down?","condition_hint":"continuation_0"},{"question":"Have you told them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['money']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8138c4ee-e3f9-4834-9f0a-5c8914075109', 'hands_001', 'thematic_thread', 'hands', $$What have you made with your hands that's still in the world?$$, $$[{"question":"Where is it?","condition_hint":"continuation_0"},{"question":"Does anyone know you made it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('adb59203-e315-446b-84e9-f55706e3163f', 'hands_002', 'thematic_thread', 'hands', $$What did you learn to make from your mother or grandmother?$$, $$[{"question":"Did you ever teach it to anyone?","condition_hint":"continuation_0"},{"question":"Do you still make it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cdbea0e7-dd9d-4ae6-8013-ec872bd2a7c1', 'hands_003', 'thematic_thread', 'hands', $$What did you learn to make from your father or grandfather?$$, $$[{"question":"Did you ever teach it to anyone?","condition_hint":"continuation_0"},{"question":"Did the skill come easy?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('20fcd560-b231-4449-842b-6d46e80b8dde', 'hands_004', 'thematic_thread', 'hands', $$What's a tool you've owned for decades?$$, $$[{"question":"Where did it come from?","condition_hint":"continuation_0"},{"question":"Will you pass it on?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('efc39fe8-6f66-480e-b246-8f283c701381', 'hands_005', 'thematic_thread', 'hands', $$What's the hardest thing you've made?$$, $$[{"question":"How long did it take?","condition_hint":"continuation_0"},{"question":"Did anyone see the work?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d049d4cc-b13d-4d9e-b09c-21cff7cf84ed', 'hands_006', 'thematic_thread', 'hands', $$What's something you tried to make that didn't work?$$, $$[{"question":"Did you try again?","condition_hint":"continuation_0"},{"question":"Do you still have the failed version?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('63cc4dcc-f3a5-453d-91d9-81afb229dba6', 'hands_007', 'thematic_thread', 'hands', $$What craft or skill did you give up?$$, $$[{"question":"Why?","condition_hint":"continuation_0"},{"question":"Do you miss it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('28211201-947f-4850-888a-22603d7a0183', 'hands_008', 'thematic_thread', 'hands', $$What's a thing in your house you fixed that's still holding?$$, $$[{"question":"When did you fix it?","condition_hint":"continuation_0"},{"question":"Has anyone ever noticed?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ff28627b-a32b-4c94-95d9-e185546b48c8', 'hands_009', 'thematic_thread', 'hands', $$What did you knit, sew, build, carve, or grow that someone else has now?$$, $$[{"question":"Who has it?","condition_hint":"continuation_0"},{"question":"Do they know what it took?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6188ee8c-f5f7-4c01-967e-90d81e68c5d1', 'hands_010', 'thematic_thread', 'hands', $$What do your hands look like now?$$, $$[{"question":"Whose hands do they look like?","condition_hint":"continuation_0"},{"question":"What do they remember?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['hands']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ec2d4bd9-cd67-4785-853c-8fd0932fcedc', 'body_001', 'thematic_thread', 'body', $$What's something your body could do once and can't do anymore?$$, $$[{"question":"When did you notice?","condition_hint":"continuation_0"},{"question":"Do you grieve it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b44013bd-9335-485c-b9d4-36b161368c03', 'body_002', 'thematic_thread', 'body', $$What scar do you have, and how did you get it?$$, $$[{"question":"Did you go to the doctor?","condition_hint":"continuation_0"},{"question":"Does it still ache?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f4902ae3-1e4e-4c8b-8058-546363e9d2b9', 'body_003', 'thematic_thread', 'body', $$What surgery have you had?$$, $$[{"question":"How long was the recovery?","condition_hint":"continuation_0"},{"question":"Did anything change after?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1183044a-61d4-4218-8703-2ac0623e1ae7', 'body_004', 'thematic_thread', 'body', $$Did you ever break a bone?$$, $$[{"question":"How?","condition_hint":"continuation_0"},{"question":"Did anyone witness it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5631504d-ebd1-42f0-a146-a14525fc5dcb', 'body_005', 'thematic_thread', 'body', $$What's a habit your body has that nobody else's does?$$, $$[{"question":"Did your parents have it?","condition_hint":"continuation_0"},{"question":"Do your kids have it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f385a121-4b47-46de-a6a1-7d160078a9d5', 'body_006', 'thematic_thread', 'body', $$What did you do for exercise in different parts of your life?$$, $$[{"question":"What do you do now?","condition_hint":"continuation_0"},{"question":"Did you ever love it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d64b79b9-1edd-4204-addd-b15e2184519c', 'body_007', 'thematic_thread', 'body', $$Have you been in a hospital for a long stay?$$, $$[{"question":"What did you eat?","condition_hint":"continuation_0"},{"question":"Who came to see you?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d8ad6d86-4acd-4b45-8695-3745e23181d3', 'body_008', 'thematic_thread', 'body', $$What does aging feel like in your body?$$, $$[{"question":"What's the worst of it?","condition_hint":"continuation_0"},{"question":"What's something unexpected?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f1b72d69-a48c-47eb-882b-c11d6934a9e5', 'body_009', 'thematic_thread', 'body', $$Did you ever fall in love with how you looked?$$, $$[{"question":"When?","condition_hint":"continuation_0"},{"question":"Have you been able to feel that since?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e88b7c8d-1e77-4c26-87f8-1bff4ada8a33', 'body_010', 'thematic_thread', 'body', $$What does your body still surprise you with?$$, $$[{"question":"What does that look like in a typical day?","condition_hint":"continuation_0"}]$$::jsonb, ARRAY['body']::text[], 3, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1eeaa589-4aaf-43d1-85d5-fd175078413f', 'music_001', 'thematic_thread', 'music', $$What was the first song you learned all the words to?$$, $$[{"question":"Where did you learn it?","condition_hint":"continuation_0"},{"question":"Can you still sing it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5696d464-5074-4e8c-a222-217a5545c149', 'music_002', 'thematic_thread', 'music', $$What song was playing the first time you danced with somebody?$$, $$[{"question":"Where were you?","condition_hint":"continuation_0"},{"question":"Are they still in your life?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('73e0b6e8-4948-4848-bfa8-b0d911e784fa', 'music_003', 'thematic_thread', 'music', $$What music played at your wedding?$$, $$[{"question":"Who chose it?","condition_hint":"continuation_0"},{"question":"Have you danced to it since?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9f857e50-926b-44fb-b961-fcd6310915d4', 'music_004', 'thematic_thread', 'music', $$What music played at a funeral that you remember?$$, $$[{"question":"Whose funeral?","condition_hint":"continuation_0"},{"question":"Has it changed how you hear that song?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1855a209-86a9-4505-8d58-7039fe9e06bc', 'music_005', 'thematic_thread', 'music', $$Is there a song that always makes you cry?$$, $$[{"question":"When did it start doing that?","condition_hint":"continuation_0"},{"question":"Do you avoid it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('615220fe-3b59-4c0b-b97e-c481212e9237', 'music_006', 'thematic_thread', 'music', $$Is there a song that always makes you happy?$$, $$[{"question":"When did it start doing that?","condition_hint":"continuation_0"},{"question":"Do you sing along?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d7cbfeb7-3189-45c4-8c3a-d29a8680ecaf', 'music_007', 'thematic_thread', 'music', $$Did you sing as a child?$$, $$[{"question":"Did anyone teach you?","condition_hint":"continuation_0"},{"question":"Do you sing now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8d896edb-af7f-4061-9292-e0a042682f4f', 'music_008', 'thematic_thread', 'music', $$Did you play an instrument?$$, $$[{"question":"Are you still able to?","condition_hint":"continuation_0"},{"question":"Did your kids play?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fe7efa66-8771-41b4-b2c4-c976e86667d0', 'music_009', 'thematic_thread', 'music', $$What's a concert you went to that mattered?$$, $$[{"question":"Who took you?","condition_hint":"continuation_0"},{"question":"Did you go alone or with someone?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f4309654-61f6-4de3-a259-d49f25f5f028', 'music_010', 'thematic_thread', 'music', $$What did your parents listen to?$$, $$[{"question":"Did you hate it then?","condition_hint":"continuation_0"},{"question":"Do you put it on now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['music']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c7ea0b17-51f7-4eab-a5d7-2ba5f85c21dd', 'faith_001', 'thematic_thread', 'faith', $$What do you believe about what happens when you die?$$, $$[{"question":"Has that changed?","condition_hint":"continuation_0"},{"question":"Do you talk about it with anyone?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7412b738-00c4-409e-a755-e04d93f21068', 'faith_002', 'thematic_thread', 'faith', $$Did you have a moment of religious certainty in your life?$$, $$[{"question":"When?","condition_hint":"continuation_0"},{"question":"Did it last?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d443c33d-9e7c-4816-9c7f-ecef096dc192', 'faith_003', 'thematic_thread', 'faith', $$Did you have a moment of religious doubt that shook you?$$, $$[{"question":"What started it?","condition_hint":"continuation_0"},{"question":"Where did you land?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('11c0ef73-1ef5-4a1f-afba-272d32e328b2', 'faith_004', 'thematic_thread', 'faith', $$Was there a clergy person who shaped you?$$, $$[{"question":"What did they say?","condition_hint":"continuation_0"},{"question":"Are they still alive?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8a41b7ee-f0c2-480c-b6f0-10a42fa7c2d8', 'faith_005', 'thematic_thread', 'faith', $$Did you ever leave the faith you were raised in?$$, $$[{"question":"What replaced it?","condition_hint":"continuation_0"},{"question":"Did your parents know?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b5c5f744-4709-49e3-b236-67ea1d87c7e5', 'faith_006', 'thematic_thread', 'faith', $$Did you ever return to the faith you were raised in?$$, $$[{"question":"What brought you back?","condition_hint":"continuation_0"},{"question":"Was anyone surprised?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('92785734-c568-4c58-b760-915d97b14b08', 'faith_007', 'thematic_thread', 'faith', $$Have you prayed for something specific and gotten it?$$, $$[{"question":"What was it?","condition_hint":"continuation_0"},{"question":"What did you make of that?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('12fb544e-1b7e-4093-8095-adbec20dcbd5', 'faith_008', 'thematic_thread', 'faith', $$Have you prayed for something specific and not gotten it?$$, $$[{"question":"What was it?","condition_hint":"continuation_0"},{"question":"What did you make of that?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('f6df3991-58df-4d5a-90fd-1a9ad5dd2286', 'faith_009', 'thematic_thread', 'faith', $$What does grace mean to you, in your own words?$$, $$[{"question":"Did anyone teach you that meaning?","condition_hint":"continuation_0"},{"question":"Have you given it to anyone?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('457a8432-cf7d-4e6e-9abf-6f7681ed081d', 'faith_010', 'thematic_thread', 'faith', $$What do you do on a Sunday morning?$$, $$[{"question":"Is that a tradition or just a habit?","condition_hint":"continuation_0"},{"question":"Has it changed?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['faith']::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('3e44407f-7088-4381-a5b2-021debf81fa2', 'places_001', 'thematic_thread', 'places', $$What's the place that smells like home to you?$$, $$[{"question":"Why that smell?","condition_hint":"continuation_0"},{"question":"Do you go back?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('43c21fc3-c107-4258-8c3e-45210f73db80', 'places_002', 'thematic_thread', 'places', $$What's a city you walked through that you've never forgotten?$$, $$[{"question":"When were you there?","condition_hint":"continuation_0"},{"question":"Why was it that walk?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('98e39d43-60ca-4098-833e-ebe9807914ff', 'places_003', 'thematic_thread', 'places', $$What's the longest you've been away from home?$$, $$[{"question":"Where were you?","condition_hint":"continuation_0"},{"question":"What did you miss most?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1cf72dd3-95d9-4c12-9900-0379b50f3b35', 'places_004', 'thematic_thread', 'places', $$What place have you returned to over and over?$$, $$[{"question":"What pulls you?","condition_hint":"continuation_0"},{"question":"Has it changed?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6de54cbd-6093-4390-9939-4244e423dce4', 'places_005', 'thematic_thread', 'places', $$What place did you leave and never go back to?$$, $$[{"question":"Why?","condition_hint":"continuation_0"},{"question":"Would you go now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('fd6d9977-02d7-4a76-9a77-73525079aa66', 'places_006', 'thematic_thread', 'places', $$What's the most beautiful place you've been?$$, $$[{"question":"Who were you with?","condition_hint":"continuation_0"},{"question":"Have you tried to describe it before?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ab2a2aa5-3c39-4586-b226-84f55ef1821b', 'places_007', 'thematic_thread', 'places', $$What's the worst place you've slept?$$, $$[{"question":"Why were you there?","condition_hint":"continuation_0"},{"question":"Did anyone witness?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('1717f593-2965-408f-b04c-b30602cc4922', 'places_008', 'thematic_thread', 'places', $$What's the strangest house you've ever been in?$$, $$[{"question":"Whose house?","condition_hint":"continuation_0"},{"question":"How did you end up there?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cd4cae5c-5f4b-4061-abdf-6504bb8f2627', 'places_009', 'thematic_thread', 'places', $$What place do you go to think?$$, $$[{"question":"When did it become that place?","condition_hint":"continuation_0"},{"question":"Do you go alone?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4efda4f4-a399-4d20-8de8-5bac7905bb33', 'places_010', 'thematic_thread', 'places', $$What place would you have lived if your life had gone differently?$$, $$[{"question":"What stopped you?","condition_hint":"continuation_0"},{"question":"Do you wish you had?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['places']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2bcf6388-06bf-419a-ae0a-6a55ba33238e', 'work_001', 'thematic_thread', 'work', $$What was your favorite job?$$, $$[{"question":"What made it favorite?","condition_hint":"continuation_0"},{"question":"Why did it end?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('90453e7b-2dfb-416d-b64f-903813467337', 'work_002', 'thematic_thread', 'work', $$Who taught you the most about how to do your work?$$, $$[{"question":"Are they still alive?","condition_hint":"continuation_0"},{"question":"Have you told them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2b70313b-65af-4652-abca-a428ff20c05a', 'work_003', 'thematic_thread', 'work', $$What did you do for work that surprised even you?$$, $$[{"question":"How did you end up there?","condition_hint":"continuation_0"},{"question":"Did it last?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9554d849-9648-49bb-8328-35d04665b338', 'work_004', 'thematic_thread', 'work', $$What was the worst boss you ever had?$$, $$[{"question":"Why were they bad?","condition_hint":"continuation_0"},{"question":"Did you ever stand up to them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('a2d1298b-1616-41f2-94d9-2ad89fa57feb', 'work_005', 'thematic_thread', 'work', $$What was the best boss you ever had?$$, $$[{"question":"What made them good?","condition_hint":"continuation_0"},{"question":"Are you still in touch?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('89e83025-88c6-4daa-9782-fcb3af370a92', 'work_006', 'thematic_thread', 'work', $$Did you have a mentor at work?$$, $$[{"question":"What did they teach you?","condition_hint":"continuation_0"},{"question":"Have you been one for someone else?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7ee8d3e6-272e-41ae-8262-858a7d03faef', 'work_007', 'thematic_thread', 'work', $$Did you ever fire someone?$$, $$[{"question":"How did you do it?","condition_hint":"continuation_0"},{"question":"Did you handle it well?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b671a6ac-b8f4-4944-998a-8fa33d7f838f', 'work_008', 'thematic_thread', 'work', $$Did you ever quit a job dramatically?$$, $$[{"question":"What was the last straw?","condition_hint":"continuation_0"},{"question":"Was it worth it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('41980650-fa08-4903-b93e-114375634ace', 'work_009', 'thematic_thread', 'work', $$What's a piece of work you did that you're still proud of?$$, $$[{"question":"Does anyone else know about it?","condition_hint":"continuation_0"},{"question":"Where is the work now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b598d44f-8488-48d6-8ce8-2e45be4e2fa6', 'work_010', 'thematic_thread', 'work', $$If you could go back, would you do the same work?$$, $$[{"question":"What would you do differently?","condition_hint":"continuation_0"}]$$::jsonb, ARRAY['work']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('760a5492-b682-4207-91b1-d1a4fb89a8a8', 'losses_001', 'thematic_thread', 'losses', $$Who's the first person you remember dying?$$, $$[{"question":"How old were you?","condition_hint":"continuation_0"},{"question":"Were you allowed at the funeral?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0fd48f7d-1736-4936-8ab8-c1a160e6c2fd', 'losses_002', 'thematic_thread', 'losses', $$Who's a person you've lost that you carry with you?$$, $$[{"question":"What did they teach you?","condition_hint":"continuation_0"},{"question":"Do you talk to them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('180ed56f-e9d3-4efa-af09-3559137a93c3', 'losses_003', 'thematic_thread', 'losses', $$What was the hardest year of grief?$$, $$[{"question":"Who did you lose?","condition_hint":"continuation_0"},{"question":"Who got you through?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('55eaec2e-7307-418c-b8dc-542d3c33c733', 'losses_004', 'thematic_thread', 'losses', $$Who in your life died too young?$$, $$[{"question":"What were they like?","condition_hint":"continuation_0"},{"question":"What might they have become?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9f1ccb49-013e-481b-970d-0d00f00e7c22', 'losses_005', 'thematic_thread', 'losses', $$Have you lost a child?$$, $$[{"question":"What do you keep of theirs?","condition_hint":"continuation_0"},{"question":"Do you talk about them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('5f57acee-8703-4d14-9a3e-88e018280e5c', 'losses_006', 'thematic_thread', 'losses', $$Have you lost a pet that mattered?$$, $$[{"question":"What was their name?","condition_hint":"continuation_0"},{"question":"How long was the grief?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('608349f2-fa5d-4241-9596-f2d1a94cc2a1', 'losses_007', 'thematic_thread', 'losses', $$Have you lost a friendship without anyone dying?$$, $$[{"question":"What happened?","condition_hint":"continuation_0"},{"question":"Have you tried to repair it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('27e09a70-54aa-4ad6-a4f4-5a16ada176dc', 'losses_008', 'thematic_thread', 'losses', $$Have you lost a marriage?$$, $$[{"question":"How long did it take to feel like yourself again?","condition_hint":"continuation_0"},{"question":"Have you forgiven them, or yourself?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('41ba81dd-9f84-41b1-b5ef-121b17c93409', 'losses_009', 'thematic_thread', 'losses', $$What do you do on the anniversary of a loss?$$, $$[{"question":"Has the ritual changed over time?","condition_hint":"continuation_0"},{"question":"Do others know about it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('93752503-a8a9-4069-83d0-f5112c4e18b9', 'losses_010', 'thematic_thread', 'losses', $$What's a loss you're still figuring out how to carry?$$, $$[{"question":"Do you have help with it?","condition_hint":"continuation_0"},{"question":"Do you want help?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['losses']::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4c152c11-043a-4309-808e-4aa432ce48bb', 'people_001', 'thematic_thread', 'people', $$Who has shaped you the most?$$, $$[{"question":"When did you realize it?","condition_hint":"continuation_0"},{"question":"Have you told them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ade5c08b-643d-4c33-abe1-58ceb2176a5b', 'people_002', 'thematic_thread', 'people', $$Who in your family was nothing like the rest of the family?$$, $$[{"question":"What were they like?","condition_hint":"continuation_0"},{"question":"Did the family accept them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('d81bdaf9-ff32-4c17-87ef-b09b97be570e', 'people_003', 'thematic_thread', 'people', $$Who is a friend who became family?$$, $$[{"question":"When did the line blur?","condition_hint":"continuation_0"},{"question":"Are they still in your life?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9a65e50d-37dc-479d-b5e0-2d9beb7e7a6e', 'people_004', 'thematic_thread', 'people', $$Who is a person you only knew briefly who left a mark?$$, $$[{"question":"What did they do or say?","condition_hint":"continuation_0"},{"question":"Where are they now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('caaf31f4-a599-4aa9-9ce4-db76230dfb03', 'people_005', 'thematic_thread', 'people', $$Who is a person you helped that you're proud of helping?$$, $$[{"question":"What did you do?","condition_hint":"continuation_0"},{"question":"Are they aware?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0734cd5c-7398-4108-a59a-18dd500a80ef', 'people_006', 'thematic_thread', 'people', $$Who is a person who helped you when you needed it most?$$, $$[{"question":"What did they do?","condition_hint":"continuation_0"},{"question":"Have you thanked them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('023ddb10-e928-4606-b7d3-22a87649cf6a', 'people_007', 'thematic_thread', 'people', $$Who is a person you've outlived that you wish you hadn't?$$, $$[{"question":"What were they like?","condition_hint":"continuation_0"},{"question":"What did they leave behind?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9935ed89-468f-4e3e-ae96-064118eed3fd', 'people_008', 'thematic_thread', 'people', $$Who's the most stubborn person in your family?$$, $$[{"question":"What do they refuse to do?","condition_hint":"continuation_0"},{"question":"Has it changed?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('826732e0-d576-4b42-a970-cb1f465af4be', 'people_009', 'thematic_thread', 'people', $$Who's the funniest person in your family?$$, $$[{"question":"What's the funniest thing they ever did?","condition_hint":"continuation_0"},{"question":"Does it still come up?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('479d3280-90a6-43d1-9158-5623d6af7a75', 'people_010', 'thematic_thread', 'people', $$Who's a person you've been wrong about?$$, $$[{"question":"When did you figure it out?","condition_hint":"continuation_0"},{"question":"Did you tell them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b53ba1e4-6e68-44f4-975f-57abc02c6f81', 'things_you_have_kept_001', 'thematic_thread', 'things_you_have_kept', $$What's something you've kept that nobody else would value?$$, $$[{"question":"Where do you keep it?","condition_hint":"continuation_0"},{"question":"What does it mean?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('083afb85-cf27-43f2-bd59-d243aff31e46', 'things_you_have_kept_002', 'thematic_thread', 'things_you_have_kept', $$What's something you've kept from your parents?$$, $$[{"question":"What is it?","condition_hint":"continuation_0"},{"question":"Will you pass it on?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('70996867-8688-4b6c-aa3a-b04c7ebfd987', 'things_you_have_kept_003', 'thematic_thread', 'things_you_have_kept', $$What's something you've kept from a friendship that ended?$$, $$[{"question":"Why did you keep it?","condition_hint":"continuation_0"},{"question":"Could you part with it now?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c5032cb9-6692-4551-aa12-01216e491e1b', 'things_you_have_kept_004', 'thematic_thread', 'things_you_have_kept', $$What's a letter you've saved?$$, $$[{"question":"Who wrote it?","condition_hint":"continuation_0"},{"question":"Have you read it again recently?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('0dd25a16-4b41-4f89-a453-09628e1d0c25', 'things_you_have_kept_005', 'thematic_thread', 'things_you_have_kept', $$What's a photograph you keep where you can see it?$$, $$[{"question":"When was it taken?","condition_hint":"continuation_0"},{"question":"Who took it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('72fc1bd7-aab6-4f9e-9871-5e2b40d2874c', 'things_you_have_buried_001', 'thematic_thread', 'things_you_have_buried', $$What's something you've never told anyone?$$, $$[{"question":"Are you ready to tell now?","condition_hint":"continuation_0"},{"question":"What would happen if you did?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('37873627-1502-413b-9e82-90e724fc3ca3', 'things_you_have_buried_002', 'thematic_thread', 'things_you_have_buried', $$What's a secret you've kept for someone else?$$, $$[{"question":"Are they still alive?","condition_hint":"continuation_0"},{"question":"Has the secret stayed safe?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ae77ebbe-9e7d-425c-8cf0-213a4820f840', 'things_you_have_buried_003', 'thematic_thread', 'things_you_have_buried', $$What's a story in your family that nobody talks about?$$, $$[{"question":"Does anyone alive still know the truth?","condition_hint":"continuation_0"},{"question":"Will it be lost?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('2149b065-598d-42e8-a261-92f3b577f0da', 'things_you_have_buried_004', 'thematic_thread', 'things_you_have_buried', $$What did you do that you've never owned up to?$$, $$[{"question":"Do you want to?","condition_hint":"continuation_0"},{"question":"What's stopping you?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('23a0f30d-447e-45f0-a032-2eed927865d6', 'things_you_have_buried_005', 'thematic_thread', 'things_you_have_buried', $$What's something you wish you had said before someone died?$$, $$[{"question":"Who did you want to say it to?","condition_hint":"continuation_0"},{"question":"Have you found another way to say it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 4, true)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('bf661cf5-8b1f-432a-bff5-538e7515b645', 'what_you_believe_now_001', 'thematic_thread', 'what_you_believe_now', $$What do you believe now that you didn't believe at twenty?$$, $$[{"question":"What changed it?","condition_hint":"continuation_0"},{"question":"Did anyone help you change?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ad2552e5-8e03-40b2-91aa-eb5328a2c060', 'what_you_believe_now_002', 'thematic_thread', 'what_you_believe_now', $$What do you still believe that you've believed your whole life?$$, $$[{"question":"Where did the belief come from?","condition_hint":"continuation_0"},{"question":"Is there a story behind it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c7c236ba-5a69-49f3-bbea-f9618bf81558', 'what_you_believe_now_003', 'thematic_thread', 'what_you_believe_now', $$What do you wish more people understood?$$, $$[{"question":"Have you tried to teach it?","condition_hint":"continuation_0"},{"question":"Where did you learn it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ee0ef3bc-0ff0-497d-8175-f23f85ebdf7e', 'what_you_believe_now_004', 'thematic_thread', 'what_you_believe_now', $$What do you no longer believe?$$, $$[{"question":"What replaced it?","condition_hint":"continuation_0"},{"question":"Did the loss feel like grief?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('35fc0aab-c1ec-4336-a9cc-c408aef32a10', 'what_you_believe_now_005', 'thematic_thread', 'what_you_believe_now', $$What's a piece of advice you'd give that you've actually lived by?$$, $$[{"question":"When did you start living it?","condition_hint":"continuation_0"},{"question":"Has anyone taken it from you?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('ce4a8a71-fd2b-425f-b83a-6d092e698f3d', 'what_you_would_tell_younger_self_001', 'thematic_thread', 'what_you_would_tell_younger_self', $$What would you tell yourself at twenty?$$, $$[{"question":"Would you have listened?","condition_hint":"continuation_0"},{"question":"Did anyone tell you something like that?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('b46b74d1-915e-4b10-b7ba-63e517e2e5ed', 'what_you_would_tell_younger_self_002', 'thematic_thread', 'what_you_would_tell_younger_self', $$What would you tell yourself at thirty?$$, $$[{"question":"What were you struggling with?","condition_hint":"continuation_0"},{"question":"What did you not see?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('240c9657-d0d1-4821-a718-26b567c89654', 'what_you_would_tell_younger_self_003', 'thematic_thread', 'what_you_would_tell_younger_self', $$What would you tell yourself at forty?$$, $$[{"question":"Was forty harder or easier than you thought?","condition_hint":"continuation_0"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('cc3967b7-33bb-48ea-a352-015cd54edd11', 'what_you_would_tell_younger_self_004', 'thematic_thread', 'what_you_would_tell_younger_self', $$What advice did you give yourself that turned out to be wrong?$$, $$[{"question":"When did you realize?","condition_hint":"continuation_0"},{"question":"What replaced it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('6fc1344a-d4b3-4571-a037-f2095664c70a', 'what_you_would_tell_younger_self_005', 'thematic_thread', 'what_you_would_tell_younger_self', $$What advice did you ignore that turned out to be right?$$, $$[{"question":"Who gave it to you?","condition_hint":"continuation_0"},{"question":"Are they still alive to know?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY[]::text[], 3, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('35ffcbfb-b20b-4ee9-b07c-782d22dec138', 'photo_specific_001', 'life_chapter', 'photo_specific', $$There's a person in this photo. Who are they to you?$$, $$[{"question":"When was this taken, roughly?","condition_hint":"continuation_0"},{"question":"Who else is in the photo?","condition_hint":"continuation_1"},{"question":"Where was it taken?","condition_hint":"continuation_2"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('dd868070-f18d-4efc-925f-033557f30aa6', 'photo_specific_002', 'life_chapter', 'photo_specific', $$What was happening the day this was taken?$$, $$[{"question":"Who took the photo?","condition_hint":"continuation_0"},{"question":"Did anyone else come that day?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('400233d4-1581-4614-81f1-f12a79f4fc5c', 'photo_specific_003', 'life_chapter', 'photo_specific', $$What's in the background of this photo that nobody would notice but you?$$, $$[{"question":"Why does that matter?","condition_hint":"continuation_0"},{"question":"Is it still there?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('90f7908b-7dfa-499e-8288-c36e63f3b2e2', 'photo_specific_004', 'life_chapter', 'photo_specific', $$Who's missing from this photo that should be there?$$, $$[{"question":"Why aren't they?","condition_hint":"continuation_0"},{"question":"Where were they?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c0ec7d86-f9db-4ea9-8a48-68204ee56494', 'photo_specific_005', 'life_chapter', 'photo_specific', $$How did you come to have this photo?$$, $$[{"question":"Who gave it to you?","condition_hint":"continuation_0"},{"question":"Have you ever shown it to anyone?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('932ba6a9-c1d1-4590-bbd1-cf178ea11af8', 'photo_specific_006', 'life_chapter', 'photo_specific', $$What were you wearing in this photo?$$, $$[{"question":"Where did the clothes come from?","condition_hint":"continuation_0"},{"question":"Do you still have any of them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('7d657723-376f-4222-a3da-c82b56ec1062', 'photo_specific_007', 'life_chapter', 'photo_specific', $$What does the room or place look like in this photo?$$, $$[{"question":"Is it still there?","condition_hint":"continuation_0"},{"question":"Did you spend a lot of time there?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('e314cce9-e563-49b9-a248-03289f40e3b8', 'photo_specific_008', 'life_chapter', 'photo_specific', $$What's the very next thing that happened after this photo was taken?$$, $$[{"question":"Did anyone remember it?","condition_hint":"continuation_0"},{"question":"Did anyone else see it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('31ededa2-6d51-40f2-a216-23a7464fedcf', 'photo_specific_009', 'life_chapter', 'photo_specific', $$If you could ask the person in this photo one question, what would it be?$$, $$[{"question":"Why that question?","condition_hint":"continuation_0"},{"question":"Did you ever get to ask?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8e43e10b-b2f3-48c7-86b8-38ce13f7748e', 'photo_specific_010', 'life_chapter', 'photo_specific', $$If this photo could be a chapter in your book, what would the chapter be called?$$, $$[{"question":"Why that title?","condition_hint":"continuation_0"},{"question":"What else would be in it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c9cacd47-0d86-4cbb-af1e-c52d90686388', 'photo_specific_011', 'life_chapter', 'photo_specific', $$What's a smell you associate with this photo?$$, $$[{"question":"Why?","condition_hint":"continuation_0"},{"question":"Do you still smell it sometimes?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('26983e97-c18a-4f70-942a-104d069a2002', 'photo_specific_012', 'life_chapter', 'photo_specific', $$What was your relationship like with the people in this photo at this time?$$, $$[{"question":"Did the relationship change?","condition_hint":"continuation_0"},{"question":"Where did it go?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c5c7cede-551c-4dfe-b623-295d3889e8f3', 'photo_specific_013', 'life_chapter', 'photo_specific', $$Was this a happy day or a hard one?$$, $$[{"question":"What does the photo show that the day didn't?","condition_hint":"continuation_0"},{"question":"Or what does it hide?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('88441ef8-9517-4088-a664-15fce7e77af4', 'photo_specific_014', 'life_chapter', 'photo_specific', $$Where was this photo kept all this time?$$, $$[{"question":"Have you looked at it often?","condition_hint":"continuation_0"},{"question":"Is it the only copy?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('28b246c8-9ceb-415e-a2fe-1a4afa5d1ef1', 'photo_specific_015', 'life_chapter', 'photo_specific', $$Who would care most about seeing this photo?$$, $$[{"question":"Why them?","condition_hint":"continuation_0"},{"question":"Have you sent it to them?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('c2e2e6db-01e1-4c44-8314-27a746a12eca', 'photo_specific_016', 'life_chapter', 'photo_specific', $$What sounds were happening when this photo was taken?$$, $$[{"question":"Music? Voices? Quiet?","condition_hint":"continuation_0"},{"question":"Whose voice would be loudest?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('4767d1e9-ff6a-4b08-8c9b-264505338950', 'photo_specific_017', 'life_chapter', 'photo_specific', $$What does the weather look like in this photo, and was that the year's weather or just that day's?$$, $$[{"question":"Was it a hard winter? A hot summer?","condition_hint":"continuation_0"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('8a59f633-d3e2-4505-8205-cbb4be99f955', 'photo_specific_018', 'life_chapter', 'photo_specific', $$Is there a photo from the same day that you don't have?$$, $$[{"question":"What was in it?","condition_hint":"continuation_0"},{"question":"Who has it?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('9e4f2950-e42b-4667-bb45-a280a580e696', 'photo_specific_019', 'life_chapter', 'photo_specific', $$If you turned the photo over, would there be writing on the back?$$, $$[{"question":"What does it say?","condition_hint":"continuation_0"},{"question":"Whose handwriting?","condition_hint":"continuation_1"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;

INSERT INTO memoir_prompts (id, slug, category, chapter_or_thread, primary_question, follow_ups, tags, difficulty, triggers_warning)
VALUES ('55f02789-4fdf-4f77-bcb9-3bfb0013d3d1', 'photo_specific_020', 'life_chapter', 'photo_specific', $$What do you wish you could tell the person you were in this photo?$$, $$[{"question":"Would they have listened?","condition_hint":"continuation_0"}]$$::jsonb, ARRAY['photo']::text[], 2, false)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  chapter_or_thread = EXCLUDED.chapter_or_thread,
  primary_question = EXCLUDED.primary_question,
  follow_ups = EXCLUDED.follow_ups,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  triggers_warning = EXCLUDED.triggers_warning;
