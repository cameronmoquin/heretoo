-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 031: audio_url + transcript_confidence on posts
-- ════════════════════════════════════════════════════════════════════════
-- Source of Truth, Milestone 6: voice input deepened.
--
-- A post can now carry an optional audio recording — the actual voice
-- of the author, not just a transcript. The transcript stays in
-- posts.body for search and quick reading; the audio plays from
-- audio_url for users who want to hear the tone.
--
-- transcript_confidence (0..1) flags low-confidence transcriptions so
-- the composer can ask the author to review before posting.
--
-- The "send as voice" UI (composer attaches a recorded audio file
-- alongside the auto-transcribed body) is a follow-up — this migration
-- only adds the schema affordances so the UI can land later without
-- another migration.
-- ════════════════════════════════════════════════════════════════════════

alter table public.posts
  add column if not exists audio_url text,
  add column if not exists transcript_confidence real
    check (transcript_confidence is null or (transcript_confidence >= 0 and transcript_confidence <= 1));

-- Optional: an audio_duration_ms column would let the UI show "1m 24s"
-- without loading the audio. Defer until the recorder UI lands and
-- we know what the recorder actually emits.

-- DONE.
