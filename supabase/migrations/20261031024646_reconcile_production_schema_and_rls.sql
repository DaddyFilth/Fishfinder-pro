-- Reconcile production schema drift and harden RLS/RBAC across all SeamCast tables.
-- Additive and idempotent: preserves all existing rows and leaves unrelated co-tenant
-- tables untouched while bringing profiles, catches, spots, saved_spots, logbook_trips,
-- rum_field_vitals, admin_audit_log, community submissions, and storage buckets into parity.

-- ============================================================================
-- 1. PROFILES: schema alignment, RBAC role-escalation guard, and auth backfill
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'angler',
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  life_list jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS life_list jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- Relax legacy NOT NULL / check constraints (such as display_name / home_state on older schemas)
-- so /api/profile upserts that only write (id, username, full_name, avatar_url) succeed.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN display_name DROP DEFAULT;
    ALTER TABLE public.profiles ALTER COLUMN display_name DROP NOT NULL;
    UPDATE public.profiles
    SET full_name = COALESCE(full_name, NULLIF(display_name, ''))
    WHERE full_name IS NULL AND display_name IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'home_state'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN home_state SET DEFAULT 'OK';
    ALTER TABLE public.profiles ALTER COLUMN home_state DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE public.profiles SET role = 'angler' WHERE role = 'user' OR role IS NULL;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'angler';
ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('angler', 'moderator', 'admin'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Enforce role immutability on BOTH INSERT and UPDATE for non-admin authenticated callers.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'angler'
       AND (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL)
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only administrators can assign privileged account roles';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND (auth.role() = 'authenticated' OR auth.uid() IS NOT NULL)
       AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only administrators can change account roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER prevent_profile_role_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_role_escalation();

REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_profile_role_escalation() TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'angler');

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND (role = 'angler' OR public.is_admin()));

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Auto-provision public.profiles on auth.users signup without disturbing any
-- existing triggers on auth.users.
CREATE OR REPLACE FUNCTION public.seamcast_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''), ''),
    'angler'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seamcast_handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seamcast_handle_new_user() TO service_role;

DROP TRIGGER IF EXISTS seamcast_on_auth_user_created ON auth.users;
CREATE TRIGGER seamcast_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.seamcast_handle_new_user();

INSERT INTO public.profiles (id, full_name, avatar_url, role)
SELECT
  u.id,
  NULLIF(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ''),
  NULLIF(COALESCE(u.raw_user_meta_data->>'avatar_url', ''), ''),
  'angler'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. CATCHES: add missing runtime columns, defaults, and owner-only RLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.catches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id text,
  spot_name text,
  species text NOT NULL,
  weight_lbs numeric,
  length_in numeric,
  bait text,
  notes text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  is_public boolean NOT NULL DEFAULT false,
  weather_snapshot jsonb DEFAULT '{}'::jsonb,
  caught_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS spot_id text,
  ADD COLUMN IF NOT EXISTS spot_name text,
  ADD COLUMN IF NOT EXISTS weight_lbs numeric,
  ADD COLUMN IF NOT EXISTS length_in numeric,
  ADD COLUMN IF NOT EXISTS bait text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weather_snapshot jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS caught_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.catches ALTER COLUMN caught_at SET DEFAULT now();
ALTER TABLE public.catches ALTER COLUMN is_public SET DEFAULT false;
UPDATE public.catches SET is_public = false WHERE is_public IS NULL;
ALTER TABLE public.catches ALTER COLUMN is_public SET NOT NULL;
ALTER TABLE public.catches DROP CONSTRAINT IF EXISTS catches_spot_id_fkey;

ALTER TABLE public.catches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.catches TO authenticated;

