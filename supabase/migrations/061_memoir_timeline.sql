-- ════════════════════════════════════════════════════════════════════════
-- HereToo. Migration 061. Memoir timeline.
-- ════════════════════════════════════════════════════════════════════════
-- A navigable spine for the memoir. Life events sit on a chronological
-- axis. Schools, jobs, homes, milestones, trips, births. The reader
-- walks the years. Each event can gather the answers written from it
-- and the photos taken during it.
--
-- Dates are fuzzy on purpose. A school year is not a day. Store a real
-- date plus the precision the author actually knows. The UI renders
-- "2003", "Sept 2003", or "Sept 4 2003" and still sorts right. Ongoing
-- events carry a null end.
--
-- Run BY HAND. Idempotent. Self-contained. Atomic. Safe to re-run.
--
-- Adds one table (memoir_timeline_events), links memoir_responses and
-- memoir_assets to it, and dates photos. Every ALTER guards the column.
-- Every constraint sits behind create-table-if-not-exists or add-column-
-- if-not-exists, so a second run is a no-op. No new function. The
-- updated_at bump reuses public.set_updated_at() from migration 001.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- 1. memoir_timeline_events ───────────────────────────────────────────
-- One chronological life event on the memoir spine. The check
-- constraints are inline. create table if not exists means a re-run
-- touches nothing here.

create table if not exists public.memoir_timeline_events (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.memoir_projects(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in
                    ('school','job','residence','milestone','relationship','travel','baby','custom')),
  title           text not null,
  organization    text,
  role_or_grade   text,
  location        text,
  start_date      date,
  start_precision text not null default 'year'
                    check (start_precision in ('year','month','day')),
  end_date        date,
  end_precision   text check (end_precision in ('year','month','day')),
  is_ongoing      boolean not null default false,
  notes           text,
  source          text not null default 'manual'
                    check (source in ('manual','cv_import','baby_book')),
  ordering        int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists memoir_timeline_events_project_start_idx
  on public.memoir_timeline_events (project_id, start_date);

create index if not exists memoir_timeline_events_author_idx
  on public.memoir_timeline_events (author_id);

alter table public.memoir_timeline_events enable row level security;

drop policy if exists memoir_timeline_events_self_select on public.memoir_timeline_events;
create policy memoir_timeline_events_self_select on public.memoir_timeline_events
  for select to authenticated
  using (auth.uid() = author_id);

drop policy if exists memoir_timeline_events_self_insert on public.memoir_timeline_events;
create policy memoir_timeline_events_self_insert on public.memoir_timeline_events
  for insert to authenticated
  with check (auth.uid() = author_id);

drop policy if exists memoir_timeline_events_self_update on public.memoir_timeline_events;
create policy memoir_timeline_events_self_update on public.memoir_timeline_events
  for update to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists memoir_timeline_events_self_delete on public.memoir_timeline_events;
create policy memoir_timeline_events_self_delete on public.memoir_timeline_events
  for delete to authenticated
  using (auth.uid() = author_id);

drop trigger if exists memoir_timeline_events_updated_at on public.memoir_timeline_events;
create trigger memoir_timeline_events_updated_at
  before update on public.memoir_timeline_events
  for each row execute function public.set_updated_at();

-- 2. Link responses to timeline events ────────────────────────────────
-- An answer written from an event carries the event id so the event can
-- show its answers. Nullable. Existing responses stay null. On delete of
-- the event, the response survives and the link clears.

alter table public.memoir_responses
  add column if not exists timeline_event_id uuid
    references public.memoir_timeline_events(id) on delete set null;

create index if not exists memoir_responses_timeline_event_idx
  on public.memoir_responses (timeline_event_id);

-- 3. Date photos and link them to the timeline ────────────────────────
-- captured_at is the real capture time, manual or contemporaneous.
-- captured_precision tracks how much of it the author knows. The legacy
-- date_estimate text column stays for backward compatibility. All
-- nullable. Existing assets stay null.

alter table public.memoir_assets
  add column if not exists captured_at        timestamptz,
  add column if not exists captured_precision text
    check (captured_precision in ('year','month','day')),
  add column if not exists timeline_event_id  uuid
    references public.memoir_timeline_events(id) on delete set null;

create index if not exists memoir_assets_timeline_event_idx
  on public.memoir_assets (timeline_event_id);

commit;

-- DONE.
