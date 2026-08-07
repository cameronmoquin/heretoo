-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 078: the babybook opens to the other parent
-- ════════════════════════════════════════════════════════════════════════
-- 064 made every babybook table author-only. A babybook is a two-parent
-- object: the author invites the other parent (any connection), and a
-- member reads everything and adds their own entries and photos. The
-- book itself — title, cover, deletion, membership — stays the
-- author's.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Members ────────────────────────────────────────────────────────
create table if not exists public.babybook_members (
  babybook_id uuid not null references public.babybooks(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  added_by    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (babybook_id, profile_id)
);

alter table public.babybook_members enable row level security;
revoke all on table public.babybook_members from public, anon;


-- ── 2. Definer helpers, so no policy can form a cycle ─────────────────
-- Same device as uid_has_seen_post (065): the cross-table read happens
-- outside RLS evaluation, keyed on auth.uid() alone.
create or replace function public.uid_owns_babybook(p_book uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.babybooks b
    where b.id = p_book and b.author_id = auth.uid()
  );
$$;

create or replace function public.uid_in_babybook(p_book uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.babybooks b
    where b.id = p_book and b.author_id = auth.uid()
  ) or exists (
    select 1 from public.babybook_members m
    where m.babybook_id = p_book and m.profile_id = auth.uid()
  );
$$;

revoke all on function public.uid_owns_babybook(uuid) from public, anon, authenticated;
grant execute on function public.uid_owns_babybook(uuid) to authenticated;
revoke all on function public.uid_in_babybook(uuid) from public, anon, authenticated;
grant execute on function public.uid_in_babybook(uuid) to authenticated;


-- ── 3. Member rows: visible to the book's people, managed by the author
drop policy if exists babybook_members_select on public.babybook_members;
create policy babybook_members_select on public.babybook_members
  for select to authenticated
  using (profile_id = auth.uid() or public.uid_owns_babybook(babybook_id));

drop policy if exists babybook_members_insert on public.babybook_members;
create policy babybook_members_insert on public.babybook_members
  for insert to authenticated
  with check (public.uid_owns_babybook(babybook_id) and added_by = auth.uid());

drop policy if exists babybook_members_delete on public.babybook_members;
create policy babybook_members_delete on public.babybook_members
  for delete to authenticated
  using (public.uid_owns_babybook(babybook_id) or profile_id = auth.uid());


-- ── 4. The book: readable by its people; the rest stays the author's ──
drop policy if exists babybooks_self_select on public.babybooks;
create policy babybooks_self_select on public.babybooks
  for select to authenticated
  using (auth.uid() = author_id or public.uid_in_babybook(id));


-- ── 5. Entries and photos: read by the book's people, write your own ──
drop policy if exists babybook_entries_self_select on public.babybook_entries;
create policy babybook_entries_self_select on public.babybook_entries
  for select to authenticated
  using (public.uid_in_babybook(babybook_id));

drop policy if exists babybook_entries_self_insert on public.babybook_entries;
create policy babybook_entries_self_insert on public.babybook_entries
  for insert to authenticated
  with check (auth.uid() = author_id and public.uid_in_babybook(babybook_id));

drop policy if exists babybook_assets_self_select on public.babybook_assets;
create policy babybook_assets_self_select on public.babybook_assets
  for select to authenticated
  using (public.uid_in_babybook(babybook_id));

drop policy if exists babybook_assets_self_insert on public.babybook_assets;
create policy babybook_assets_self_insert on public.babybook_assets
  for insert to authenticated
  with check (auth.uid() = author_id and public.uid_in_babybook(babybook_id));

-- update/delete policies from 064 stay as written: your own rows only.


-- ── 6. Storage follows the same rule ──────────────────────────────────
drop policy if exists babybook_assets_author_read on storage.objects;
create policy babybook_assets_author_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.babybooks b
      where b.id::text = (storage.foldername(name))[1]
        and public.uid_in_babybook(b.id)
    )
  );

drop policy if exists babybook_assets_author_insert on storage.objects;
create policy babybook_assets_author_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.babybooks b
      where b.id::text = (storage.foldername(name))[1]
        and public.uid_in_babybook(b.id)
    )
  );

drop policy if exists babybook_assets_author_delete on storage.objects;
create policy babybook_assets_author_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.babybooks b
      where b.id::text = (storage.foldername(name))[1]
        and public.uid_owns_babybook(b.id)
    )
  );

commit;

notify pgrst, 'reload schema';

-- DONE.
