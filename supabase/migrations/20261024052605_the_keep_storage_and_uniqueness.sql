-- Co-tenant migration recorded on shared Supabase project dkafqgapepebzjtoghos (the_keep).
-- Preserved in repository migration history so Supabase CLI / GitHub Preview validation stays 1:1 with remote schema_migrations.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('magic-visuals','magic-visuals',false,10485760,ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated users can view magic visuals') THEN
    CREATE POLICY "Authenticated users can view magic visuals" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'magic-visuals');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Service role can upload magic visuals') THEN
    CREATE POLICY "Service role can upload magic visuals" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'magic-visuals');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Service role can update magic visuals') THEN
    CREATE POLICY "Service role can update magic visuals" ON storage.objects FOR UPDATE TO service_role USING (bucket_id = 'magic-visuals');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Service role can delete magic visuals') THEN
    CREATE POLICY "Service role can delete magic visuals" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'magic-visuals');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS visual_assets_unique_slot
  ON visual_assets (trick_id, type, COALESCE(step_index, -1));
