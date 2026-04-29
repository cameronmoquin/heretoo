-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 011: Post kinds (with "update" for medical updates)
-- ════════════════════════════════════════════════════════════════════════
-- The original use case for HereToo was a place for a family to
-- coordinate around medical updates — a brother in the hospital, a
-- parent's chemo schedule, a recovering relative. Right now those
-- posts are mixed into the regular family feed, which buries time-
-- sensitive news under daily chatter.
--
-- This migration adds a `kind` column on posts so a poster can flag a
-- post as an "update": time-stamped news the family cares about
-- urgently. Defaults to 'post' so nothing changes for existing rows.
--
-- A new `subject_profile_id` column lets a family optionally pin a
-- single person at the center of the conversation (the relative the
-- family is rallying around). Set in the family-create / family-edit
-- flows. UI surfaces "Updates on <Subject>" prominently when set.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Posts get a kind.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_kind') then
    create type public.post_kind as enum ('post', 'update');
  end if;
end$$;

alter table public.posts
  add column if not exists kind public.post_kind not null default 'post';

create index if not exists posts_kind_family_idx
  on public.posts(family_id, kind, created_at desc);

-- 2. Families optionally point at a subject profile.
alter table public.families
  add column if not exists subject_profile_id uuid
    references public.profiles(id) on delete set null;

-- 3. RLS for the new column doesn't need a new policy — existing post
--    visibility policies already gate visibility correctly. `kind` is
--    metadata, not a permissions axis.

-- DONE.