DROP POLICY IF EXISTS "catches_select_own" ON public.catches;
DROP POLICY IF EXISTS "catches_insert_own" ON public.catches;
DROP POLICY IF EXISTS "catches_update_own" ON public.catches;
DROP POLICY IF EXISTS "catches_delete_own" ON public.catches;
DROP POLICY IF EXISTS "catches_select_policy" ON public.catches;
DROP POLICY IF EXISTS "catches_insert_policy" ON public.catches;
DROP POLICY IF EXISTS "catches_update_policy" ON public.catches;
DROP POLICY IF EXISTS "catches_delete_policy" ON public.catches;

CREATE POLICY "catches_select_policy"
  ON public.catches FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "catches_insert_policy"
  ON public.catches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "catches_update_policy"
  ON public.catches FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "catches_delete_policy"
  ON public.catches FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. COMMUNITY SUBMISSIONS & MAP PINS: eliminate self-approval path
-- ============================================================================
ALTER TABLE public.community_spot_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.community_spot_submissions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.community_spot_submissions TO authenticated;

DROP POLICY IF EXISTS "community_spot_submissions_owner" ON public.community_spot_submissions;
DROP POLICY IF EXISTS "community_spot_submissions_view_own" ON public.community_spot_submissions;
DROP POLICY IF EXISTS "community_spot_submissions_insert_own" ON public.community_spot_submissions;
DROP POLICY IF EXISTS "community_spot_submissions_admin_all" ON public.community_spot_submissions;

CREATE POLICY "community_spot_submissions_view_own"
  ON public.community_spot_submissions FOR SELECT TO authenticated
  USING (auth.uid() = submitted_by);

CREATE POLICY "community_spot_submissions_insert_own"
  ON public.community_spot_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

CREATE POLICY "community_spot_submissions_admin_all"
  ON public.community_spot_submissions FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.community_map_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.community_map_pins FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.community_map_pins TO authenticated;

DROP POLICY IF EXISTS "community_map_pins_select_own" ON public.community_map_pins;
DROP POLICY IF EXISTS "community_map_pins_select" ON public.community_map_pins;
DROP POLICY IF EXISTS "community_map_pins_insert" ON public.community_map_pins;
DROP POLICY IF EXISTS "community_map_pins_update" ON public.community_map_pins;
DROP POLICY IF EXISTS "community_map_pins_delete" ON public.community_map_pins;

CREATE POLICY "community_map_pins_select"
  ON public.community_map_pins FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "community_map_pins_insert"
  ON public.community_map_pins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_map_pins_update"
  ON public.community_map_pins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_map_pins_delete"
  ON public.community_map_pins FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. SPOTS & SPOT METADATA: enrich columns, ADA notes, and authenticated RLS
-- ============================================================================
ALTER TABLE public.spots
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS species text[],
  ADD COLUMN IF NOT EXISTS amenities text[],
  ADD COLUMN IF NOT EXISTS metadata_updated_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spots' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.spots DROP CONSTRAINT IF EXISTS spots_created_by_fkey;
    ALTER TABLE public.spots
      ADD CONSTRAINT spots_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spots are publicly readable" ON public.spots;
DROP POLICY IF EXISTS "spots_read_public" ON public.spots;
DROP POLICY IF EXISTS "only service role inserts" ON public.spots;
DROP POLICY IF EXISTS "spots_select_all" ON public.spots;
DROP POLICY IF EXISTS "spots_select_authenticated" ON public.spots;

CREATE POLICY "spots_select_authenticated"
  ON public.spots FOR SELECT TO authenticated
  USING (true);

REVOKE ALL ON TABLE public.spots FROM anon;
GRANT SELECT ON TABLE public.spots TO authenticated, service_role;

UPDATE public.spots
SET notes = 'City-managed lake southwest of Purcell with fishing jetties, boat ramp, pavilions, and a designated swimming area. ADA accessible fishing dock, ADA restrooms, and ADA accessible fishing areas are documented. Verify current local access and Oklahoma fishing-license requirements.'
WHERE id::text IN ('51', '00000000-0000-4000-8000-000000000051') OR name = 'Purcell Lake';

