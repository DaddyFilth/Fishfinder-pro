-- Production access controls: anonymous clients must not read or write app data.
-- Server-side ingestion continues to use service_role and is intentionally unaffected.

DO $$
DECLARE
  table_name text;
  app_tables text[] := ARRAY[
    'profiles',
    'spots',
    'achievements',
    'user_badges',
    'realtime_alerts',
    'community_map_pins',
    'community_spot_submissions',
    'catches',
    'environmental_snapshots',
    'logbook_trips'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END IF;
  END LOOP;
END $$;

-- Profiles: users can read and update only their own profile; admins retain
-- read access through the existing is_admin() policy.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.spots, public.achievements, public.realtime_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_map_pins TO authenticated;
GRANT SELECT, INSERT ON public.community_spot_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catches TO authenticated;
GRANT SELECT ON public.user_badges TO authenticated;

-- Keep provider cache private to the server-side service role.
REVOKE ALL ON TABLE public.environmental_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.environmental_snapshots TO service_role;

-- Optional user-owned logbook table: apply rules only when present in an
-- existing deployment so this migration remains safe across environments.
DO $$
BEGIN
  IF to_regclass('public.logbook_trips') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "logbook_trips_owner" ON public.logbook_trips';
    EXECUTE $policy$
      CREATE POLICY "logbook_trips_owner"
        ON public.logbook_trips FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $policy$;
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.logbook_trips TO authenticated';
  END IF;
END $$;

-- Explicitly deny anonymous table access even when a previous migration
-- granted a broad table privilege; RLS remains the row-level backstop.
REVOKE ALL ON TABLE
  public.profiles,
  public.spots,
  public.achievements,
  public.user_badges,
  public.realtime_alerts,
  public.community_map_pins,
  public.community_spot_submissions,
  public.catches,
  public.environmental_snapshots
FROM anon;

COMMENT ON SCHEMA public IS 'Application tables require an authenticated Supabase session; service_role is server-only.';
