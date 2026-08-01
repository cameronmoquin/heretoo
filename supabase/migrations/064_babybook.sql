-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 064. Babybook.
-- ════════════════════════════════════════════════════════════════════════
-- A babybook is its own room. One per child. A parent keeps the first
-- years there. Milestones on the spine, notes between them, photos
-- pinned to the moments they belong to.
--
-- This is its own per-child feature. It stands apart from the memoir.
-- The memoir is one author's life, told once. A babybook is one child,
-- and a parent may keep several, one per kid.
--
-- Photos reuse the shared assets bucket (memoir-assets, ASSETS_BUCKET in
-- hooks/useMemoir.ts). Files live there. Only these DB rows are separate.
-- A cover photo and every asset store a storage_path into that bucket.
--
-- The baby interview prompts already exist. memoir_prompts where
-- category = 'timeline_baby' and slug is null, seeded in migration 062.
-- A babybook entry written from one of those carries its prompt_id. No
-- new prompt seed here.
--
-- Run BY HAND. Idempotent. Self-contained. Atomic. Safe to re-run. Every
-- table sits behind create-table-if-not-exists, every policy is drop-then-
-- create, every index and trigger guarded. A second run is a no-op. No new
-- function. The updated_at bumps reuse public.set_updated_at() from
-- migration 001.
--
-- All three tables enable RLS. Every verb is author-only, keyed to
-- auth.uid() = author_id. Each row carries its own author_id, so the
-- child tables key to it directly.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 1. babybooks ────────────────────────────────────────────────────────
-- One book per child. birth_date is fuzzy on purpose. Store the date the
-- parent knows plus the precision. The UI renders "2024", "Mar 2024", or
-- "Mar 4 2024" and still sorts right. cover_storage_path points at a photo
-- in the shared assets bucket. Nullable until the parent picks a cover.

create table if not exists public.babybooks (
  id                  uuid primary key default gen_random_uuid(),
  author_id           uuid not null references public.profiles(id) on delete cascade,
  child_name          text not null,
  birth_date          date,
  birth_precision     text check (birth_precision in ('year','month','day')),
  cover_storage_path  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists babybooks_author_idx
  on public.babybooks (author_id);

alter table public.babybooks enable row level security;

drop policy if exists babybooks_self_select on public.babybooks;
create policy babybooks_self_select on public.babybooks
  for select to authenticated
  using (auth.uid() = author_id);

drop policy if exists babybooks_self_insert on public.babybooks;
create policy babybooks_self_insert on public.babybooks
  for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists babybooks_self_update on public.babybooks;
create policy babybooks_self_update on public.babybooks
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists babybooks_self_delete on public.babybooks;
create policy babybooks_self_delete on public.babybooks
  for delete to authenticated
  using (auth.uid() = author_id);

drop trigger if exists babybooks_updated_at on public.babybooks;
create trigger babybooks_updated_at
  before update on public.babybooks
  for each row execute function public.set_updated_at();

-- 2. babybook_entries ─────────────────────────────────────────────────
-- Milestones and notes on one book's spine. kind splits the two. A
-- milestone is a moment. A note is a line between moments. event_date is
-- fuzzy the same way birth_date is. prompt_id links back to the baby
-- prompt the entry answers, when it answers one. On delete of that prompt
-- the entry survives and the link clears.

create table if not exists public.babybook_entries (
  id              uuid primary key default gen_random_uuid(),
  babybook_id     uuid not null references public.babybooks(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('milestone','note')),
  title           text not null,
  body            text,
  event_date      date,
  event_precision text check (event_precision in ('year','month','day')),
  prompt_id       uuid references public.memoir_prompts(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists babybook_entries_book_date_idx
  on public.babybook_entries (babybook_id, event_date);

alter table public.babybook_entries enable row level security;

drop policy if exists babybook_entries_self_select on public.babybook_entries;
create policy babybook_entries_self_select on public.babybook_entries
  for select to authenticated
  using (auth.uid() = author_id);

drop policy if exists babybook_entries_self_insert on public.babybook_entries;
create policy babybook_entries_self_insert on public.babybook_entries
  for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists babybook_entries_self_update on public.babybook_entries;
create policy babybook_entries_self_update on public.babybook_entries
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists babybook_entries_self_delete on public.babybook_entries;
create policy babybook_entries_self_delete on public.babybook_entries
  for delete to authenticated
  using (auth.uid() = author_id);

drop trigger if exists babybook_entries_updated_at on public.babybook_entries;
create trigger babybook_entries_updated_at
  before update on public.babybook_entries
  for each row execute function public.set_updated_at();

-- 3. babybook_assets ──────────────────────────────────────────────────
-- Photos. Files land in the shared assets bucket. storage_path and
-- thumbnail_path point there. captured_at is the real capture time,
-- manual or contemporaneous. entry_id pins a photo to one milestone. On
-- delete of that entry the photo survives and the link clears. This table
-- carries created_at only, so it takes no updated_at trigger.

create table if not exists public.babybook_assets (
  id              uuid primary key default gen_random_uuid(),
  babybook_id     uuid not null references public.babybooks(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  storage_path    text not null,
  thumbnail_path  text,
  caption         text,
  captured_at     timestamptz,
  captured_precision text check (captured_precision in ('year','month','day')),
  entry_id        uuid references public.babybook_entries(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists babybook_assets_book_idx
  on public.babybook_assets (babybook_id);

alter table public.babybook_assets enable row level security;

drop policy if exists babybook_assets_self_select on public.babybook_assets;
create policy babybook_assets_self_select on public.babybook_assets
  for select to authenticated
  using (auth.uid() = author_id);

drop policy if exists babybook_assets_self_insert on public.babybook_assets;
create policy babybook_assets_self_insert on public.babybook_assets
  for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists babybook_assets_self_update on public.babybook_assets;
create policy babybook_assets_self_update on public.babybook_assets
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists babybook_assets_self_delete on public.babybook_assets;
create policy babybook_assets_self_delete on public.babybook_assets
  for delete to authenticated
  using (auth.uid() = author_id);

commit;

-- DONE.
