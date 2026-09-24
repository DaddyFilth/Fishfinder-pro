import { describe, expect, it } from 'vitest';
import { mapDataSourceBadgeState, type MapDataSourceMode } from './MapDataSourceBadge';

describe('mapDataSourceBadgeState', () => {
  it('exposes the map data source through a stable aria label', () => {
    expect(mapDataSourceBadgeState('live').ariaLabel).toBe('map-data-source-live');
    expect(mapDataSourceBadgeState('offline-cached').ariaLabel).toBe(
      'map-data-source-offline-cached',
    );
  });

  it('distinguishes live, cached and fallback data by colour', () => {
    expect(mapDataSourceBadgeState('live').color).toBe('#22c55e');
    expect(mapDataSourceBadgeState('cached').color).toBe('#fbbf24');
    expect(mapDataSourceBadgeState('fallback').color).toBe('#f59e0b');
  });

  it('labels every mode the map can report and keeps the labels unique', () => {
    const modes: MapDataSourceMode[] = [
      'live',
      'cached',
      'fallback',
      'offline-live',
      'offline-cached',
      'offline-fallback',
      'loading',
    ];

    const states = modes.map(mapDataSourceBadgeState);

    expect(states.map((state) => state.label)).toEqual([
      'Live data',
      'Cached data',
      'Fallback data',
      'Offline · live snapshot',
      'Offline · cached',
      'Offline · fallback',
      'Loading data',
    ]);
    expect(new Set(states.map((state) => state.ariaLabel)).size).toBe(modes.length);
  });
});
