import { BiteTimesSchema } from '@/lib/aiResponse';
import { z } from 'zod';

export type AiBiteTimes = z.infer<typeof BiteTimesSchema>;

export interface AiBiteTimesRequest {
  species: string;
  lat: number;
  lng: number;
  water_temp_c?: number | null;
  pressure_hpa?: number | null;
  wind_speed_ms?: number | null;
  dissolved_oxygen_mgl?: number | null;
  solunar_score?: number | null;
  moon_phase?: string | null;
}

const cache = new Map<string, { expiresAt: number; value: AiBiteTimes | null }>();
const CACHE_TTL_MS = 5 * 60_000;

function cacheKey(request: AiBiteTimesRequest): string {
  return JSON.stringify([
    request.species,
    request.lat.toFixed(5),
    request.lng.toFixed(5),
    request.water_temp_c ?? null,
    request.pressure_hpa ?? null,
    request.wind_speed_ms ?? null,
    request.dissolved_oxygen_mgl ?? null,
    request.solunar_score ?? null,
    request.moon_phase ?? null,
  ]);
}

export async function fetchAiBiteTimes(request: AiBiteTimesRequest): Promise<AiBiteTimes | null> {
  const key = cacheKey(request);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const response = await fetch('/api/ai/bite-times', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store',
    });
    if (!response.ok) {
      cache.set(key, { expiresAt: Date.now() + 30_000, value: null });
      return null;
    }
    const parsed = BiteTimesSchema.safeParse(await response.json());
    const value = parsed.success ? parsed.data : null;
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch {
    cache.set(key, { expiresAt: Date.now() + 30_000, value: null });
    return null;
  }
}

export function resetAiBiteTimesCache() {
  cache.clear();
}
