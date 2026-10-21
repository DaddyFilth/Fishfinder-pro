-- Private catch photo storage bucket with owner-only access. Idempotent.
INSERT INTO storage.buckets (id, name, public)
VALUES ('catch-photos', 'catch-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "catch_photos_select_own" ON storage.objects;
CREATE POLICY "catch_photos_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catch-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "catch_photos_insert_own" ON storage.objects;
CREATE POLICY "catch_photos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catch-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "catch_photos_delete_own" ON storage.objects;
CREATE POLICY "catch_photos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catch-photos' AND (storage.foldername(name))[1] = auth.uid()::text);