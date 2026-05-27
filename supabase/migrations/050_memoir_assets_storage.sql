-- ════════════════════════════════════════════════════════════════════════
-- HereToo — Migration 050: Memoir assets (photos + scans)
-- ════════════════════════════════════════════════════════════════════════
-- The memoir_assets table was created back in 047. This migration adds
-- the matching private Storage bucket and the RLS that scopes objects
-- to the project's author. Path convention:
--   {project_id}/{asset_id}.{ext}
-- The render worker uses the service role to download these into the
-- book PDF.
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('memoir-assets', 'memoir-assets', false)
on conflict (id) do nothing;

-- ── Read: the project's author only ──────────────────────────────────
drop policy if exists memoir_assets_author_read on storage.objects;
create policy memoir_assets_author_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.memoir_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.author_id = auth.uid()
    )
  );

-- ── Insert: the project's author only ────────────────────────────────
drop policy if exists memoir_assets_author_insert on storage.objects;
create policy memoir_assets_author_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.memoir_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.author_id = auth.uid()
    )
  );

-- ── Delete: the project's author only ────────────────────────────────
drop policy if exists memoir_assets_author_delete on storage.objects;
create policy memoir_assets_author_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'memoir-assets'
    and exists (
      select 1 from public.memoir_projects p
      where p.id::text = (storage.foldername(name))[1]
        and p.author_id = auth.uid()
    )
  );

-- DONE.
