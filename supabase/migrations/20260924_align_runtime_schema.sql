-- Align the checked-in application routes with the deployed Supabase schema.
-- This migration is additive and safe to run more than once.

-- The map and condition routes use public.spots as their canonical table.
CREATE TABLE IF NOT EXISTS public.spots (
  id text PRIMARY KEY,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  water_type text DEFAULT 'freshwater',
  spot_type text DEFAULT 'lake',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spots
  ADD COLUMN IF NOT EXISTS usgs_site_id text,
  ADD COLUMN IF NOT EXISTS noaa_station_id text,
  ADD COLUMN IF NOT EXISTS access_type text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.community_map_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  known_spot_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_type text NOT NULL CHECK (pin_type IN ('structure', 'hazard', 'ramp', 'shore_access', 'tip')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  source_url text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_map_pins_known_spot_idx
  ON public.community_map_pins (known_spot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_spot_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  water_type text NOT NULL,
  spot_type text NOT NULL,
  access_type text NOT NULL,
  region text NOT NULL,
  notes text NOT NULL DEFAULT '',
  access_confirmation boolean NOT NULL DEFAULT false,
  source_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_spot_submissions_user_idx
  ON public.community_spot_submissions (submitted_by, created_at DESC);

ALTER TABLE public.community_map_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_spot_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_map_pins_select" ON public.community_map_pins;
DROP POLICY IF EXISTS "community_map_pins_insert" ON public.community_map_pins;
DROP POLICY IF EXISTS "community_map_pins_update" ON public.community_map_pins;
DROP POLICY IF EXISTS "community_map_pins_delete" ON public.community_map_pins;
CREATE POLICY "community_map_pins_select" ON public.community_map_pins
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_map_pins_insert" ON public.community_map_pins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_map_pins_update" ON public.community_map_pins
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "community_map_pins_delete" ON public.community_map_pins
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "community_spot_submissions_owner" ON public.community_spot_submissions;
CREATE POLICY "community_spot_submissions_owner" ON public.community_spot_submissions
  FOR ALL TO authenticated USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);

-- CatchLogger writes these fields. Existing deployments may have the older
-- public-catch defaults, so make newly created catches private by default.
CREATE TABLE IF NOT EXISTS public.catches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id text,
  species text NOT NULL,
  weight_lbs numeric,
  length_in numeric,
  photo_url text,
  notes text,
  latitude double precision,
  longitude double precision,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS bait text,
  ADD COLUMN IF NOT EXISTS spot_name text;
ALTER TABLE public.catches DROP CONSTRAINT IF EXISTS catches_spot_id_fkey;
ALTER TABLE public.catches ALTER COLUMN is_public SET DEFAULT false;
DROP POLICY IF EXISTS "catches_select_policy" ON public.catches;
DROP POLICY IF EXISTS "catches_insert_policy" ON public.catches;
DROP POLICY IF EXISTS "catches_update_policy" ON public.catches;
DROP POLICY IF EXISTS "catches_delete_policy" ON public.catches;
CREATE POLICY "catches_select_policy" ON public.catches
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "catches_insert_policy" ON public.catches
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "catches_update_policy" ON public.catches
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "catches_delete_policy" ON public.catches
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Profiles are not needed anonymously by the current app. Admins still need
-- to enumerate accounts for role management.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

-- Environmental snapshots are a service-role cache. The public water-heatmap
-- route uses the service-role client, so do not expose cache rows directly.
CREATE TABLE IF NOT EXISTS public.environmental_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spot_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  air_temp_c numeric,
  wind_speed_ms numeric,
  water_temp_c numeric,
  water_level_m numeric,
  flow_rate_cfs numeric,
  dissolved_oxygen_mgl numeric,
  wave_height_m numeric,
  wave_period_s numeric,
  swell_direction_deg numeric,
  tide_height_m numeric,
  fishing_score numeric,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_mode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS environmental_snapshots_spot_captured_at_idx
  ON public.environmental_snapshots (spot_id, captured_at DESC);
ALTER TABLE public.environmental_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "environmental_snapshots_read_public" ON public.environmental_snapshots;
REVOKE ALL ON public.environmental_snapshots FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.environmental_snapshots TO service_role;
