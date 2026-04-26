-- ─────────────────────────────────────────────────────────────────────────
-- 019: Candon family post media (photos + Mux video)
-- ─────────────────────────────────────────────────────────────────────────

-- ─── COLUMNS ON candon_family_posts ───
ALTER TABLE candon_family_posts
  ADD COLUMN IF NOT EXISTS photo_urls       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS mux_asset_id     TEXT,
  ADD COLUMN IF NOT EXISTS mux_playback_id  TEXT,
  ADD COLUMN IF NOT EXISTS mux_thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER;

-- ─── STORAGE BUCKET FOR CANDON PHOTOS ───
-- Public-readable so we can <img src=...>; insert/delete gated by RLS below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('candon-photos', 'candon-photos', true)
ON CONFLICT (id) DO NOTHING;

-- ─── STORAGE RLS ───
DROP POLICY IF EXISTS "Candon photos read public" ON storage.objects;
CREATE POLICY "Candon photos read public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'candon-photos');

DROP POLICY IF EXISTS "Candon photos upload own folder" ON storage.objects;
CREATE POLICY "Candon photos upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candon-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Candon photos update own" ON storage.objects;
CREATE POLICY "Candon photos update own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'candon-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Candon photos delete own" ON storage.objects;
CREATE POLICY "Candon photos delete own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'candon-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
