export async function fetchSeamcastAiSpots(lat: number, lon: number) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SPOTS_API_URL || 'https://seamcast-spots.vercel.app';
  const url = `${baseUrl}/api/spots?lat=${lat}&lon=${lon}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Spots API failed: ${res.status}`);
  }

  const payload = await res.json();
  if (!payload || typeof payload !== 'object') throw new Error('Invalid live spots payload');
  return payload;
}

export interface SeamcastSpeciesPick {
  species: string;
  probability?: number | null;
  notes?: string[];
}

export interface SeamcastBait {
  baitType?: string | null;
  confidence?: number | null;
  conditionsMatch?: string[];
}

export interface SeamcastBiteScore {
  score?: number | null;
  level?: string | null;
  reasons?: string[];
}

export interface SeamcastMicroSpot {
  id?: string;
  label?: string;
  lat?: number;
  lon?: number;
  biteScore?: SeamcastBiteScore;
  bestSpecies?: SeamcastSpeciesPick[];
  bestBaits?: SeamcastBait[];
}

export interface SeamcastSpotsFeed {
  query?: Record<string, unknown>;
  conditions?: Record<string, unknown> | null;
  overallBite?: SeamcastBiteScore;
  speciesLikely?: SeamcastSpeciesPick[];
  recommendedBaits?: SeamcastBait[];
  microSpots?: SeamcastMicroSpot[];
}

/** Raw upstream feed for AI spot predictions; use this for the spot rankings. */
export async function fetchSeamcastSpotSuggestions(lat: number, lon: number): Promise<SeamcastSpotsFeed | null> {
  const baseUrl = process.env.NEXT_PUBLIC_SPOTS_API_URL || 'https://seamcast-spots.vercel.app';
  const url = `${baseUrl}/api/spots?lat=${lat}&lon=${lon}`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const parsed = (await res.json()) as SeamcastSpotsFeed;
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}
