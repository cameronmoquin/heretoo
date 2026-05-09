-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 028: Subjects (Source of Truth, Milestone 3)
-- ════════════════════════════════════════════════════════════════════════
-- A Subject is a long-running family story thread — Tim's surgery, Aunt
-- Vee's wedding, the kitchen renovation. Posts get tagged with one or
-- more Subjects; reading a Subject top-to-bottom is reading the story.
--
-- Family-scoped only in v1. Cross-family sharing (is_shared = true) is
-- a follow-up that adds RLS policies for the 3-hop graph.
--
-- The "Updates" tab on family pages is replaced by a "Subjects" tab in
-- the same release. Existing kind='update' posts continue to render in
-- the feed; nothing about post storage changes.
--
-- Refusal list (M3):
--   - No global hashtag index. Subjects are family-scoped.
--   - No trending Subjects across the platform.
--   - No suggestions. The user finds Subjects by being in the family.
-- ════════════════════════════════════════════════════════════════════════

-- 1. subjects table ───────────────────────────────────────────────────

create table if not exists public.subjects (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families(id) on delete cascade,
  name          text not null check (length(name) between 2 and 60),
  slug          text not null,
  description   text,
  cover_post_id uuid references public.posts(id) on delete set null,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  retired_at    timestamptz,
  is_shared     boolean not null default false,
  unique (family_id, slug)
);

create index if not exists subjects_family_idx
  on public.subjects (family_id, retired_at);

alter table public.subjects enable row level security;

-- Read: family members can see their own family's subjects.
drop policy if exists subjects_read on public.subjects;
create policy subjects_read on public.subjects
  for select to authenticated
  using (
    exists (
      select 1 from public.family_members fm
      where fm.family_id = subjects.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- Insert: any active family member can create a subject in their family.
drop policy if exists subjects_insert on public.subjects;
create policy subjects_insert on public.subjects
  for insert to authenticated
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = subjects.family_id
        and fm.profile_id = auth.uid()
        and fm.status = 'active'
    )
  );

-- Update: only the creator can edit (rename, retire, change cover).
-- Family owners get a separate path through a security-definer RPC if
-- we ever need owner-overrides.
drop policy if exists subjects_update on public.subjects;
create policy subjects_update on public.subjects
  for update to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- No delete policy. Subjects are retired (retired_at), not deleted.
-- The cascade from families handles family deletion.

-- 2. post_subjects join table ─────────────────────────────────────────

create table if not exists public.post_subjects (
  post_id    uuid not null references public.posts(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  added_at   timestamptz not null default now(),
  added_by   uuid references public.profiles(id) on delete set null,
  primary key (post_id, subject_id)
);

create index if not exists post_subjects_subject_idx
  on public.post_subjects (subject_id, added_at desc);

alter table public.post_subjects enable row level security;

-- Read: anyone who can see the subject can see the tags. Subject RLS
-- already gates by family membership, so we just defer to it.
drop policy if exists post_subjects_read on public.post_subjects;
create policy post_subjects_read on public.post_subjects
  for select to authenticated
  using (
    exists (
      select 1 from public.subjects s
      where s.id = post_subjects.subject_id
    )
  );

-- Insert: the post author or any active family member can tag a post
-- with a subject in the same family. (This is open by design — anyone
-- in the family can label any post they can see; abuse is bounded by
-- the family's own membership.)
drop policy if exists post_subjects_insert on public.post_subjects;
create policy post_subjects_insert on public.post_subjects
  for insert to authenticated
  with check (
    auth.uid() = added_by
    and exists (
      select 1
      from public.posts p
      join public.subjects s on s.id = post_subjects.subject_id
      join public.family_members fm
        on fm.family_id = s.family_id
       and fm.profile_id = auth.uid()
       and fm.status = 'active'
      where p.id = post_subjects.post_id
        and p.family_id = s.family_id
    )
  );

-- Delete: only who added the tag can remove it.
drop policy if exists post_subjects_delete on public.post_subjects;
create policy post_subjects_delete on public.post_subjects
  for delete to authenticated
  using (auth.uid() = added_by);

-- 3. subject_followers ────────────────────────────────────────────────

create table if not exists public.subject_followers (
  subject_id      uuid not null references public.subjects(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  notify_on_post  boolean not null default true,
  followed_at     timestamptz not null default now(),
  primary key (subject_id, profile_id)
);

create index if not exists subject_followers_profile_idx
  on public.subject_followers (profile_id);

alter table public.subject_followers enable row level security;

-- Read: a user sees their own follow rows.
drop policy if exists subject_followers_self_read on public.subject_followers;
create policy subject_followers_self_read on public.subject_followers
  for select to authenticated
  using (auth.uid() = profile_id);

-- Insert: a user can follow a subject they can see.
drop policy if exists subject_followers_insert on public.subject_followers;
create policy subject_followers_insert on public.subject_followers
  for insert to authenticated
  with check (
    auth.uid() = profile_id
    and exists (
      select 1 from public.subjects s
      where s.id = subject_followers.subject_id
    )
  );

-- Delete: a user can unfollow.
drop policy if exists subject_followers_delete on public.subject_followers;
create policy subject_followers_delete on public.subject_followers
  for delete to authenticated
  using (auth.uid() = profile_id);

-- Update: toggle notify_on_post on own row.
drop policy if exists subject_followers_update on public.subject_followers;
create policy subject_followers_update on public.subject_followers
  for update to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- 4. Helpers ──────────────────────────────────────────────────────────

-- Slugify in Postgres so the client doesn't have to maintain its own.
-- "Tim's surgery" → "tims-surgery". "Aunt Vee's wedding!" → "aunt-vees-wedding".
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    )
  );
$$;

-- Convenience: count of posts attached to each subject.
create or replace function public.subject_post_count(p_subject_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.post_subjects
  where subject_id = p_subject_id;
$$;

grant execute on function public.slugify(text) to authenticated;
grant execute on function public.subject_post_count(uuid) to authenticated;

-- DONE.
