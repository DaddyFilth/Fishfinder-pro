import { describe, expect, it } from 'vitest';
import { filterSpots, rankSpots } from '../lib/mapFilters';

describe('map filters', () => {
  it('filters spots by the selected map type', () => {
    const spots = [
      { id: 'a', name: 'Lake One', lat: 1, lng: 2, water_type: 'freshwater', spot_type: 'lake' },
      { id: 'b', name: 'River Bend', lat: 2, lng: 3, water_type: 'freshwater', spot_type: 'river' },
      { id: 'c', name: 'Reservoir South', lat: 3, lng: 4, water_type: 'freshwater', spot_type: 'reservoir' },
    ];

    expect(filterSpots(spots, 'lake').map((spot) => spot.id)).toEqual(['a']);
    expect(filterSpots(spots, 'river').map((spot) => spot.id)).toEqual(['b']);
    expect(filterSpots(spots, 'all').length).toBe(3);
  });

  it('ranks visible spots by their live fishing score', () => {
    const spots = [
      { id: 'a', name: 'Lake One', lat: 1, lng: 2, water_type: 'freshwater', spot_type: 'lake' },
      { id: 'b', name: 'River Bend', lat: 2, lng: 3, water_type: 'freshwater', spot_type: 'river' },
      { id: 'c', name: 'Reservoir South', lat: 3, lng: 4, water_type: 'freshwater', spot_type: 'reservoir' },
    ];

    const ranked = rankSpots(spots, { a: 74, b: 91, c: 67 });

    expect(ranked.map(({ spot }) => spot.id)).toEqual(['b', 'a', 'c']);
    expect(ranked[0].score).toBe(91);
  });

  it('matches normalized filter values and keeps unscored spots ranked last', () => {
    const spots = [
      { id: 'a', name: 'Lake One', lat: 1, lng: 2, water_type: 'Freshwater', spot_type: 'lake' },
      { id: 'b', name: 'River Bend', lat: 2, lng: 3, water_type: 'freshwater', spot_type: 'river' },
      { id: 'c', name: 'Reservoir South', lat: 3, lng: 4, water_type: 'freshwater', spot_type: 'Reservoir' },
      { id: 'd', name: 'Unscored Lake', lat: 4, lng: 5, water_type: 'freshwater', spot_type: 'lake' },
    ];

    expect(filterSpots(spots, 'FRESHWATER').map((spot) => spot.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(filterSpots(spots, 'reservoir').map((spot) => spot.id)).toEqual(['c']);

    const ranked = rankSpots(spots, { a: 84, b: 62 });
    expect(ranked.map(({ spot }) => spot.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(ranked.at(-1)?.score).toBe(0);
  });
});
