-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 077: babybook photos may enter the assets bucket
-- ════════════════════════════════════════════════════════════════════════
-- Babybook (064) reuses the shared memoir-assets bucket, uploading to
-- {babybook_id}/{uuid}.{ext} — but the bucket's storage policies (050)
-- only recognise paths whose first folder is a MEMOIR PROJECT id. A
-- babybook id fails the lookup and every babybook photo upload dies
-- with "new row violates row-level security policy".
--
-- Permissive policies OR together, so these three sit beside 050's
-- without touching it: same shape, babybooks instead of
-- memoir_projects, author-only exactly like the babybooks table.
--
-- Run BY HAND in the dashboard SQL editor. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

drop policy if exists babybook_assets_author_read on storage.objects;
create policy babybook_assets_author_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.babybooks b
      where b.id::text = (storage.foldername(name))[1]
        and b.author_id = auth.uid()
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
        and b.author_id = auth.uid()
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
        and b.author_id = auth.uid()
    )
  );

-- DONE.
