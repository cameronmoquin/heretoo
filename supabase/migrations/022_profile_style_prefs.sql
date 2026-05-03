-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 022: profile.style_prefs jsonb
-- ════════════════════════════════════════════════════════════════════════
-- Lets a user's wallpaper / radio-station / art-filter choices be shown
-- to OTHER viewers on /u/<handle>, not just to themselves on their own
-- device. Until this column existed, all three lived in localStorage
-- and were invisible cross-user.
--
-- Single jsonb column keeps the schema flexible — we'll add new style
-- choices (font scale, theme accent, etc.) without further migrations.
-- Shape today:
--   { wallpaper_id: string,
--     wallpaper_bold: boolean,
--     radio_station_id: string,           // for future multi-station
--     art_filter_summary: { schools, eras, genres, mediums, sources } }
--
-- All authenticated users can READ another user's prefs (consistent
-- with profiles_read = true). Only the owner can UPDATE their own row.
-- The existing profiles_update policy already enforces that, so nothing
-- new to add.
-- ════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists style_prefs jsonb not null default '{}'::jsonb;

-- DONE.
