export type SpotFilter = 'all' | 'freshwater' | 'lake' | 'reservoir' | 'river';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type: string;
  spot_type: string;
}

export function filterSpots(spots: Spot[], filter: SpotFilter | string) {
  const normalizedFilter = filter.toLowerCase().trim();

  if (normalizedFilter === 'all') return spots;

  return spots.filter((spot) => {
    const waterType = String(spot.water_type ?? '').toLowerCase().trim();
    const spotType = String(spot.spot_type ?? '').toLowerCase().trim();

    return waterType === normalizedFilter || spotType === normalizedFilter;
  });
}

export function rankSpots(spots: Spot[], conditionScores: Record<string, number>) {
  return spots
    .map((spot) => ({ spot, score: conditionScores[spot.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);
}