UPDATE public.spots
SET notes = 'City-managed lake northeast of Pauls Valley with campsites, boat ramps, and fishing jetties. Verified ADA accessible fishing access, ADA restrooms, and ADA parking are documented. Verify city permit requirements and current access before travel.'
WHERE id::text IN ('52', '00000000-0000-4000-8000-000000000052') OR name = 'Pauls Valley Lake';

CREATE TABLE IF NOT EXISTS public.spot_metadata (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  waterbody text,
  county text,
  ada boolean NOT NULL DEFAULT false,
  amenities text[] NOT NULL DEFAULT '{}',
  notes text,
  source_url text NOT NULL,
  scraped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url, name)
);

ALTER TABLE public.spot_metadata ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.spot_metadata FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.spot_metadata TO service_role;

-- ============================================================================
-- 5. MISSING RUNTIME TABLES: saved_spots, logbook_trips, rum_field_vitals, admin_audit_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spot_id)
);

CREATE INDEX IF NOT EXISTS saved_spots_user_id_idx ON public.saved_spots (user_id);
ALTER TABLE public.saved_spots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.saved_spots FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_spots TO authenticated;

DROP POLICY IF EXISTS "saved_spots_select_own" ON public.saved_spots;
CREATE POLICY "saved_spots_select_own"
  ON public.saved_spots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_spots_insert_own" ON public.saved_spots;
CREATE POLICY "saved_spots_insert_own"
  ON public.saved_spots FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_spots_delete_own" ON public.saved_spots;
