import { fetchSpotConditions } from './conditionsClient';
import { DEFAULT_SPOTS } from './defaultSpots';
import { deriveFishingCondition, type FishingCondition } from './speciesCatalog';

/**
 * Finds a real FishingCondition for a location by asking the conditions
 * provider about its nearest catalog spots. Returns null when no live
 * reading is available anywhere nearby; never invents a condition.
 */
export async function nearestLiveCondition(coordinates: { latitude: number; longitude: number }, maxCandidates = 3): Promise<FishingCondition | null> {
  const nearest = DEFAULT_SPOTS
    .map((spot) => ({ spot, distance: Math.hypot(spot.lat - coordinates.latitude, spot.lng - coordinates.longitude) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(1, maxCandidates));

  for (const { spot } of nearest) {
    const result = await fetchSpotConditions({
      id: spot.id,
      lat: spot.lat,
      lng: spot.lng,
      water_type: spot.water_type,
    });
    if (!result.ok || result.data.data_mode === 'fallback') continue;
    const condition = deriveFishingCondition(result.data as { wind_speed_ms?: number | null; pressure_hpa?: number | null; water_temp_c?: number | null });
    if (condition) return condition;
  }
  return null;
}
