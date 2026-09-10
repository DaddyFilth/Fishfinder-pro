export type SpotFilter =
  | 'all'
  | 'freshwater'
  | 'lake'
  | 'reservoir'
  | 'river'
  | 'pfa'
  | 'wma'
  | 'municipal'
  | 'trout'
  | 'boat-ramp'
  | 'fishing-pier'
  | 'public-shore'
  | 'walk-in'
  | 'state-park';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type: string;
  spot_type: string;
  access_type?: string;
  region?: string;
  source?: string;
  notes?: string;
  description?: string;
}

function normalized(value: unknown): string {
  return String(value ?? '').toLowerCase().trim();
}

function searchableSpotText(spot: Spot): string {
  return [
    spot.name,
    spot.water_type,
    spot.spot_type,
    spot.access_type,
    spot.region,
    spot.source,
    spot.notes,
    spot.description,
  ]
    .map(normalized)
    .filter(Boolean)
    .join(' ');
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function matchesFilter(spot: Spot, filter: string): boolean {
  const waterType = normalized(spot.water_type);
  const spotType = normalized(spot.spot_type);
  const accessType = normalized(spot.access_type);
  const allText = searchableSpotText(spot);

  if (filter === 'all') {
    return true;
  }

  if (filter === 'freshwater') {
    return waterType === 'freshwater';
  }

  if (filter === 'lake') {
    return spotType === 'lake';
  }

  if (filter === 'reservoir') {
    return spotType === 'reservoir';
  }

  if (filter === 'river') {
    return spotType === 'river' || spotType === 'stream';
  }

  if (filter === 'pfa') {
    return includesAny(allText, [
      'public fishing area',
      'public fishing',
      'pfa',
    ]);
  }

  if (filter === 'wma') {
    return includesAny(allText, [
      'wildlife management area',
      'wildlife area',
      'wma',
      'wildlife refuge',
    ]);
  }

  if (filter === 'municipal') {
    return includesAny(allText, [
      'municipal',
      'municipality',
      'city lake',
      'city of ',
      'public water supply',
      'water-supply',
      'water supply',
    ]);
  }

  if (filter === 'trout') {
    return includesAny(allText, [
      'trout',
      'blue river',
      'lower illinois',
      'illinois river',
      'mountain fork',
    ]);
  }

  if (filter === 'boat-ramp') {
    return accessType.includes('boat ramp');
  }

  if (filter === 'fishing-pier') {
    return accessType.includes('fishing pier');
  }

  if (filter === 'public-shore') {
    return accessType.includes('public shore');
  }

  if (filter === 'walk-in') {
    return accessType.includes('walk-in');
  }

  if (filter === 'state-park') {
    return accessType.includes('state park');
  }

  return (
    waterType === filter ||
    spotType === filter ||
    accessType === filter
  );
}

export function filterSpots(
  spots: Spot[],
  filter: SpotFilter | string,
): Spot[] {
  const normalizedFilter = normalized(filter);

  return spots.filter((spot) => matchesFilter(spot, normalizedFilter));
}

export function rankSpots(
  spots: Spot[],
  conditionScores: Record<string, number>,
) {
  return spots
    .map((spot) => ({
      spot,
      score: conditionScores[spot.id] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}
