export type SpotFilter = 'all' | 'freshwater' | 'lake' | 'reservoir' | 'river';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type: string;
  spot_type: string;
}

export function filterSpots(spots: Spot[], filter: SpotFilter) {
  if (filter === 'all') return spots;
  return spots.filter((spot) => spot.water_type === filter || spot.spot_type === filter);
}

export function rankSpots(spots: Spot[], conditionScores: Record<string, number>) {
  return spots
    .map((spot) => ({ spot, score: conditionScores[spot.id] ?? 0 }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);
}
