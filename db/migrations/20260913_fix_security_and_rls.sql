-- Migration: 20260913_fix_security_and_rls.sql
-- Description: Resolve Supabase Security Advisor and Database Linter findings
-- 1. Add primary key to private.fishing_spots_seed (if table exists)
-- 2. Consolidate and deduplicate RLS policies across public tables
-- 3. Ensure Row-Level Security is strictly enabled on all tables

-- ============================================================================
-- 1. Primary Key for private.fishing_spots_seed
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'private' AND table_name = 'fishing_spots_seed'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'private' 
        AND table_name = 'fishing_spots_seed' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE private.fishing_spots_seed 
      ADD COLUMN IF NOT EXISTS id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 2. Profiles Table: Clean RLS Policies
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    -- Drop legacy / duplicate policies
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

    -- Create single consolidated policies
    CREATE POLICY "profiles_select_public"
      ON public.profiles FOR SELECT
      USING (true);

    CREATE POLICY "profiles_insert_own"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);

    CREATE POLICY "profiles_update_own"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ============================================================================
-- 3. Catches Table: Clean RLS Policies
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catches') THEN
    ALTER TABLE public.catches ENABLE ROW LEVEL SECURITY;

    -- Drop legacy / duplicate policies
    DROP POLICY IF EXISTS "Catches are viewable by everyone" ON public.catches;
    DROP POLICY IF EXISTS "Users can view all catches" ON public.catches;
    DROP POLICY IF EXISTS "Users can view own catches" ON public.catches;
    DROP POLICY IF EXISTS "Users can insert own catches" ON public.catches;
    DROP POLICY IF EXISTS "Users can update own catches" ON public.catches;
    DROP POLICY IF EXISTS "Users can delete own catches" ON public.catches;
    DROP POLICY IF EXISTS "catches_select_all" ON public.catches;
    DROP POLICY IF EXISTS "catches_insert_own" ON public.catches;
    DROP POLICY IF EXISTS "catches_update_own" ON public.catches;
    DROP POLICY IF EXISTS "catches_delete_own" ON public.catches;

    -- Create consolidated policies
    CREATE POLICY "catches_select_policy"
      ON public.catches FOR SELECT
      USING (
        is_public = true 
        OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
      );

    CREATE POLICY "catches_insert_policy"
      ON public.catches FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "catches_update_policy"
      ON public.catches FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "catches_delete_policy"
      ON public.catches FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 4. Community Pins Table: Clean RLS Policies
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'community_pins') THEN
    ALTER TABLE public.community_pins ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Community pins are viewable by everyone" ON public.community_pins;
    DROP POLICY IF EXISTS "Users can view community pins" ON public.community_pins;
    DROP POLICY IF EXISTS "Users can insert community pins" ON public.community_pins;
    DROP POLICY IF EXISTS "Users can update own community pins" ON public.community_pins;
    DROP POLICY IF EXISTS "Users can delete own community pins" ON public.community_pins;
    DROP POLICY IF EXISTS "community_pins_select" ON public.community_pins;
    DROP POLICY IF EXISTS "community_pins_insert" ON public.community_pins;
    DROP POLICY IF EXISTS "community_pins_update" ON public.community_pins;
    DROP POLICY IF EXISTS "community_pins_delete" ON public.community_pins;

    CREATE POLICY "community_pins_select"
      ON public.community_pins FOR SELECT
      USING (true);

    CREATE POLICY "community_pins_insert"
      ON public.community_pins FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);

    CREATE POLICY "community_pins_update"
      ON public.community_pins FOR UPDATE
      USING (auth.uid() = created_by)
      WITH CHECK (auth.uid() = created_by);

    CREATE POLICY "community_pins_delete"
      ON public.community_pins FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- ============================================================================
-- 5. Environmental Snapshots: Clean RLS Policies
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'environmental_snapshots') THEN
    ALTER TABLE public.environmental_snapshots ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "environmental_snapshots_read_public" ON public.environmental_snapshots;
    DROP POLICY IF EXISTS "environmental_snapshots_write_service" ON public.environmental_snapshots;
    DROP POLICY IF EXISTS "Anyone can view snapshots" ON public.environmental_snapshots;

    CREATE POLICY "environmental_snapshots_read_public"
      ON public.environmental_snapshots FOR SELECT
      USING (true);
  END IF;
END $$;
