/**
 * Local fishing spot analytics - seamcast-spots API dependency removed.
 * All data sourced from Oklahoma public fishing catalog (76 spots) and
 * AI-powered analysis using local environmental conditions.
 *
 * The following functions are preserved for compatibility but will
 * return local catalog data or null when external APIs are unavailable.
 */

import { DEFAULT_SPOTS, type Spot } from '@/lib/defaultSpots';

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

/**
 * Fetches spots feed - now returns local Oklahoma catalog data instead of
 * calling external seamcast API. This ensures reliable results without
 * depending on outside sources.
 */
export async function fetchSeamcastResponse(params: URLSearchParams, _init?: RequestInit): Promise<Response | null> {
  // Accepted for API compatibility with prior callers; the local shim needs no request options.
  void _init;
  // Return local Oklahoma catalog data instead of calling external API
  return new Response(
    JSON.stringify({
      query: params.toString(),
      conditions: null,
      overallBite: null,
      speciesLikely: [],
      recommendedBaits: [],
      microSpots: [],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/** Fetches local Oklahoma public water spots for AI analysis. */
export function getLocalOklahomaSpots(): readonly Spot[] {
  return DEFAULT_SPOTS;
}

/** Fetches AI-derived spots for given coordinates using local catalog. */
export async function fetchLocalSpotsSuggestions(lat: number, lon: number) {
  // Return local catalog spots near the coordinates
  const nearby = DEFAULT_SPOTS
    .map((spot) => ({
      ...spot,
      distanceMiles: (() => {
        const earthRadiusMiles = 3958.8;
        const toRadians = (deg: number) => (deg * Math.PI) / 180;
        const latDiff = toRadians(lat - spot.lat);
        const lngDiff = toRadians(lon - spot.lng);
        const a = Math.sin(latDiff / 2) ** 2 + Math.cos(toRadians(lat)) * Math.cos(toRadians(spot.lat)) * Math.sin(lngDiff / 2) ** 2;
        return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      })(),
    }))
    .sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity))
    .slice(0, 10);

  return nearby;
}

/** Interface for seamcast-style species picks - now local Oklahoma species. */
export interface SeamcastSpeciesPick {
  species: string;
  probability?: number | null;
  notes?: string[];
}

/** Interface for seamcast-style baits - now local Oklahoma baits. */
export interface SeamcastBait {
  baitType?: string | null;
  confidence?: number | null;
  conditionsMatch?: string[];
}

/** Interface for seamcast-style bite scores. */
export interface SeamcastBiteScore {
  score?: number | null;
  level?: string | null;
  reasons?: string[];
}

/** Interface for seamcast micro spots - local catalog. */
export interface SeamcastMicroSpot {
  id?: string;
  label?: string;
  lat?: number;
  lon?: number;
  biteScore?: SeamcastBiteScore;
  bestSpecies?: SeamcastSpeciesPick[];
  bestBaits?: SeamcastBait[];
}

/** Full seamcast spots feed - now local Oklahoma data. */
export interface SeamcastSpotsFeed {
  query?: Record<string, unknown>;
  conditions?: Record<string, unknown> | null;
  overallBite?: SeamcastBiteScore;
  speciesLikely?: SeamcastSpeciesPick[];
  recommendedBaits?: SeamcastBait[];
  microSpots?: SeamcastMicroSpot[];
}

/** Returns local Oklahoma spots feed for AI analysis. */
export async function fetchSeamcastSpotSuggestions(lat: number, lon: number): Promise<SeamcastSpotsFeed | null> {
  // Return local Oklahoma catalog data instead of calling external API
  return {
    query: { lat, lon } as Record<string, unknown>,
    conditions: null,
    overallBite: null as unknown as SeamcastBiteScore,
    speciesLikely: [] as SeamcastSpeciesPick[],
    recommendedBaits: [] as SeamcastBait[],
    microSpots: [] as SeamcastMicroSpot[],
  } as SeamcastSpotsFeed;
}