-- ============================================================================
-- FISHFINDER PRO - UNIFIED SUPABASE SCHEMA
-- Project Reference: ediqyixbyqrojvgktxky
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Linked to auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  role text DEFAULT 'angler' CHECK (role IN ('angler', 'user', 'admin', 'moderator')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Keep the deployed table compatible with the app's role names while accepting
-- the legacy `user` value during migration.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('angler', 'user', 'admin', 'moderator'));
UPDATE public.profiles SET role = 'angler' WHERE role = 'user';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Automatically create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. SPOTS TABLE (Oklahoma lakes, rivers, reservoirs, boat ramps)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.spots (
  id text PRIMARY KEY,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  water_type text DEFAULT 'freshwater',
  spot_type text DEFAULT 'lake',
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spots_coordinates ON public.spots (lat, lng);
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spots_read_public" ON public.spots;
CREATE POLICY "spots_read_public"
  ON public.spots FOR SELECT
  USING (true);

-- ============================================================================
-- 3. CATCHES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.catches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  spot_id text REFERENCES public.spots(id) ON DELETE SET NULL,
  species text NOT NULL,
  weight_lbs numeric CHECK (weight_lbs >= 0),
  length_in numeric CHECK (length_in >= 0),
  photo_url text,
  notes text,
  latitude double precision,
  longitude double precision,
  is_public boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_catches_user_id ON public.catches (user_id);
CREATE INDEX IF NOT EXISTS idx_catches_created_at ON public.catches (created_at DESC);
ALTER TABLE public.catches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catches_select_policy" ON public.catches;
CREATE POLICY "catches_select_policy"
  ON public.catches FOR SELECT
  USING (is_public = true OR (auth.uid() IS NOT NULL AND auth.uid() = user_id));

DROP POLICY IF EXISTS "catches_insert_policy" ON public.catches;
CREATE POLICY "catches_insert_policy"
  ON public.catches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "catches_update_policy" ON public.catches;
CREATE POLICY "catches_update_policy"
  ON public.catches FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "catches_delete_policy" ON public.catches;
CREATE POLICY "catches_delete_policy"
  ON public.catches FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. COMMUNITY PINS TABLE (Bite reports, hazards, ramps)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  pin_type text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  description text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_pins_coords ON public.community_pins (latitude, longitude);
ALTER TABLE public.community_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_pins_select" ON public.community_pins;
CREATE POLICY "community_pins_select"
  ON public.community_pins FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "community_pins_insert" ON public.community_pins;
CREATE POLICY "community_pins_insert"
  ON public.community_pins FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

DROP POLICY IF EXISTS "community_pins_update" ON public.community_pins;
CREATE POLICY "community_pins_update"
  ON public.community_pins FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "community_pins_delete" ON public.community_pins;
CREATE POLICY "community_pins_delete"
  ON public.community_pins FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================================================
-- 5. LOGBOOK TRIPS & TRIP PHOTOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.logbook_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  water_body text,
  trip_date date DEFAULT current_date NOT NULL,
  weather text,
  species text,
  catches_count integer DEFAULT 0 CHECK (catches_count >= 0) NOT NULL,
  notes text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logbook_trips_user_date ON public.logbook_trips (user_id, trip_date DESC);
ALTER TABLE public.logbook_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logbook_trips_owner_all" ON public.logbook_trips;
CREATE POLICY "logbook_trips_owner_all"
  ON public.logbook_trips FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.logbook_trip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.logbook_trips(id) ON DELETE CASCADE NOT NULL,
  storage_path text,
  photo_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logbook_photos_trip ON public.logbook_trip_photos (trip_id);
ALTER TABLE public.logbook_trip_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logbook_photos_owner_all" ON public.logbook_trip_photos;
CREATE POLICY "logbook_photos_owner_all"
  ON public.logbook_trip_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.logbook_trips
      WHERE logbook_trips.id = logbook_trip_photos.trip_id
        AND logbook_trips.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.logbook_trips
      WHERE logbook_trips.id = logbook_trip_photos.trip_id
        AND logbook_trips.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. ENVIRONMENTAL SNAPSHOTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.environmental_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  spot_id text NOT NULL,
  captured_at timestamptz DEFAULT now() NOT NULL,
  air_temp_c numeric,
  wind_speed_ms numeric,
  water_temp_c numeric,
  raw_data jsonb
);

CREATE INDEX IF NOT EXISTS idx_snapshots_spot_time ON public.environmental_snapshots (spot_id, captured_at DESC);
ALTER TABLE public.environmental_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "environmental_snapshots_read_public" ON public.environmental_snapshots;
CREATE POLICY "environmental_snapshots_read_public"
  ON public.environmental_snapshots FOR SELECT
  USING (true);

-- ============================================================================
-- 7. SEED / STAGING TABLE (Private Schema)
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.fishing_spots_seed (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  water_type text,
  spot_type text,
  description text,
  seeded_at timestamptz DEFAULT now() NOT NULL
);
