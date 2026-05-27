-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 047: Memoir, Milestone 13
-- ════════════════════════════════════════════════════════════════════════
-- Promotes the Memoir from a daily-prompt journal into a full
-- project-with-sessions architecture. The spec lives in
-- HereToo_Memoir_Feature_Spec.md; this migration realises §Schema.
--
-- Changes:
--   1. memoir_prompts extended with the richer schema (slug,
--      chapter_or_thread, follow_ups jsonb, tags, difficulty,
--      triggers_warning). The old (prompt, position, retired,
--      starters) columns stay for now so older code doesn't break
--      mid-deploy; they're harmless empty alongside the new fields.
--   2. New memoir_projects, memoir_sessions, memoir_assets,
--      memoir_chapters, memoir_book_renders tables.
--   3. memoir_responses rewritten — the old flat shape is renamed
--      to memoir_responses_legacy (pre-launch, no production data
--      to migrate) and a new memoir_responses lands with the
--      session/project/transcript/cowriter_draft/final_text columns.
--
-- The 390-prompt seed lives in migration 048.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Extend memoir_prompts ────────────────────────────────────────────

alter table public.memoir_prompts
  add column if not exists slug              text,
  add column if not exists chapter_or_thread text,
  add column if not exists follow_ups        jsonb not null default '[]'::jsonb,
  add column if not exists tags              text[] not null default '{}',
  add column if not exists difficulty        int check (difficulty between 1 and 5),
  add column if not exists triggers_warning  boolean not null default false,
  add column if not exists added_at          timestamptz not null default now();

-- The spec uses 'category' values 'life_chapter' | 'thematic_thread'.
-- The legacy seed used 'childhood' | 'origin' | … as category values.
-- Drop the legacy NOT NULL on category if present (already not null in
-- 042 but let's relax) and allow either taxonomy to coexist while the
-- old prompts retire.
alter table public.memoir_prompts
  alter column category drop not null;

-- The legacy `prompt` column held the question text. The new schema
-- uses `primary_question`. Add it as nullable; we'll backfill from
-- `prompt` for any legacy rows kept around.
alter table public.memoir_prompts
  add column if not exists primary_question text;

update public.memoir_prompts
   set primary_question = prompt
 where primary_question is null
   and prompt is not null;

-- Unique on slug — only when set. Partial unique index lets the
-- legacy rows with NULL slug coexist with the new seed.
create unique index if not exists memoir_prompts_slug_uq
  on public.memoir_prompts (slug)
  where slug is not null;

create index if not exists memoir_prompts_chapter_idx
  on public.memoir_prompts (chapter_or_thread)
  where slug is not null;

-- 2. memoir_projects ─────────────────────────────────────────────────

create table if not exists public.memoir_projects (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid references public.families(id) on delete cascade,
  author_id       uuid not null references public.profiles(id) on delete cascade,
  subject_id      uuid references public.profiles(id) on delete set null,
  subject_label   text,
  title           text not null default 'My Life, So Far',
  dedication      text,
  writer_mode     text not null default 'self'
                     check (writer_mode in ('self','interviewer','anyone')),
  guidance_mode   text not null default 'socratic'
                     check (guidance_mode in ('socratic','cowriter','editor')),
  output_mode     text not null default 'kdp'
                     check (output_mode in ('kdp','ingramspark','lulu','private')),
  trim_size       text not null default '6x9',
  paper_color     text not null default 'cream',
  status          text not null default 'drafting'
                     check (status in ('drafting','editing','print_ready','printed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists memoir_projects_author_idx
  on public.memoir_projects (author_id, created_at desc);

alter table public.memoir_projects enable row level security;

drop policy if exists memoir_projects_self on public.memoir_projects;
create policy memoir_projects_self on public.memoir_projects
  for all to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- 3. memoir_sessions ─────────────────────────────────────────────────

create table if not exists public.memoir_sessions (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.memoir_projects(id) on delete cascade,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  guidance_mode_used  text,
  prompt_count        int not null default 0,
  word_count_added    int not null default 0,
  summary_paragraph   text,
  next_session_hint   text
);

create index if not exists memoir_sessions_project_idx
  on public.memoir_sessions (project_id, started_at desc);

alter table public.memoir_sessions enable row level security;

drop policy if exists memoir_sessions_via_project on public.memoir_sessions;
create policy memoir_sessions_via_project on public.memoir_sessions
  for all to authenticated
  using (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_sessions.project_id and p.author_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_sessions.project_id and p.author_id = auth.uid()
  ));

-- 4. memoir_responses (rebuilt) ──────────────────────────────────────
-- Pre-launch: rename the legacy table to _legacy. Any test data the
-- author has typed during dev is preserved there and can be salvaged
-- by hand. New writes flow into the new shape.

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'memoir_responses'
  ) and not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'memoir_responses'
       and column_name = 'session_id'
  ) then
    alter table public.memoir_responses rename to memoir_responses_legacy;
  end if;
end$$;

create table if not exists public.memoir_responses (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.memoir_sessions(id) on delete cascade,
  project_id         uuid not null references public.memoir_projects(id) on delete cascade,
  prompt_id          uuid references public.memoir_prompts(id) on delete set null,
  custom_prompt_text text,
  transcript         text not null,
  audio_url          text,
  cowriter_draft     text,
  user_chose         text check (user_chose in
                       ('keep_transcript','accept_draft','edit_draft','reject')),
  final_text         text not null,
  asset_ids          uuid[] not null default '{}',
  chapter_assignment text,
  ordering_hint      int,
  created_at         timestamptz not null default now()
);

create index if not exists memoir_responses_session_idx
  on public.memoir_responses (session_id, created_at asc);
create index if not exists memoir_responses_project_idx
  on public.memoir_responses (project_id, chapter_assignment, ordering_hint);

alter table public.memoir_responses enable row level security;

drop policy if exists memoir_responses_via_project on public.memoir_responses;
create policy memoir_responses_via_project on public.memoir_responses
  for all to authenticated
  using (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_responses.project_id and p.author_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_responses.project_id and p.author_id = auth.uid()
  ));

