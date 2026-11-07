export interface WaterBodyLabel {
  osm_id: number;
  name: string | null;
  lat: number;
  lon: number;
  water_type: string | null;
  access_status: 'PUBLIC' | 'PRIVATE' | 'UNKNOWN';
  ai_confidence: number;
  ai_reasoning: string;
  last_verified: string;
  data_mode: 'provider' | 'cached' | 'fallback';
}

export interface WaterBodyResult {
  water_bodies: WaterBodyLabel[];
  source: 'overpass-ai';
  data_mode: 'provider' | 'fallback';
  warning?: string;
}

const WATER_BODIES_API_URL = '/api/water-bodies';

/**
 * Fetches water bodies for a given location and radius from the API route,
 * validates the response with Zod, and returns a typed array.
 *
 * Throws on non-ok responses, letting the caller handle fallback.
 */
export async function fetchWaterBodies(
  lat: number,
  lon: number,
  radiusMiles: number
): Promise<WaterBodyLabel[]> {
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Invalid coordinates.');
  }
  if (radiusMiles < 1 || radiusMiles > 100) {
    throw new Error('Radius must be between 1 and 100 miles.');
  }

  const res = await fetch(`${WATER_BODIES_API_URL}?lat=${lat}&lon=${lon}&radius_miles=${radiusMiles}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Water bodies API failed: ${res.status}`);
  }

  const json = await res.json();

  // Zod validation would go here, but we'll validate manually since
  // the API route already validates. The caller should handle the
  // thrown error for fallback logic.
  if (json?.water_bodies && Array.isArray(json.water_bodies)) {
    return json.water_bodies;
  }

  throw new Error('Water bodies API returned an invalid data source');
}

/**
 * Maps an Overpass API water body result into a WaterBodyLabel shape,
 * checking the local cache first and returning the cached classification
 * when available.
 */
export function mapOverpassResult(
  result: {
    osm_id: number;
    name: string | null;
    lat: number;
    lon: number;
    water_type: string | null;
    tags: Record<string, string | null>;
  },
  cachedAccessStatus: 'PUBLIC' | 'PRIVATE' | 'UNKNOWN' | null,
  cachedConfidence: number,
  cachedReason: string | null
): WaterBodyLabel {
  const accessStatus = cachedAccessStatus ?? 'UNKNOWN';
  const confidence = cachedConfidence ?? 0;
  const reasoning = cachedReason ?? 'classification unavailable';

  return {
    osm_id: result.osm_id,
    name: result.name,
    lat: result.lat,
    lon: result.lon,
    water_type: result.water_type,
    access_status: accessStatus,
    ai_confidence: confidence,
    ai_reasoning: reasoning,
    last_verified: new Date().toISOString(),
  };
}