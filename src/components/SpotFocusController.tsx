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
/** How close the settled view must be to the planned one before the popup opens, in pixels. */
const SETTLE_TOLERANCE_PX = 2;

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
  // Depend on the numbers, not the objects, so a parent that rebuilds `insets`/`size` on
  // every render cannot re-fly the map.
  const { top, bottom, left, right } = insets;
  const { width, height } = size;

  useEffect(() => {
    if (spotId === null || spotLat === undefined || spotLng === undefined) return;

    const viewport =
      width > 0 && height > 0
        ? { width, height }
        : { width: map.getSize().x, height: map.getSize().y };
    const layout = resolveSpotFocusLayout({
      width: viewport.width,
      height: viewport.height,
      insets: { top, bottom, left, right },
      currentZoom: map.getZoom(),
      minZoom,
      maxZoom,
    });

    const target = map
      .project([spotLat, spotLng], layout.zoom)
      .add(L.point(layout.centerOffset));
    const center = map.unproject(target, layout.zoom);

    map.flyTo(center, layout.zoom, { duration: FLIGHT_SECONDS });

    const marker = markerRefs.current[spotId];
    if (!marker || !map.hasLayer(marker)) return;
    const popup = marker.getPopup();
    if (!popup || popup.isOpen()) return;

    /** The user can pan away mid-flight; a popup must not steal focus back onto the old spot. */
    const landedOnTarget = () =>
      map.project(map.getCenter(), layout.zoom).distanceTo(target) <= SETTLE_TOLERANCE_PX;

    let timer = 0;
    let settled = false;
    const openPopupOnce = () => {
      if (settled || !landedOnTarget()) return;
      settled = true;
      window.clearTimeout(timer);
      map.off('moveend', openPopupOnce);
      if (!popup.isOpen()) marker.openPopup();
    };

    timer = window.setTimeout(openPopupOnce, FLIGHT_SETTLE_MS);
    map.on('moveend', openPopupOnce);

    return () => {
      window.clearTimeout(timer);
      map.off('moveend', openPopupOnce);
    };
  }, [bottom, height, left, map, markerRefs, maxZoom, minZoom, right, spotId, spotLat, spotLng, top, width]);

  return null;
}