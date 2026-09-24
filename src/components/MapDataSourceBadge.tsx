'use client';

import React from 'react';
import { MAP_Z_INDEX } from '@/lib/mapViewport';

/**
 * How the spot data currently rendered on the map was resolved.
 * Mirrors the data modes produced by `resolveSpotDataMode` in `src/app/page.tsx`.
 */
export type MapDataSourceMode =
  | 'live'
  | 'cached'
  | 'fallback'
  | 'offline-live'
  | 'offline-cached'
  | 'offline-fallback'
  | 'loading';

export interface MapDataSourceBadgeState {
  label: string;
  color: string;
  ariaLabel: string;
}

const MODE_STATES: Record<MapDataSourceMode, { label: string; color: string }> = {
  live: { label: 'Live data', color: '#22c55e' },
  cached: { label: 'Cached data', color: '#fbbf24' },
  fallback: { label: 'Fallback data', color: '#f59e0b' },
  'offline-live': { label: 'Offline · live snapshot', color: '#38bdf8' },
  'offline-cached': { label: 'Offline · cached', color: '#fbbf24' },
  'offline-fallback': { label: 'Offline · fallback', color: '#f59e0b' },
  loading: { label: 'Loading data', color: '#94a3b8' },
};

/** Pure mapping used by the badge and asserted by the unit tests. */
export function mapDataSourceBadgeState(mode: MapDataSourceMode): MapDataSourceBadgeState {
  const state = MODE_STATES[mode] ?? MODE_STATES.loading;
  return { ...state, ariaLabel: `map-data-source-${mode}` };
}

type Props = {
  mode: MapDataSourceMode;
  style?: React.CSSProperties;
};

/**
 * Overlay badge that reports whether the map's spots came from the live API,
 * the browser cache, or the bundled fallback fixtures.
 */
export const MapDataSourceBadge: React.FC<Props> = ({ mode, style }) => {
  const { label, color, ariaLabel } = mapDataSourceBadgeState(mode);

  return (
    <div
      aria-label={ariaLabel}
      style={{
        position: 'absolute',
        top: 18,
        right: 18,
        zIndex: MAP_Z_INDEX.chrome,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(3,7,18,0.78)',
        border: `1px solid ${color}`,
        color: '#f8fafc',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: '50%', background: color }}
      />
      {label}
    </div>
  );
};

export default MapDataSourceBadge;
