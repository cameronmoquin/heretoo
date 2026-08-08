-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 081: the babybook learns to curate
-- ════════════════════════════════════════════════════════════════════════
-- A decade of photos arrives in bulk and lands as PENDING. The book is
-- built by approving in passes: pending → approved (in the book) or
-- excluded (left out, kept forever, revisable). Photos added by hand
-- before this column existed were each a deliberate choice — they
-- backfill as approved.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

alter table public.babybook_assets
  add column if not exists book_status text not null default 'pending'
  check (book_status in ('pending', 'approved', 'excluded'));

comment on column public.babybook_assets.book_status is
  'Curation state: pending (arrived, unjudged), approved (in the book), excluded (left out — kept, revisable). Bulk ingests land pending; the book renders approved only.';

-- Everything present before curation existed was hand-picked: approved.
update public.babybook_assets set book_status = 'approved'
 where book_status = 'pending';

create index if not exists babybook_assets_status_idx
  on public.babybook_assets (babybook_id, book_status, captured_at);

-- The update policy from 064 is author-own-rows; members judge their
-- own uploads, the book's author judges everything.
drop policy if exists babybook_assets_curate on public.babybook_assets;
create policy babybook_assets_curate on public.babybook_assets
  for update to authenticated
  using (public.uid_owns_babybook(babybook_id))
  with check (public.uid_owns_babybook(babybook_id));

notify pgrst, 'reload schema';

-- DONE.
