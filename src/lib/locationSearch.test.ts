import { describe, expect, it } from 'vitest';
import { normalizeLocationText, searchLocations } from './locationSearch';
import type { Spot } from './mapFilters';

function spot(partial: Partial<Spot> & Pick<Spot, 'id' | 'name'>): Spot {
  return {
    lat: 35.5,
    lng: -97.5,
    water_type: 'freshwater',
    spot_type: 'lake',
    ...partial,
  };
}

const catalog: Spot[] = [
  spot({ id: 'hefner', name: 'Lake Hefner', region: 'Oklahoma City', spot_type: 'reservoir' }),
  spot({ id: 'thunderbird', name: 'Lake Thunderbird', region: 'Norman' }),
  spot({ id: 'overholser', name: 'Lake Overholser', region: 'Oklahoma City' }),
  spot({ id: 'tenkiller', name: 'Tenkiller Ferry Lake', region: 'Cookson' }),
  spot({ id: 'illinois', name: 'Illinois River', region: 'Tahlequah', spot_type: 'river' }),
  spot({ id: 'blue', name: 'Blue River Public Fishing Area', spot_type: 'public fishing area' }),
];

describe('normalizeLocationText', () => {
  it('lowercases, strips accents, and collapses punctuation into single spaces', () => {
    expect(normalizeLocationText('  Lake  Héfner — OK  ')).toBe('lake hefner ok');
  });
});

describe('searchLocations', () => {
  it('returns nothing for a blank query', () => {
    expect(searchLocations(catalog, '   ')).toEqual([]);
  });

  it('finds a water by a name fragment, case insensitively', () => {
    expect(searchLocations(catalog, 'thunder').map((entry) => entry.name)).toEqual(['Lake Thunderbird']);
    expect(searchLocations(catalog, 'FERRY').map((entry) => entry.name)).toEqual(['Tenkiller Ferry Lake']);
  });

  it('ranks a name match above a region-only match', () => {
    const matches = searchLocations(catalog, 'oklahoma');
    expect(matches.map((entry) => entry.name)).toEqual(['Lake Hefner', 'Lake Overholser']);
  });

  it('requires every word in the query to match', () => {
    expect(searchLocations(catalog, 'lake thunderbird').map((entry) => entry.name)).toEqual(['Lake Thunderbird']);
    expect(searchLocations(catalog, 'lake tenkiller').map((entry) => entry.name)).toEqual(['Tenkiller Ferry Lake']);
    expect(searchLocations(catalog, 'lake tahlequah')).toEqual([]);
  });

  it('matches spot type so PFA and river names work', () => {
    expect(searchLocations(catalog, 'public fishing area').map((entry) => entry.name)).toEqual([
      'Blue River Public Fishing Area',
    ]);
    expect(searchLocations(catalog, 'river').map((entry) => entry.name)).toEqual([
      'Blue River Public Fishing Area',
      'Illinois River',
    ]);
  });

  it('prefers the spot whose name starts with the query', () => {
    expect(searchLocations(catalog, 'lake over').map((entry) => entry.name)).toEqual(['Lake Overholser']);
  });

  it('caps the result list', () => {
    expect(searchLocations(catalog, 'lake', 2)).toHaveLength(2);
    expect(searchLocations(catalog, 'lake', 0)).toEqual([]);
  });
});
