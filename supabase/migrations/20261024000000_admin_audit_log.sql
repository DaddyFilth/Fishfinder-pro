CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_log_select_admin" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_select_admin"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admin_audit_log_insert_admin" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_insert_admin"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;