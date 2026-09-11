import type { Coordinates } from './region';
import type { Spot } from './mapFilters';

const EARTH_RADIUS_MILES = 3958.7613;

export function distanceMiles(from: Coordinates, to: Coordinates) {
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const originLatitude = (from.latitude * Math.PI) / 180;
  const destinationLatitude = (to.latitude * Math.PI) / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export interface NearbySpot extends Spot {
  distanceMiles: number;
}

export function sortSpotsByDistance(spots: Spot[], from: Coordinates | null): NearbySpot[] {
  if (!from) return spots.map((spot) => ({ ...spot, distanceMiles: Number.POSITIVE_INFINITY }));
  return spots
    .map((spot) => ({
      ...spot,
      distanceMiles: distanceMiles(from, { latitude: spot.lat, longitude: spot.lng }),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export function formatDistance(miles: number) {
  if (!Number.isFinite(miles)) return 'Distance unavailable';
  if (miles < 0.1) return 'Less than 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
