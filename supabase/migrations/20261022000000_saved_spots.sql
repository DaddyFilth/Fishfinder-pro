-- Saved spots per user (bookmarks). Idempotent for preview replay.
CREATE TABLE IF NOT EXISTS public.saved_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spot_id)
);

CREATE INDEX IF NOT EXISTS saved_spots_user_id_idx ON public.saved_spots (user_id);

ALTER TABLE public.saved_spots ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT, DELETE ON public.saved_spots TO authenticated;