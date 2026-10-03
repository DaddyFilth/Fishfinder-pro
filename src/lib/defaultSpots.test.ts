import { describe, expect, it } from 'vitest';
import { DEFAULT_SPOTS, mergeWithDefaultSpots } from '@/lib/defaultSpots';

describe('default public fishing catalog', () => {
  it('contains exactly 76 unique map locations', () => {
    expect(DEFAULT_SPOTS).toHaveLength(76);
    expect(new Set(DEFAULT_SPOTS.map((spot) => spot.id)).size).toBe(76);
  });

  it('has valid Oklahoma coordinates and source-labeled depth metadata for every location', () => {
    for (const spot of DEFAULT_SPOTS) {
      expect(spot.lat).toBeGreaterThanOrEqual(33.615);
      expect(spot.lat).toBeLessThanOrEqual(37.002);
      expect(spot.lng).toBeGreaterThanOrEqual(-103.003);
      expect(spot.lng).toBeLessThanOrEqual(-94.430);
      expect(spot.depth_metadata).toMatchObject({
        unit: 'ft',
        source_url: expect.stringMatching(/^https:\/\//),
      });
    }
  });

  it('keeps all 76 locations when a provider returns a subset', () => {
    const providerSpot = { ...DEFAULT_SPOTS[0], source: 'provider', usgs_site_id: '123' };
    const merged = mergeWithDefaultSpots([providerSpot]);

    expect(merged).toHaveLength(76);
    expect(merged.find((spot) => spot.id === providerSpot.id)?.usgs_site_id).toBe('123');
    expect(merged.map((spot) => spot.id)).toEqual(DEFAULT_SPOTS.map((spot) => spot.id));
  });
});
