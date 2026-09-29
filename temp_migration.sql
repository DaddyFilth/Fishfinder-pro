 `-- Migration: 20261001_pro_features_foundation.sql

-- 1. GAMIFICATION: Update profiles for XP and Leveling
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS life_list jsonb DEFAULT '[]'::jsonb;

-- 2. GAMIFICATION: Achievements and Badges
CREATE TABLE IF NOT EXISTS public.achievements (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  xp_reward integer DEFAULT 0,
  criteria jsonb NOT NULL, -- e.g., { "species": "Bass", "count": 10 }
  icon_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL REFERENCES public.achievements(id),
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- 3. INTELLIGENCE: Enhance catches with environmental snapshots
ALTER TABLE public.catches 
  ADD COLUMN IF NOT EXISTS weather_snapshot jsonb DEFAULT '{}'::jsonb;

-- 4. INTELLIGENCE: Real-time alerts for the community
CREATE TABLE IF NOT EXISTS public.realtime_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text,
  alert_type text NOT NULL, -- 'pressure_drop', 'flow_peak', 'temp_shift'
  severity text DEFAULT 'info', -- 'info', 'warning', 'critical'
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_alerts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "achievements_read_public" ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "badges_read_own" ON public.user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alerts_read_public" ON public.realtime_alerts FOR SELECT TO authenticated USING (true);
`