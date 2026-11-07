import type { Spot, WaterBodyLabel } from '@/lib/mapFilters';

const SPOTS_CACHE_KEY = 'oklahoma-fishfinder:spots:v1';
const WATER_BODIES_CACHE_KEY = 'oklahoma-fishfinder:water-bodies:v1';

interface CachedSpots {
  spots: Spot[];
  savedAt: string;
}

export interface CachedSpotResult {
  spots: Spot[];
  savedAt: string;
}

interface CachedWaterBodies {
  waterBodies: WaterBodyLabel[];
  savedAt: string;
}

export interface CachedWaterBodyResult {
  waterBodies: WaterBodyLabel[];
  savedAt: string;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readCachedSpots(): CachedSpotResult | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(SPOTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSpots;
    if (!Array.isArray(parsed.spots) || typeof parsed.savedAt !== 'string') return null;
    return { spots: parsed.spots, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

export function cacheSpots(spots: Spot[], savedAt = new Date().toISOString()) {
  if (!canUseStorage() || spots.length === 0) return false;
  try {
    window.localStorage.setItem(SPOTS_CACHE_KEY, JSON.stringify({ spots, savedAt } satisfies CachedSpots));
    return true;
  } catch {
    return false;
  }
}

export function formatCacheAge(savedAt: string | null) {
  if (!savedAt) return null;
  const timestamp = Date.parse(savedAt);
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'} ago`;
}

/** Read the last water bodies response from IndexedDB (localStorage). */
export function readCachedWaterBodies(): CachedWaterBodyResult | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(WATER_BODIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWaterBodies;
    if (
      !Array.isArray(parsed.waterBodies) ||
      typeof parsed.savedAt !== 'string' ||
      !parsed.waterBodies.every(
        (wb) =>
          typeof wb.osm_id === 'number' &&
          typeof wb.lat === 'number' &&
          typeof wb.lon === 'number' &&
          typeof wb.access_status === 'string'
      )
    )
      return null;
    return { waterBodies: parsed.waterBodies, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

/** Cache the water bodies response in IndexedDB (localStorage). */
export function cacheWaterBodies(waterBodies: WaterBodyLabel[], savedAt = new Date().toISOString()) {
  if (!canUseStorage() || waterBodies.length === 0) return false;
  try {
    window.localStorage.setItem(
      WATER_BODIES_CACHE_KEY,
      JSON.stringify({ waterBodies, savedAt } satisfies CachedWaterBodies)
    );
    return true;
  } catch {
    return false;
  }
}
