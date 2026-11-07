CREATE TABLE water_body_labels (
  osm_id BIGINT PRIMARY KEY,
  name TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  water_type TEXT,
  raw_tags JSONB NOT NULL,
  access_status TEXT NOT NULL CHECK (access_status IN ('PUBLIC','PRIVATE','UNKNOWN')),
  ai_confidence INTEGER NOT NULL DEFAULT 0 CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
  ai_reasoning TEXT NOT NULL DEFAULT '',
  last_verified TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE water_body_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to water body labels" ON water_body_labels FOR SELECT USING (true);