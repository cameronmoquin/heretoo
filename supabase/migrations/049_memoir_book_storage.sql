-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 049: Memoir book storage + render status
-- ════════════════════════════════════════════════════════════════════════
-- The render worker (Render.com container running Pandoc → XeLaTeX →
-- Ghostscript → veraPDF) writes finished PDFs to a private Storage
-- bucket and updates memoir_book_renders. This migration:
--   1. Creates the private 'memoir-books' bucket.
--   2. Adds RLS so an author can read only their own project's files.
--      Path convention: {project_id}/{render_id}/{interior|cover}.pdf
--   3. Adds status/error columns to memoir_book_renders so the
--      frontend can poll a render from 'pending' → 'done' | 'failed'.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Private bucket ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('memoir-books', 'memoir-books', false)
on conflict (id) do nothing;

-- 2. Storage RLS — author reads their own project's objects ───────────
-- The first folder segment of the object name is the project_id.

drop policy if exists memoir_books_author_read on storage.objects;
create policy memoir_books_author_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memoir-books'
    and exists (
      select 1 from public.memoir_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.author_id = auth.uid()
    )
  );

-- Writes come from the worker via the service role, which bypasses
-- RLS. No insert/update/delete policy is granted to end users.

-- 3. Render status columns ────────────────────────────────────────────

alter table public.memoir_book_renders
  add column if not exists status text not null default 'pending'
    check (status in ('pending','rendering','done','failed')),
  add column if not exists error text,
  add column if not exists requested_by uuid references public.profiles(id) on delete set null;

create index if not exists memoir_book_renders_status_idx
  on public.memoir_book_renders (project_id, status, rendered_at desc);

-- DONE.
