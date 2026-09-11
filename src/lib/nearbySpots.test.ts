import { describe, expect, it } from 'vitest';
import { distanceMiles, formatDistance, sortSpotsByDistance } from './nearbySpots';
import type { Spot } from './mapFilters';

const spots: Spot[] = [
  { id: 'far', name: 'Far Lake', lat: 36, lng: -97.5, water_type: 'lake', spot_type: 'lake' },
  { id: 'nearby', name: 'Nearby Lake', lat: 35.51, lng: -97.5, water_type: 'lake', spot_type: 'lake' },
];

describe('nearby spot helpers', () => {
  it('calculates a small positive distance for nearby coordinates', () => {
    const miles = distanceMiles(
      { latitude: 35.5, longitude: -97.5 },
      { latitude: 35.51, longitude: -97.5 },
    );
    expect(miles).toBeGreaterThan(0);
    expect(miles).toBeLessThan(2);
  });

  it('sorts public waters nearest first when GPS is available', () => {
    const sorted = sortSpotsByDistance(spots, { latitude: 35.5, longitude: -97.5 });
    expect(sorted.map((spot) => spot.name)).toEqual(['Nearby Lake', 'Far Lake']);
  });

  it('keeps the original order when GPS is unavailable and formats distances', () => {
    expect(sortSpotsByDistance(spots, null).map((spot) => spot.name)).toEqual(['Far Lake', 'Nearby Lake']);
    expect(formatDistance(0.04)).toBe('Less than 0.1 mi');
    expect(formatDistance(12.4)).toBe('12 mi');
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBe('Distance unavailable');
  });
});
