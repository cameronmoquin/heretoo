-- Migration 014: Storage bucket policies

-- Allow anyone to read public photos
CREATE POLICY "Public read post-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-photos');

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated upload post-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-photos' AND auth.uid() IS NOT NULL);

-- Allow users to delete their own photos
CREATE POLICY "Users delete own post-photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Avatars bucket policies
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
