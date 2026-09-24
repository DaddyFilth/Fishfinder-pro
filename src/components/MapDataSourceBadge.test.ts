import { describe, expect, it } from 'vitest';
import { mapDataSourceBadgeState, type MapDataSourceMode } from './MapDataSourceBadge';

describe('mapDataSourceBadgeState', () => {
  it('exposes the map data source through a stable aria label', () => {
    expect(mapDataSourceBadgeState('provider').ariaLabel).toBe('map-data-source-provider');
    expect(mapDataSourceBadgeState('offline-cached').ariaLabel).toBe(
      'map-data-source-offline-cached',
    );
  });

  it('distinguishes provider, cached and bundled data by colour', () => {
    expect(mapDataSourceBadgeState('provider').color).toBe('#22c55e');
    expect(mapDataSourceBadgeState('cached').color).toBe('#fbbf24');
    expect(mapDataSourceBadgeState('fallback').color).toBe('#f59e0b');
  });

  it('labels every mode the map can report and keeps the labels unique', () => {
    const modes: MapDataSourceMode[] = [
      'provider',
      'cached',
      'fallback',
      'offline-provider',
      'offline-cached',
      'offline-fallback',
      'loading',
    ];

    const states = modes.map(mapDataSourceBadgeState);

    expect(states.map((state) => state.label)).toEqual([
      'Provider data',
      'Cached provider data',
      'Bundled catalog',
      'Offline · provider snapshot',
      'Offline · cached',
      'Offline · bundled catalog',
      'Loading data',
    ]);
    expect(new Set(states.map((state) => state.ariaLabel)).size).toBe(modes.length);
  });
});