-- 5. memoir_assets ───────────────────────────────────────────────────

create table if not exists public.memoir_assets (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.memoir_projects(id) on delete cascade,
  kind                  text not null check (kind in
                          ('photo_digital','photo_scan','document_scan','recorded_audio')),
  storage_path          text not null,
  thumbnail_path        text,
  width_px              int,
  height_px             int,
  dpi_at_intended_size  int,
  caption               text,
  date_estimate         text,
  people_named          text[] not null default '{}',
  place_named           text,
  scan_metadata         jsonb,
  ocr_text              text,
  exif_stripped         boolean not null default true,
  uploaded_at           timestamptz not null default now()
);

create index if not exists memoir_assets_project_idx
  on public.memoir_assets (project_id, uploaded_at desc);

alter table public.memoir_assets enable row level security;

drop policy if exists memoir_assets_via_project on public.memoir_assets;
create policy memoir_assets_via_project on public.memoir_assets
  for all to authenticated
  using (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_assets.project_id and p.author_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_assets.project_id and p.author_id = auth.uid()
  ));

-- 6. memoir_chapters ─────────────────────────────────────────────────

create table if not exists public.memoir_chapters (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.memoir_projects(id) on delete cascade,
  title               text not null,
  ordering            int not null,
  body_md             text not null default '',
  inserted_asset_ids  uuid[] not null default '{}',
  word_count          int not null default 0,
  status              text not null default 'drafting'
                        check (status in ('drafting','review','final'))
);

create index if not exists memoir_chapters_project_idx
  on public.memoir_chapters (project_id, ordering asc);

alter table public.memoir_chapters enable row level security;

drop policy if exists memoir_chapters_via_project on public.memoir_chapters;
create policy memoir_chapters_via_project on public.memoir_chapters
  for all to authenticated
  using (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_chapters.project_id and p.author_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_chapters.project_id and p.author_id = auth.uid()
  ));

-- 7. memoir_book_renders ─────────────────────────────────────────────

create table if not exists public.memoir_book_renders (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.memoir_projects(id) on delete cascade,
  rendered_at         timestamptz not null default now(),
  output_mode         text,
  trim_size           text,
  page_count          int,
  spine_width_in      float,
  interior_pdf_path   text,
  cover_pdf_path      text,
  epub_path           text,
  preview_jpg_paths   text[] not null default '{}',
  validation_passed   boolean,
  validation_log      text
);

create index if not exists memoir_book_renders_project_idx
  on public.memoir_book_renders (project_id, rendered_at desc);

alter table public.memoir_book_renders enable row level security;

