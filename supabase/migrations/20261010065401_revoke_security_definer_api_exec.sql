-- Reconstructed from the deployed schema on project dkafqgapepebzjtoghos.
--
-- Applied straight to the remote database with no file in the repo; see
-- 20260924043802_create_environmental_snapshots_for_api.sql for the full
-- explanation of the resulting "Remote migration versions not found" failure.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so every
-- SECURITY DEFINER helper was callable by anon and authenticated straight from
-- PostgREST. These helpers run with the definer's rights, so the default grant
-- let any client bypass the RLS policies the table grants are meant to enforce.
-- Callers are the server routes and the policies themselves, both of which use
-- the service role, so restricting EXECUTE to service_role costs nothing.

-- spots_near walks the spots geometry and is only ever called from server code.
REVOKE ALL ON FUNCTION public.spots_near(double precision, double precision, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spots_near(double precision, double precision, integer)
  TO service_role;

-- prevent_profile_role_escalation is a trigger body; nothing should call it directly.
REVOKE ALL ON FUNCTION public.prevent_profile_role_escalation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_profile_role_escalation()
  TO service_role;

-- rls_auto_enable is an event-trigger body; nothing should call it directly.
REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable()
  TO service_role;

-- is_admin is deliberately left executable by authenticated: the profiles and
-- admin RLS policies call it as the invoking role, so revoking it would break
-- every policy that references it. It is SECURITY DEFINER but only ever returns
-- a boolean about the caller, and its search_path is pinned.
REVOKE ALL ON FUNCTION public.is_admin()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()
  TO authenticated, service_role;
