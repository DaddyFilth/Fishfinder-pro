'use client';

import React, { useCallback, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  OKLAHOMA_MAP_VIEW,
  resolveZoomControlState,
} from '@/lib/mapViewport';

function buttonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.32)',
    background: enabled ? 'rgba(7,17,27,0.88)' : 'rgba(7,17,27,0.6)',
    color: enabled ? '#e2f7ff' : '#64748b',
    fontSize: 22,
    fontWeight: 800,
    lineHeight: 1,
    cursor: enabled ? 'pointer' : 'not-allowed',
    backdropFilter: 'blur(14px)',
    boxShadow: '0 14px 30px rgba(0,0,0,0.32)',
    touchAction: 'manipulation',
    transition: 'color 0.15s ease, background 0.15s ease',
  };
}

/**
 * Touch sized zoom in / zoom out / reset controls for the fishing map.
 *
 * Leaflet's built-in control lives in a corner that the in-map HUD used to cover, so the
 * map owns its own control stack and keeps it clear of the floating app chrome.
 */
export default function MapZoomControls({
  minZoom = MAP_MIN_ZOOM,
  maxZoom = MAP_MAX_ZOOM,
  visible = true,
}: {
  minZoom?: number;
  maxZoom?: number;
  visible?: boolean;
}) {
  const map = useMap();
  const [view, setView] = useState(() => {
    const center = map.getCenter();
    return { zoom: map.getZoom(), lat: center.lat, lng: center.lng };
  });

  const sync = useCallback(() => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    setView((previous) =>
      previous.zoom === zoom && previous.lat === center.lat && previous.lng === center.lng
        ? previous
        : { zoom, lat: center.lat, lng: center.lng },
    );
  }, [map]);

  useMapEvents({ zoomend: sync, moveend: sync });

  const { canZoomIn, canZoomOut, canResetView } = resolveZoomControlState({
    zoom: view.zoom,
    center: { lat: view.lat, lng: view.lng },
    minZoom,
    maxZoom,
  });

  const resetView = () => {
    map.flyTo(OKLAHOMA_MAP_VIEW.center, OKLAHOMA_MAP_VIEW.zoom, { duration: 0.7 });
  };

  return (
    <div
      role="group"
      aria-label="Map zoom controls"
      aria-hidden={!visible}
      style={{
        position: 'absolute',
        left: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1650,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    >
      <button
        type="button"
        onClick={() => map.zoomIn()}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        title="Zoom in"
        style={buttonStyle(canZoomIn)}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => map.zoomOut()}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        title="Zoom out"
        style={buttonStyle(canZoomOut)}
      >
        −
      </button>
      <button
        type="button"
        onClick={resetView}
        disabled={!canResetView}
        aria-label="Reset map view"
        title="Reset map view"
        style={buttonStyle(canResetView)}
      >
        ⟲
      </button>
    </div>
  );
}