drop policy if exists memoir_renders_via_project on public.memoir_book_renders;
create policy memoir_renders_via_project on public.memoir_book_renders
  for all to authenticated
  using (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_book_renders.project_id and p.author_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.memoir_projects p
    where p.id = memoir_book_renders.project_id and p.author_id = auth.uid()
  ));

-- 8. RPC: ensure_default_memoir_project ─────────────────────────────
-- Idempotent. The Memoir page calls this on first visit; the author
-- gets exactly one default project unless they explicitly create more.

create or replace function public.ensure_default_memoir_project()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  select id into pid
    from public.memoir_projects
   where author_id = auth.uid()
   order by created_at asc
   limit 1;

  if pid is null then
    insert into public.memoir_projects (author_id, title)
    values (auth.uid(), 'My Life, So Far')
    returning id into pid;
  end if;

  return pid;
end$$;

grant execute on function public.ensure_default_memoir_project() to authenticated;

-- 9. RPC: pick_next_memoir_prompt ─────────────────────────────────────
-- Picks the next prompt the user hasn't answered in this project.
-- 60–70% bias toward life-chapter prompts (chronological spine),
-- 30–40% toward thematic-thread prompts. Easiest difficulty first.
-- The "currently in" chapter is the one with the most recent response.

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
declare
  current_chapter text;
  roll            float := random();
begin
  -- Authorization: only the project's author can pick.
  if not exists (
    select 1 from public.memoir_projects
     where memoir_projects.id = p_project_id and author_id = auth.uid()
  ) then
    return;
  end if;

  -- What chapter has the author been working in most recently?
  select mp.chapter_or_thread
    into current_chapter
    from public.memoir_responses r
    join public.memoir_prompts mp on mp.id = r.prompt_id
   where r.project_id = p_project_id
     and mp.category = 'life_chapter'
   order by r.created_at desc
   limit 1;

  -- ~65% of the time, pull from the current life-chapter (or before_me
  -- if no chapter established yet). Otherwise pull from any thread.
  if roll < 0.65 then
    return query
      select p.id, p.slug, p.category, p.chapter_or_thread,
             p.primary_question, p.follow_ups, p.tags,
             p.difficulty, p.triggers_warning
        from public.memoir_prompts p
       where p.slug is not null
         and p.category = 'life_chapter'
         and p.chapter_or_thread = coalesce(current_chapter, 'before_me')
         and not exists (
           select 1 from public.memoir_responses r
            where r.project_id = p_project_id
              and r.prompt_id = p.id
         )
       order by coalesce(p.difficulty, 99) asc, random()
       limit 1;
  else
    return query
      select p.id, p.slug, p.category, p.chapter_or_thread,
             p.primary_question, p.follow_ups, p.tags,
             p.difficulty, p.triggers_warning
        from public.memoir_prompts p
       where p.slug is not null
         and not exists (
           select 1 from public.memoir_responses r
            where r.project_id = p_project_id
              and r.prompt_id = p.id
         )
       order by coalesce(p.difficulty, 99) asc, random()
       limit 1;
  end if;
end$$;

grant execute on function public.pick_next_memoir_prompt(uuid) to authenticated;

-- 10. RPC: memoir_progress_for_project ───────────────────────────────

create or replace function public.memoir_progress_for_project(p_project_id uuid)
returns table (
  answered_count int,
  total_count    int,
  word_count     int,
  session_count  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int
       from public.memoir_responses
      where project_id = p_project_id),
    (select count(*)::int
       from public.memoir_prompts
      where slug is not null),
    (select coalesce(sum(array_length(string_to_array(final_text, ' '), 1)), 0)::int
       from public.memoir_responses
      where project_id = p_project_id),
    (select count(*)::int
       from public.memoir_sessions
      where project_id = p_project_id);
$$;

grant execute on function public.memoir_progress_for_project(uuid) to authenticated;

-- 11. Trigger: bump memoir_projects.updated_at on response insert ────

create or replace function public.touch_memoir_project_updated()
returns trigger language plpgsql as $$
begin
  update public.memoir_projects set updated_at = now()
   where id = new.project_id;
  return new;
end$$;

drop trigger if exists memoir_responses_touch_project on public.memoir_responses;
create trigger memoir_responses_touch_project
  after insert or update on public.memoir_responses
  for each row execute function public.touch_memoir_project_updated();

-- DONE.
