export const DEFAULT_SEAMCAST_SPOTS_URL = 'https://seamcast-spots.vercel.app/api/spots';
export const SECONDARY_SEAMCAST_SPOTS_URL = 'https://seamcast-api.vercel.app/api/spots';

/** Resolves the seamcast-spots API endpoint (SPOTS_API, NEXT_PUBLIC_SPOTS_API_URL base, or default). */
export function getSeamcastSpotsUrl(): string {
  const full = process.env.SPOTS_API?.trim();
  if (full) return full;
  const base = process.env.NEXT_PUBLIC_SPOTS_API_URL?.trim().replace(/\/+$/, '');
  return base ? `${base}/api/spots` : DEFAULT_SEAMCAST_SPOTS_URL;
}

/** Primary endpoint followed by the seamcast-api.vercel.app fallback (deduplicated). */
export function getSeamcastSpotsUrls(): string[] {
  return Array.from(new Set([getSeamcastSpotsUrl(), SECONDARY_SEAMCAST_SPOTS_URL]));
}

/** Fetches the spots feed from each endpoint in order, returning the first OK response (or null). */
export async function fetchSeamcastResponse(params: URLSearchParams, init?: RequestInit): Promise<Response | null> {
  for (const base of getSeamcastSpotsUrls()) {
    try {
      const url = new URL(base);
      params.forEach((v, k) => url.searchParams.set(k, v));
      const res = await fetch(url.toString(), init);
      if (res.ok) return res;
    } catch {
      // try next endpoint
    }
  }
  return null;
}

export async function fetchSeamcastAiSpots(lat: number, lon: number) {
  let lastError: unknown = new Error('Spots API failed');
  for (const base of getSeamcastSpotsUrls()) {
    try {
      const res = await fetch(`${base}?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(`Spots API failed: ${res.status}`);
      const payload = await res.json();
      if (!payload || typeof payload !== 'object') throw new Error('Invalid live spots payload');
      return payload;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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
  for (const base of getSeamcastSpotsUrls()) {
    try {
      const res = await fetch(`${base}?lat=${lat}&lon=${lon}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const parsed = (await res.json()) as SeamcastSpotsFeed;
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // try next endpoint
    }
  }
  return null;
}
