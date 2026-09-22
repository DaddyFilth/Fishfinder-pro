'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  resolveSpotFocusLayout,
  type ViewportInsets,
} from '@/lib/mapViewport';

/** Marker instances keyed by spot id, so a list selection can open the map popup too. */
export type SpotMarkerRegistry = { current: Record<string, L.Marker | null> };

interface FocusTarget {
  id: string;
  lat: number;
  lng: number;
}

const FLIGHT_SECONDS = 0.55;
/** Safety net for browsers that skip `moveend` when the view is already on target. */
const FLIGHT_SETTLE_MS = 700;

/**
 * Recentres the map whenever a spot is picked so the whole spot panel is visible.
 *
 * The spot is centred horizontally and the map is nudged so the marker sits below the
 * space its popup needs, which keeps the panel clear of the top badges and the bottom
 * sheet. Selections made from a list (rather than a marker tap) also open the popup.
 */
export default function SpotFocusController({
  spot,
  insets,
  size,
  markerRefs,
  minZoom = MAP_MIN_ZOOM,
  maxZoom = MAP_MAX_ZOOM,
}: {
  spot?: FocusTarget | null;
  insets: ViewportInsets;
  size: { width: number; height: number };
  markerRefs: SpotMarkerRegistry;
  minZoom?: number;
  maxZoom?: number;
}) {
  const map = useMap();
  const spotId = spot?.id ?? null;
  const spotLat = spot?.lat;
  const spotLng = spot?.lng;

  useEffect(() => {
    if (spotId === null || spotLat === undefined || spotLng === undefined) return;

    const viewport =
      size.width > 0 && size.height > 0
        ? { width: size.width, height: size.height }
        : { width: map.getSize().x, height: map.getSize().y };
    const layout = resolveSpotFocusLayout({
      width: viewport.width,
      height: viewport.height,
      insets,
      currentZoom: map.getZoom(),
      minZoom,
      maxZoom,
    });

    const target = map
      .project([spotLat, spotLng], layout.zoom)
      .add(L.point(layout.centerOffset));
    const center = map.unproject(target, layout.zoom);

    map.flyTo(center, layout.zoom, { duration: FLIGHT_SECONDS });

    const marker = markerRefs.current?.[spotId];
    const popup = marker && map.hasLayer(marker) ? marker.getPopup() : undefined;
    if (!marker || !popup || popup.isOpen()) return;

    let settled = false;
    const openPopup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      map.off('moveend', openPopup);
      if (!popup.isOpen()) marker.openPopup();
    };
    const timer = window.setTimeout(openPopup, FLIGHT_SETTLE_MS);
    map.on('moveend', openPopup);

    return () => {
      window.clearTimeout(timer);
      map.off('moveend', openPopup);
    };
  }, [insets, map, markerRefs, maxZoom, minZoom, size.height, size.width, spotId, spotLat, spotLng]);

  return null;
}