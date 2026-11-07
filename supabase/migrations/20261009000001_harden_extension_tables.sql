-- SECURITY DEFINER helpers that do not need Data API exposure.
-- Applied successfully as the project postgres role.
-- is_admin() stays executable by authenticated: admin RLS policies call it.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_role_escalation() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spots_near(double precision, double precision, integer) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.spots_near(double precision, double precision, integer) TO service_role;

-- ============================================================
-- Remaining advisor findings (verified 2026-10-10 as postgres)
-- ============================================================
--
-- 1) ERROR rls_disabled_in_public: public.spatial_ref_sys has no RLS.
--    Owner: supabase_admin. postgres cannot ALTER it.
-- 2) WARN anon_security_definer_function_executable (x3):
--    public.st_estimatedextent(text,text[,text[,boolean]]) is
--    SECURITY DEFINER, owner/grantor supabase_admin.
--    REVOKE as postgres succeeds silently but proacl is unchanged
--    (grantor is supabase_admin; postgres lacks grant option).
--    Confirmed: proacl still contains anon=X/supabase_admin after
--    REVOKE EXECUTE ... FROM anon, authenticated, PUBLIC.
-- 3) WARN authenticated_security_definer_function_executable:
--    public.is_admin() executable by authenticated — INTENTIONAL.
--    Admin RLS policies (profiles, community_spot_submissions,
--    realtime_alerts) call is_admin(); revoking breaks admin reads.
-- 4) WARN extension_in_public: postgis installed in public schema.
--    Moving it would break every postgis-based query and migration;
--    leave as-is (standard Supabase posture).
-- 5) INFO rls_enabled_no_policy: public.environmental_snapshots has
--    RLS enabled, no policies — INTENTIONAL. Service-role-only table
--    (spot conditions snapshot cache); app reads/writes via service
--    client only, so deny-all to anon/authenticated is correct.
-- 6) WARN auth_leaked_password_protection: disabled at project level.
--    Dashboard setting: Auth > Settings > Password protection > "Check
--    for leaked passwords" (HaveIBeenPwned). Enable in dashboard.
--
-- Requires supabase_admin (run via Supabase dashboard SQL editor):
--   REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM PUBLIC, anon, authenticated;
--   REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM PUBLIC, anon, authenticated;
--   REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
--   ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
--   REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
--   -- optionally: REVOKE EXECUTE ... FROM service_role too if unused.
