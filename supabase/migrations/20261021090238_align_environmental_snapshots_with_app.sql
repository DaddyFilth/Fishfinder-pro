-- Align environmental_snapshots with what the application actually reads and writes.
--
-- The deployed table stopped at the early provider-cache shape (11 columns) while
-- the app evolved: /api/feed/cloudflare inserts wave_height_m, tide_height_m,
-- score_breakdown, data_sources and data_mode; /api/spots/[id]/conditions inserts
-- those plus bite_score, bite_level and ai_micro_spots on every cached reading.
-- Against the old shape every insert failed ("column ... does not exist"), so the
-- feed endpoint returned 502, snapshot caching never succeeded, and the stored
-- snapshot fallback for provider outages could never trigger.
--
-- Additive only: no existing column, index, grant or row is touched, so the
-- migration is safe to replay and safe on a populated table.

ALTER TABLE public.environmental_snapshots
  ADD COLUMN IF NOT EXISTS wave_height_m numeric,
  ADD COLUMN IF NOT EXISTS wave_period_s numeric,
  ADD COLUMN IF NOT EXISTS swell_direction_deg numeric,
  ADD COLUMN IF NOT EXISTS tide_height_m numeric,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS data_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_mode text,
  ADD COLUMN IF NOT EXISTS bite_score numeric,
  ADD COLUMN IF NOT EXISTS bite_level text,
  ADD COLUMN IF NOT EXISTS ai_micro_spots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Newest-first history reads (smart analytics) scan by capture time across all
-- spots; the per-spot index does not cover that ordering.
CREATE INDEX IF NOT EXISTS environmental_snapshots_captured_at_idx
  ON public.environmental_snapshots (captured_at DESC);

-- Reads and writes stay server-side only, matching the grants already in place.
REVOKE ALL ON public.environmental_snapshots FROM anon;
