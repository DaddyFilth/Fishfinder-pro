'use client';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const DEPTH_LEGEND = [
  { depth: '0–3ft',    color: 'rgba(173,216,230,0.5)' },
  { depth: '3–10ft',   color: 'rgba(100,149,237,0.5)' },
  { depth: '10–20ft',  color: 'rgba(30,144,255,0.45)' },
  { depth: '20–50ft',  color: 'rgba(0,0,139,0.4)' },
  { depth: '50ft+',    color: 'rgba(0,0,80,0.5)' },
];

export default function DepthOverlay({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    // NOAA Nautical Charts WMS — free, no key required
    const wmsLayer = L.tileLayer.wms('https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/WMSServer', {
      layers: '0,1,2,3,4,5,6,7',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.55,
      attribution: 'NOAA Electronic Navigational Charts',
    } as L.WMSOptions & { opacity: number });
    wmsLayer.addTo(map);
    return () => { map.removeLayer(wmsLayer); };
  }, [map, enabled]);

  if (!enabled) return null;

  return (
    <div style={{
      position: 'absolute', bottom: '30px', left: '10px', zIndex: 1000,
      background: 'rgba(15,23,42,0.85)', borderRadius: '6px', padding: '6px 8px',
      fontFamily: 'system-ui', backdropFilter: 'blur(4px)',
    }}>
      <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}>DEPTH CHART</div>
      {DEPTH_LEGEND.map(d => (
        <div key={d.depth} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
          <div style={{ width: '12px', height: '8px', background: d.color, border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px' }} />
          <span style={{ fontSize: '9px', color: '#94a3b8' }}>{d.depth}</span>
        </div>
      ))}
    </div>
  );
}
