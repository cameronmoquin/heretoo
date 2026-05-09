-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 032: The Chorus (Source of Truth, Milestone 7)
-- ════════════════════════════════════════════════════════════════════════
-- Stage B of the Shakespeare bots. Stage A planted character quotes;
-- Stage B gives them voice — they comment, rarely, on real family
-- posts.
--
-- Architecture:
--   - bot_characters: definition table (slug, display_name, voice_prompt,
--     interests, daily_comment_budget, enabled). Voice prompt is the
--     full character system message that the LLM uses to compose.
--   - bot_comments_log: audit trail of every chorus comment with
--     character, post, generated comment, and model used.
--   - families.chorus_enabled: family owners toggle the chorus on/off
--     (default on; spec calls for opt-in feel via family-level control).
--
-- Comments themselves go into the existing public.comments table.
-- They're authored by a single CHORUS_PROFILE_ID configured in the
-- function's env, with a slugline prefix in the body identifying which
-- character spoke. Per-character profiles are a future enhancement
-- when we wire the auth.users admin API into the function.
--
-- Refusal list (M7):
--   - No bots impersonating real living people.
--   - No bots impersonating real dead people. Shakespeare's characters
--     are fictional; that is the line.
--   - No "talk to my deceased relative" features.
--   - No bot DMs.
--   - No bot-to-bot conversations.
-- ════════════════════════════════════════════════════════════════════════

-- 1. bot_characters ───────────────────────────────────────────────────

create table if not exists public.bot_characters (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text unique not null,
  display_name          text not null,
  play                  text,
  voice_prompt          text not null,
  -- Lower-case keywords that signal a post is in this character's
  -- territory. The function only considers a post for a bot when at
  -- least one interest matches the post body. Stops Mercutio from
  -- commenting on the kitchen renovation.
  interests             text[] not null default '{}',
  daily_comment_budget  int not null default 1,
  enabled               boolean not null default true,
  created_at            timestamptz not null default now()
);

alter table public.bot_characters enable row level security;

drop policy if exists bot_characters_read on public.bot_characters;
create policy bot_characters_read on public.bot_characters
  for select to authenticated using (true);

-- No insert/update/delete from clients. Curated by hand.

-- 2. bot_comments_log ─────────────────────────────────────────────────

create table if not exists public.bot_comments_log (
  id                  uuid primary key default gen_random_uuid(),
  bot_character_id    uuid not null references public.bot_characters(id) on delete cascade,
  post_id             uuid not null references public.posts(id) on delete cascade,
  comment_id          uuid references public.comments(id) on delete set null,
  posted_at           timestamptz not null default now(),
  generation_model    text,
  generation_prompt   text
);

create index if not exists bot_comments_log_bot_idx
  on public.bot_comments_log (bot_character_id, posted_at desc);
create index if not exists bot_comments_log_post_idx
  on public.bot_comments_log (post_id);

alter table public.bot_comments_log enable row level security;

drop policy if exists bot_comments_log_read on public.bot_comments_log;
create policy bot_comments_log_read on public.bot_comments_log
  for select to authenticated using (true);

-- Inserts come exclusively from the service-role chorus function.

-- 3. families.chorus_enabled ──────────────────────────────────────────

alter table public.families
  add column if not exists chorus_enabled boolean not null default true;

-- 4. Seed initial roster ──────────────────────────────────────────────
-- Three to start, per spec ("Add slowly. Not all six at launch.").
-- Voice prompts are intentionally short and tonal — the LLM gets
-- character + the post body, the rest comes from temperature.

insert into public.bot_characters (slug, display_name, play, voice_prompt, interests, daily_comment_budget)
values
  (
    'rosalind',
    'Rosalind',
    'As You Like It',
    'You are Rosalind from Shakespeare''s As You Like It. Wry, generous, unafraid of love, takes the long view. You read this real family post and want to leave a single warm-but-witty comment in your own voice — one to three sentences, prose. No exclamation marks. No advice. Speak as if to a friend across the room. Never mention that you are a fictional character. Keep it brief.',
    array['heart', 'love', 'wedding', 'forest', 'exile', 'disguise', 'doubt', 'argument', 'parting', 'meeting'],
    1
  ),
  (
    'beatrice',
    'Beatrice',
    'Much Ado About Nothing',
    'You are Beatrice from Shakespeare''s Much Ado About Nothing. Quick-tongued, plain-spoken, suffers fools poorly but secretly tender. You read this real family post and want to leave one sharp comment that lands kindly underneath. One to two sentences. No exclamation marks. Never mention you are fictional. Speak as a sister-in-law who loves them and is also very tired of nonsense.',
    array['marriage', 'engagement', 'argument', 'man', 'gossip', 'rumor', 'wedding', 'opinion', 'family'],
    1
  ),
  (
    'mercutio',
    'Mercutio',
    'Romeo and Juliet',
    'You are Mercutio from Shakespeare''s Romeo and Juliet. Reckless, brilliant, wordy, prone to flights of metaphor that veer toward sword imagery. You read this real family post and want to leave one comment in your style — one to three sentences, can be a fragment of verse if it lands. No exclamation marks. No "alas." Never mention you are fictional.',
    array['fight', 'wedding', 'feud', 'love', 'sword', 'dance', 'house', 'feast', 'death', 'curse'],
    1
  )
on conflict (slug) do nothing;

-- DONE.
