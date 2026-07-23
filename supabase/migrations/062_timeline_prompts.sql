-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 062. Timeline prompts.
-- ════════════════════════════════════════════════════════════════════════
-- Interview questions scoped to a timeline event. Tap a school and you get
-- school questions. Tap a job and you get job questions. Tap a baby and a
-- parent gets baby-book questions. The screen filters memoir_prompts by
-- category, so each timeline event kind maps to one category:
--
--   memoir_timeline_events.kind   ->   memoir_prompts.category
--   'school'                           'timeline_school'
--   'job'                              'timeline_job'
--   'baby'                             'timeline_baby'
--   'milestone'                        'timeline_milestone'
--
-- These rows carry NO slug on purpose. pick_next_memoir_prompt (migration
-- 047) only pulls prompts WHERE slug IS NOT NULL, so a null slug keeps
-- these out of the generic daily rotation. They surface only when the
-- timeline screen asks for a category. The screen renders primary_question,
-- the same field the rest of the memoir feature reads.
--
-- Run BY HAND. Idempotent. Self-contained. Safe to re-run. The insert is
-- guarded by WHERE NOT EXISTS on (primary_question, category), so a second
-- run inserts nothing and never touches an existing prompt row. No new
-- function, so no grants to revoke. RLS on memoir_prompts already allows
-- authenticated select (migration 042).
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 1. Index the timeline categories ────────────────────────────────────
-- The screen filters by category among the sluglessly-seeded rows. Partial
-- index keeps it small and matches the null-slug scope. create index if
-- not exists means a re-run touches nothing.

create index if not exists memoir_prompts_timeline_category_idx
  on public.memoir_prompts (category)
  where slug is null;

-- 2. Seed the prompts ─────────────────────────────────────────────────
-- One insert. The VALUES list is the whole prompt set. The WHERE NOT
-- EXISTS guard dedupes by exact question text within its category, so this
-- inserts each prompt at most once across any number of runs. First row of
-- the VALUES list carries the casts that fix the derived-table column
-- types.

insert into public.memoir_prompts (primary_question, category, position, difficulty)
select v.q, v.cat, v.pos, v.diff
from (values
    -- timeline_school ── questions a person answers about a school
    ($$Who was the first teacher whose name you still remember?$$::text, 'timeline_school'::text, 1001::int, 1::int),
    ($$How did you get to school, and who did you go with?$$, 'timeline_school', 1002, 1),
    ($$Which subject clicked for you the moment it was taught?$$, 'timeline_school', 1003, 1),
    ($$Who did you sit with at lunch, and what was usually on your tray?$$, 'timeline_school', 1004, 1),
    ($$What did you dread about walking into that building?$$, 'timeline_school', 1005, 2),
    ($$Who was your closest friend that year, and what did the two of you do?$$, 'timeline_school', 1006, 1),
    ($$What is the worst trouble you ever got into there?$$, 'timeline_school', 1007, 2),
    ($$What did you win, finish, or pull off at that school?$$, 'timeline_school', 1008, 1),
    ($$Which room or hallway can you still picture with your eyes closed?$$, 'timeline_school', 1009, 1),
    ($$What did you carry in your bag every single day?$$, 'timeline_school', 1010, 1),
    ($$Which teacher believed you could do more than you thought?$$, 'timeline_school', 1011, 2),

    -- timeline_job ── questions a person answers about a job
    ($$What do you remember about your first day on that job?$$, 'timeline_job', 1101, 1),
    ($$Who taught you how the work really got done?$$, 'timeline_job', 1102, 1),
    ($$What was the worst shift you ever pulled?$$, 'timeline_job', 1103, 2),
    ($$What did that job teach you that you still use?$$, 'timeline_job', 1104, 2),
    ($$Which coworker do you still think about?$$, 'timeline_job', 1105, 1),
    ($$Was there a customer or client you never forgot?$$, 'timeline_job', 1106, 1),
    ($$What did you wear, and what did the place smell like?$$, 'timeline_job', 1107, 1),
    ($$How much did you earn, and what did the money go toward?$$, 'timeline_job', 1108, 1),
    ($$Who did you take your breaks with?$$, 'timeline_job', 1109, 1),
    ($$What did you get good at there that surprised you?$$, 'timeline_job', 1110, 2),
    ($$Why did you leave when you did?$$, 'timeline_job', 1111, 2),

    -- timeline_baby ── baby-book milestones, written for a PARENT
    ($$Where were you the day they were born, and who was in the room?$$, 'timeline_baby', 1201, 1),
    ($$How did you choose their name?$$, 'timeline_baby', 1202, 1),
    ($$Who did they look like in those first days?$$, 'timeline_baby', 1203, 1),
    ($$What was their first word, and who did they say it to?$$, 'timeline_baby', 1204, 1),
    ($$When did they take their first steps, and where were you?$$, 'timeline_baby', 1205, 1),
    ($$What kept you up worrying that first year?$$, 'timeline_baby', 1206, 2),
    ($$What surprised you most about becoming their parent?$$, 'timeline_baby', 1207, 2),
    ($$What did they do that made you laugh before they could talk?$$, 'timeline_baby', 1208, 1),
    ($$How did they like to be held?$$, 'timeline_baby', 1209, 1),
    ($$What sound or song settled them down?$$, 'timeline_baby', 1210, 1),
    ($$What did you whisper to them when no one else was awake?$$, 'timeline_baby', 1211, 2),

    -- timeline_milestone ── general life-event prompts
    ($$What changed the day this happened?$$, 'timeline_milestone', 1301, 1),
    ($$Who was there with you?$$, 'timeline_milestone', 1302, 1),
    ($$What did you carry forward from it?$$, 'timeline_milestone', 1303, 2),
    ($$Where were you when you knew things were different?$$, 'timeline_milestone', 1304, 1),
    ($$Who did you tell first?$$, 'timeline_milestone', 1305, 1),
    ($$What did you wish you had said out loud?$$, 'timeline_milestone', 1306, 2),
    ($$What did this teach you that stuck?$$, 'timeline_milestone', 1307, 2),
    ($$What do you remember most, all these years later?$$, 'timeline_milestone', 1308, 1)
) as v(q, cat, pos, diff)
where not exists (
  select 1 from public.memoir_prompts m
  where m.primary_question = v.q
    and m.category = v.cat
);

commit;

-- DONE.
