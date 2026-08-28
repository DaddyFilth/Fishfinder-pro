'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface TemperaturePoint {
  lat: number;
  lng: number;
  name: string;
  temperature: number | null;
}

function colorForTemperature(value: number) {
  if (value < 10) return '#2563eb';
  if (value < 15) return '#06b6d4';
  if (value < 20) return '#22c55e';
  if (value < 25) return '#facc15';
  if (value < 30) return '#f97316';
  return '#ef4444';
}

export default function WaterTempOverlay({ points, enabled }: { points: TemperaturePoint[]; enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const layers = points
      .filter((point): point is TemperaturePoint & { temperature: number } => point.temperature !== null)
      .map((point) => {
        const color = colorForTemperature(point.temperature);
        return L.circle([point.lat, point.lng], {
          radius: 1800,
          color,
          fillColor: color,
          fillOpacity: 0.2,
          opacity: 0.75,
          weight: 1,
        }).bindTooltip(`${point.name}: ${point.temperature.toFixed(1)}°C`, { sticky: true }).addTo(map);
      });

    return () => layers.forEach((layer) => map.removeLayer(layer));
  }, [enabled, map, points]);

  if (!enabled) return null;
  return (
    <div style={{ position: 'absolute', bottom: '30px', right: '10px', zIndex: 1000, background: 'rgba(15,23,42,0.9)', borderRadius: '6px', padding: '7px 8px', fontFamily: 'system-ui', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontSize: '9px', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>WATER TEMPERATURE</div>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {['#2563eb', '#06b6d4', '#22c55e', '#facc15', '#f97316', '#ef4444'].map((color) => <span key={color} style={{ width: '14px', height: '7px', background: color, display: 'block' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '8px' }}><span>cold</span><span>warm</span></div>
    </div>
  );
}

export { colorForTemperature };
