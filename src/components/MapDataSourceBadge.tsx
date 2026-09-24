'use client';

import React from 'react';
import { MAP_Z_INDEX } from '@/lib/mapViewport';

/** How the spot list currently rendered on the map was resolved. */
export type MapDataSourceMode =
  | 'provider'
  | 'cached'
  | 'fallback'
  | 'offline-provider'
  | 'offline-cached'
  | 'offline-fallback'
  | 'loading';

export interface MapDataSourceBadgeState {
  label: string;
  color: string;
  ariaLabel: string;
}

const MODE_STATES: Record<MapDataSourceMode, { label: string; color: string }> = {
  provider: { label: 'Provider data', color: '#22c55e' },
  cached: { label: 'Cached provider data', color: '#fbbf24' },
  fallback: { label: 'Bundled catalog', color: '#f59e0b' },
  'offline-provider': { label: 'Offline · provider snapshot', color: '#38bdf8' },
  'offline-cached': { label: 'Offline · cached', color: '#fbbf24' },
  'offline-fallback': { label: 'Offline · bundled catalog', color: '#f59e0b' },
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

/** Reports whether map spots came from a provider, cache, or bundled catalog. */
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
