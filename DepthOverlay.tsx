'use client';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const USGS_HYDRO = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}';
const OWRB_CONTOURS = '/api/bathymetry';

export const DEPTH_COLORS = ['#dbeafe', '#93c5fd', '#60a5fa', '#3b82f6', '#1d4ed8', '#172554'];

export function colorForDepth(depth: number): string {
  const feet = Math.abs(depth);
  if (feet >= 60) return DEPTH_COLORS[5];
  if (feet >= 45) return DEPTH_COLORS[4];
  if (feet >= 30) return DEPTH_COLORS[3];
  if (feet >= 20) return DEPTH_COLORS[2];
  if (feet >= 10) return DEPTH_COLORS[1];
  return DEPTH_COLORS[0];
}

type BathymetryFeature = {
  type: 'Feature';
  geometry: unknown;
  properties?: {
    lake?: string;
    depth?: number | null;
    elevation?: number | null;
    source?: string;
    year?: number | null;
  };
};

type BathymetryCollection = {
  type: 'FeatureCollection';
  features?: BathymetryFeature[];
};

export default function DepthOverlay({ enabled }: { enabled: boolean }) {
  const map = useMap();
  const contourLayerRef = useRef<L.GeoJSON | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const hydro = L.tileLayer(USGS_HYDRO, {
      opacity: 0.28,
      attribution: 'USGS Hydrography',
      maxZoom: 18,
    }).addTo(map);

    const clearContours = () => {
      if (contourLayerRef.current) {
        map.removeLayer(contourLayerRef.current);
        contourLayerRef.current = null;
      }
    };

    const renderContours = async () => {
      requestRef.current?.abort();
      requestRef.current = new AbortController();
      clearContours();

      const bounds = map.getBounds().pad(0.08);
      const params = new URLSearchParams({
        bbox: [
          bounds.getWest().toFixed(5),
          bounds.getSouth().toFixed(5),
          bounds.getEast().toFixed(5),
          bounds.getNorth().toFixed(5),
        ].join(','),
      });

      try {
        const response = await fetch(`${OWRB_CONTOURS}?${params.toString()}`, {
          signal: requestRef.current.signal,
          headers: { Accept: 'application/geo+json, application/json' },
        });
        if (!response.ok) return;
        const collection = await response.json() as BathymetryCollection;
        if (!Array.isArray(collection.features)) return;

        const geoJson = L.geoJSON(collection as never, {
          style: (feature) => {
            const depth = Number(feature?.properties?.depth);
            const color = Number.isFinite(depth) ? colorForDepth(depth) : DEPTH_COLORS[0];
            return { color, weight: 2, opacity: 0.88 };
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties ?? {};
            const depth = Number(properties.depth);
            const depthLabel = Number.isFinite(depth) ? `${Math.abs(depth).toFixed(0)} ft deep` : 'Depth unavailable';
            const lake = properties.lake ? `${properties.lake}: ` : '';
            const year = properties.year ? ` · survey ${properties.year}` : '';
            layer.bindTooltip(`${lake}${depthLabel}${year}`, { sticky: true });
          },
        }).addTo(map);
        contourLayerRef.current = geoJson;
      } catch {
        // The layer is optional; the hydrography base remains available if OWRB is down.
      }
    };

    void renderContours();
    map.on('moveend', renderContours);
    map.on('zoomend', renderContours);

    return () => {
      requestRef.current?.abort();
      map.off('moveend', renderContours);
      map.off('zoomend', renderContours);
      clearContours();
      map.removeLayer(hydro);
    };
  }, [enabled, map]);

  if (!enabled) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '30px',
        left: '10px',
        zIndex: 1000,
        background: 'rgba(15,23,42,0.92)',
        borderRadius: '6px',
        padding: '7px 8px',
        fontFamily: 'system-ui',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ fontSize: '9px', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>
        MEASURED DEPTH CONTOURS
      </div>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {DEPTH_COLORS.map((color) => (
          <span key={color} style={{ width: '14px', height: '7px', background: color, display: 'block' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '8px' }}>
        <span>shallower</span><span>deeper</span>
      </div>
      <div style={{ color: '#64748b', fontSize: '8px', marginTop: '4px' }}>
        OWRB survey contours · hover for feet
      </div>
    </div>
  );
}
