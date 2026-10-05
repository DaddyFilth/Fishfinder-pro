-- Require an authenticated Supabase session for analysis inputs and app data.
-- service_role remains available to server-side ingestion and provider caches.

ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spots_select_all" ON public.spots;
CREATE POLICY "spots_select_authenticated"
  ON public.spots FOR SELECT
  TO authenticated
  USING (true);
REVOKE ALL ON public.spots FROM anon;
GRANT SELECT ON public.spots TO authenticated, service_role;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements_read_public" ON public.achievements;
CREATE POLICY "achievements_read_authenticated"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (true);
REVOKE ALL ON public.achievements FROM anon;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_badges FROM anon;

ALTER TABLE public.realtime_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alerts_read_public" ON public.realtime_alerts;
CREATE POLICY "alerts_read_authenticated"
  ON public.realtime_alerts FOR SELECT
  TO authenticated
  USING (true);
REVOKE ALL ON public.realtime_alerts FROM anon;

ALTER TABLE public.community_map_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_spot_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_map_pins, public.community_spot_submissions, public.catches, public.environmental_snapshots FROM anon;

-- Profiles are identity data; anonymous clients must not be able to query it.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM anon;

-- Analysis routes use authenticated server clients; no public table access is needed.
COMMENT ON TABLE public.environmental_snapshots IS 'Server-side provider cache; not exposed to anonymous or authenticated Data API clients.';
