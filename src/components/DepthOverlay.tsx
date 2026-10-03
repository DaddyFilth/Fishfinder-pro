'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

function contourColor(depth: number): string {
  if (depth >= 80) return '#172554';
  if (depth >= 50) return '#1e3a8a';
  if (depth >= 30) return '#1d4ed8';
  if (depth >= 15) return '#0284c7';
  if (depth >= 5) return '#06b6d4';
  return '#67e8f9';
}

function contourDepth(feature: GeoJSON.Feature | undefined): number {
  const value = feature?.properties && typeof feature.properties.depth === 'number'
    ? feature.properties.depth
    : Number(feature?.properties?.depth);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

export default function DepthOverlay({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    let layer: L.GeoJSON | null = null;
    let controller: AbortController | null = null;
    let requestId = 0;

    const loadContours = async () => {
      const bounds = map.getBounds();
      const params = new URLSearchParams({
        minLat: String(bounds.getSouth()),
        minLng: String(bounds.getWest()),
        maxLat: String(bounds.getNorth()),
        maxLng: String(bounds.getEast()),
      });
      controller?.abort();
      controller = new AbortController();
      const currentRequest = ++requestId;
      try {
        const response = await fetch(`/api/bathymetry?${params.toString()}`, {
          headers: { Accept: 'application/geo+json,application/json' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = await response.json() as GeoJSON.GeoJsonObject;
        if (currentRequest !== requestId) return;
        layer?.remove();
        layer = L.geoJSON(data, {
          style: (feature) => {
            const depth = contourDepth(feature);
            return { color: contourColor(depth), weight: 2, opacity: 0.82 };
          },
          onEachFeature: (feature, contour) => {
            const properties = feature.properties ?? {};
            const depth = contourDepth(feature);
            const lake = typeof properties.lake === 'string' ? properties.lake : 'Oklahoma water';
            const year = properties.year ? ` · survey ${properties.year}` : '';
            contour.bindTooltip(`${lake} · ${depth} ft${year}`, { sticky: true });
          },
        }).addTo(map);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // The map remains usable when the optional contour service is down.
      }
    };

    void loadContours();
    map.on('moveend', loadContours);
    return () => {
      controller?.abort();
      map.off('moveend', loadContours);
      layer?.remove();
    };
  }, [enabled, map]);

  return null;
}