CREATE POLICY "saved_spots_delete_own"
  ON public.saved_spots FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.logbook_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 120),
  water_body text,
  trip_date date NOT NULL DEFAULT current_date,
  weather text,
  species text,
  catches_count integer NOT NULL DEFAULT 0 CHECK (catches_count >= 0),
  notes text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logbook_trip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.logbook_trips(id) ON DELETE CASCADE,
  storage_path text,
  photo_url text,
  caption text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (storage_path IS NOT NULL OR photo_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS logbook_trips_user_date_idx ON public.logbook_trips (user_id, trip_date DESC);
CREATE INDEX IF NOT EXISTS logbook_trip_photos_trip_idx ON public.logbook_trip_photos (trip_id, position);

CREATE OR REPLACE FUNCTION public.touched_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.touched_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touched_updated_at() TO service_role;

DROP TRIGGER IF EXISTS logbook_trips_touch_updated_at ON public.logbook_trips;
CREATE TRIGGER logbook_trips_touch_updated_at
  BEFORE UPDATE ON public.logbook_trips
  FOR EACH ROW EXECUTE FUNCTION public.touched_updated_at();

ALTER TABLE public.logbook_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook_trip_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.logbook_trips, public.logbook_trip_photos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.logbook_trips, public.logbook_trip_photos TO authenticated;

DROP POLICY IF EXISTS "logbook trips are owner-only" ON public.logbook_trips;
DROP POLICY IF EXISTS "logbook_trips_owner" ON public.logbook_trips;
CREATE POLICY "logbook_trips_owner"
  ON public.logbook_trips FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "logbook photos follow trip owner" ON public.logbook_trip_photos;
CREATE POLICY "logbook photos follow trip owner"
  ON public.logbook_trip_photos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.logbook_trips t
      WHERE t.id = logbook_trip_photos.trip_id
        AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.logbook_trips t
      WHERE t.id = logbook_trip_photos.trip_id
        AND t.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.rum_field_vitals (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  route text NOT NULL,
  device_class text NOT NULL CHECK (device_class IN ('mobile', 'desktop')),
  viewport_width integer NOT NULL CHECK (viewport_width BETWEEN 1 AND 4000),
  connection_type text,
  fcp_ms numeric,
  lcp_ms numeric,
  inp_ms numeric,
  cls numeric,
  ttfb_ms numeric,
  CONSTRAINT rum_route_length CHECK (char_length(route) BETWEEN 1 AND 512),
  CONSTRAINT rum_connection_length CHECK (connection_type IS NULL OR char_length(connection_type) <= 32),
  CONSTRAINT rum_metric_range CHECK (
    (fcp_ms IS NULL OR fcp_ms BETWEEN 0 AND 120000) AND
    (lcp_ms IS NULL OR lcp_ms BETWEEN 0 AND 120000) AND
    (inp_ms IS NULL OR inp_ms BETWEEN 0 AND 120000) AND
    (cls IS NULL OR cls BETWEEN 0 AND 10) AND
    (ttfb_ms IS NULL OR ttfb_ms BETWEEN 0 AND 120000)
  )
);

CREATE INDEX IF NOT EXISTS rum_field_vitals_created_route_idx
  ON public.rum_field_vitals (created_at DESC, route);

ALTER TABLE public.rum_field_vitals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rum_field_vitals FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.rum_field_vitals TO service_role;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_audit_log FROM anon;
GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO authenticated;

DROP POLICY IF EXISTS "admin_audit_log_select_admin" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_select_admin"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_audit_log_insert_admin" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_insert_admin"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================================
-- 6. GAMIFICATION, ALERTS, PREDICTIONS, SNAPSHOTS, AND PRIVATE PHOTO BUCKETS
-- ============================================================================
INSERT INTO public.achievements (id, title, description, xp_reward, criteria, icon_url)
VALUES ('first_catch', 'First Catch', 'Log your first catch.', 50, '{"species": "*", "count": 1}'::jsonb, null)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_read_public" ON public.achievements;
DROP POLICY IF EXISTS "achievements_read_authenticated" ON public.achievements;
CREATE POLICY "achievements_read_authenticated"
  ON public.achievements FOR SELECT TO authenticated
  USING (true);
REVOKE ALL ON TABLE public.achievements FROM anon;
GRANT SELECT ON TABLE public.achievements TO authenticated;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "badges_insert_own" ON public.user_badges;
DROP POLICY IF EXISTS "badges_read_own" ON public.user_badges;
CREATE POLICY "badges_read_own"
  ON public.user_badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE ALL ON TABLE public.user_badges FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_badges FROM authenticated;
GRANT SELECT ON TABLE public.user_badges TO authenticated;

ALTER TABLE public.realtime_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_read_public" ON public.realtime_alerts;
DROP POLICY IF EXISTS "alerts_read_authenticated" ON public.realtime_alerts;
DROP POLICY IF EXISTS "alerts_admin_all" ON public.realtime_alerts;
CREATE POLICY "alerts_read_authenticated"
  ON public.realtime_alerts FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "alerts_admin_all"
  ON public.realtime_alerts FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
REVOKE ALL ON TABLE public.realtime_alerts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.realtime_alerts TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.spot_ai_predictions') IS NOT NULL THEN
    ALTER TABLE public.spot_ai_predictions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "spot_ai_predictions_read_public" ON public.spot_ai_predictions;
    DROP POLICY IF EXISTS "spot_ai_predictions_read_authenticated" ON public.spot_ai_predictions;
    CREATE POLICY "spot_ai_predictions_read_authenticated"
      ON public.spot_ai_predictions FOR SELECT TO authenticated
      USING (true);
    REVOKE ALL ON TABLE public.spot_ai_predictions FROM anon;
    GRANT SELECT ON TABLE public.spot_ai_predictions TO authenticated, service_role;
  END IF;
END $$;

ALTER TABLE public.environmental_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.environmental_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.environmental_snapshots TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('catch-photos', 'catch-photos', false),
  ('logbook-photos', 'logbook-photos', false)
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

DROP POLICY IF EXISTS "logbook_photos_select_own" ON storage.objects;
CREATE POLICY "logbook_photos_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'logbook-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "logbook_photos_insert_own" ON storage.objects;
CREATE POLICY "logbook_photos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logbook-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "logbook_photos_delete_own" ON storage.objects;
CREATE POLICY "logbook_photos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logbook-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
