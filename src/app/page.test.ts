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
});
