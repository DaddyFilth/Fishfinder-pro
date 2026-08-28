'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/** NOAA's public Digital Elevation Model WMS, rendered as a bathymetry overlay. */
const NOAA_BATHYMETRY_WMS = 'https://gis.ngdc.noaa.gov/arcgis/services/gebco08/MapServer/WMSServer';

export default function DepthOverlay({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const layer = L.tileLayer.wms(NOAA_BATHYMETRY_WMS, {
      layers: '0',
      format: 'image/png',
      transparent: true,
      opacity: 0.58,
      attribution: 'Bathymetry: NOAA/GEBCO',
      maxZoom: 18,
    }).addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [enabled, map]);

  if (!enabled) return null;
  return (
    <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 1000, background: 'rgba(15,23,42,0.9)', borderRadius: '6px', padding: '7px 8px', fontFamily: 'system-ui', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontSize: '9px', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>NOAA BATHYMETRY</div>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {['#0c4a6e', '#0369a1', '#0891b2', '#22c55e', '#eab308', '#f97316'].map((color) => <span key={color} style={{ width: '14px', height: '7px', background: color, display: 'block' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '8px' }}><span>deep</span><span>shallow</span></div>
    </div>
  );
}
