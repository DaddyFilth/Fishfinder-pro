-- Migration: 20261002_security_hardening.sql

-- 1. SECURE SPOTS
-- Spots are canonical provider data. Anglers should only be able to view them.
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spots_select_all" ON public.spots;
CREATE POLICY "spots_select_all" 
  ON public.spots FOR SELECT 
  TO authenticated 
  USING (true);

-- 2. TIGHTEN BADGES
-- Users should NOT be able to insert their own badges. 
-- Only a secure server-side process (service_role) should grant them.
DROP POLICY IF EXISTS "badges_insert_own" ON public.user_badges;
-- We only keep SELECT for the owner.
-- Note: INSERT is not explicitly granted to 'authenticated', so it's blocked by default.

-- 3. SECURE COMMUNITY SUBMISSIONS
-- Ensure users cannot change the status of their own submission to 'approved'.
DROP POLICY IF EXISTS "community_spot_submissions_owner" ON public.community_spot_submissions;
CREATE POLICY "community_spot_submissions_view_own" 
  ON public.community_spot_submissions FOR SELECT 
  TO authenticated 
  USING (auth.uid() = submitted_by);

CREATE POLICY "community_spot_submissions_insert_own" 
  ON public.community_spot_submissions FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

-- Admins can manage submissions
CREATE POLICY "community_spot_submissions_admin_all" 
  ON public.community_spot_submissions FOR ALL 
  TO authenticated 
  USING (public.is_admin());

-- 4. PROTECT REALTIME ALERTS
-- Ensure only admins can create/update alerts.
DROP POLICY IF EXISTS "alerts_read_public" ON public.realtime_alerts;
CREATE POLICY "alerts_read_public" 
  ON public.realtime_alerts FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "alerts_admin_all" 
  ON public.realtime_alerts FOR ALL 
  TO authenticated 
  USING (public.is_admin());
