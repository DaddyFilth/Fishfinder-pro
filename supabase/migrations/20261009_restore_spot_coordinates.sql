-- The application routes select public.spots.lat/lng/water_type, but the deployed
-- table keeps coordinates in a PostGIS geography column (location, SRID 4326).
-- Restore the canonical columns and backfill them from the geometry so every
-- route (/api/spots, conditions, water-heatmap, community-pins) reads stored spots.
-- Additive and safe to run more than once.

ALTER TABLE public.spots
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS water_type text DEFAULT 'freshwater';

-- WGS84 points: cast geography -> geometry (coordinates are preserved as
-- lon/lat), then ST_Y -> latitude, ST_X -> longitude.
UPDATE public.spots
SET lat = ST_Y(location::geometry),
    lng = ST_X(location::geometry)
WHERE location IS NOT NULL
  AND (lat IS NULL OR lng IS NULL);

UPDATE public.spots
SET water_type = 'freshwater'
WHERE water_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_spots_coordinates
  ON public.spots (lat, lng);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.spots WHERE location IS NULL) THEN
    RAISE EXCEPTION 'public.spots has rows without a location point; populate location before enforcing NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'spots'
      AND column_name IN ('lat', 'lng')
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.spots
      ALTER COLUMN lat SET NOT NULL,
      ALTER COLUMN lng SET NOT NULL;
  END IF;
END $$;
