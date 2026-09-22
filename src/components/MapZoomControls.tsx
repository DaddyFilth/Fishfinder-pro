'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_Z_INDEX,
  OKLAHOMA_MAP_VIEW,
  resolveZoomControlButtons,
  resolveZoomControlState,
  type ZoomControlButton,
} from '@/lib/mapViewport';

/** Touch target size. Kept above the 44px minimum recommended for map controls. */
const BUTTON_SIZE = 44;

function buttonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
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

/** What each button in the stack does, keyed by the id `resolveZoomControlButtons` emits. */
const ZOOM_ACTIONS: Record<ZoomControlButton['id'], (map: L.Map) => void> = {
  in: (map) => map.zoomIn(),
  out: (map) => map.zoomOut(),
  reset: (map) => map.flyTo(OKLAHOMA_MAP_VIEW.center, OKLAHOMA_MAP_VIEW.zoom, { duration: 0.7 }),
};

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
  const stackRef = useRef<HTMLDivElement | null>(null);
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

  /**
   * The stack renders inside `.leaflet-container`, so without this Leaflet's own handlers
   * would read a press as the start of a map drag and the wheel over the buttons as a zoom.
   * This is the same guard Leaflet wraps around its built-in controls.
   */
  useEffect(() => {
    const node = stackRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);

  const buttons = resolveZoomControlButtons(
    resolveZoomControlState({
      zoom: view.zoom,
      center: { lat: view.lat, lng: view.lng },
      minZoom,
      maxZoom,
    }),
  );

  return (
    <div
      ref={stackRef}
      role="group"
      aria-label="Map zoom controls"
      aria-hidden={!visible}
      /* `inert` keeps the hidden stack out of the tab order; `pointer-events` alone does not. */
      inert={!visible}
      style={{
        position: 'absolute',
        left: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: MAP_Z_INDEX.controls,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    >
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          onClick={() => ZOOM_ACTIONS[button.id](map)}
          disabled={!button.enabled}
          aria-label={button.label}
          title={button.label}
          style={buttonStyle(button.enabled)}
        >
          {button.glyph}
        </button>
      ))}
    </div>
  );
}