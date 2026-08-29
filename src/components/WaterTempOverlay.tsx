'use client';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface TemperaturePoint { lat: number; lng: number; name: string; temperature: number | null; }

export function colorForTemperature(v: number): string {
  if (v < 10) return '#2563eb'; if (v < 15) return '#06b6d4';
  if (v < 20) return '#22c55e'; if (v < 25) return '#facc15';
  if (v < 30) return '#f97316'; return '#ef4444';
}

export function getRadiusForZoom(zoom: number): number {
  if (zoom < 8) return 15000; if (zoom <= 11) return 8000; return 3000;
}

function blend(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('');
}

function nearestTemp(lat: number, lng: number, pts: TemperaturePoint[]): number | null {
  let best: number | null = null; let bd = Infinity;
  for (const p of pts) {
    if (p.temperature === null) continue;
    const d = (p.lat - lat) ** 2 + (p.lng - lng) ** 2;
    if (d < bd) { bd = d; best = p.temperature; }
  }
  return best;
}

export default function WaterTempOverlay({ points, enabled }: { points: TemperaturePoint[]; enabled: boolean }) {
  const map = useMap();
  const gridRef = useRef<L.Rectangle[]>([]);
  const spotRef = useRef<L.Circle[]>([]);
  const pulseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const clear = () => {
      gridRef.current.forEach(l => map.removeLayer(l)); gridRef.current = [];
      spotRef.current.forEach(l => map.removeLayer(l)); spotRef.current = [];
    };

    const render = () => {
      clear();
      const b = map.getBounds().pad(0.1);
      const cells = map.getZoom() < 8 ? 14 : 20;
      const latStep = (b.getNorth() - b.getSouth()) / cells;
      const lngStep = (b.getEast() - b.getWest()) / cells;

      for (let i = 0; i < cells; i++) {
        for (let j = 0; j < cells; j++) {
          const clat = b.getSouth() + (i + 0.5) * latStep;
          const clng = b.getWest() + (j + 0.5) * lngStep;
          const t = nearestTemp(clat, clng, points);
          if (t === null) continue;
          const rect = L.rectangle(
            [[b.getSouth() + i * latStep, b.getWest() + j * lngStep],
             [b.getSouth() + (i + 1) * latStep, b.getWest() + (j + 1) * lngStep]],
            { stroke: false, fillColor: colorForTemperature(t), fillOpacity: 0.18 }
          ).addTo(map);
          gridRef.current.push(rect);
        }
      }

      spotRef.current = points.map(pt => {
        const color = pt.temperature !== null ? colorForTemperature(pt.temperature) : '#6b7280';
        const tip = pt.temperature !== null ? `${pt.name}: ${pt.temperature.toFixed(1)}°C` : `${pt.name}: No temp data`;
        return L.circle([pt.lat, pt.lng], {
          radius: getRadiusForZoom(map.getZoom()) * 0.35,
          color, fillColor: color, fillOpacity: 0.55, opacity: 0.9, weight: 1,
        }).bindTooltip(tip, { sticky: true }).addTo(map);
      });
    };

    render();
    map.on('zoomend', render);
    map.on('moveend', render);

    let phase = 0;
    pulseRef.current = window.setInterval(() => {
      phase = (phase + 1) % 40;
      const pulse = 0.14 + 0.08 * Math.sin((phase / 40) * Math.PI * 2);
      gridRef.current.forEach(r => r.setStyle({ fillOpacity: pulse }));
    }, 100);

    return () => {
      map.off('zoomend', render);
      map.off('moveend', render);
      if (pulseRef.current) window.clearInterval(pulseRef.current);
      clear();
    };
  }, [enabled, map, points]);

  if (!enabled) return null;
  return (
    <div style={{ position: 'absolute', bottom: '30px', right: '10px', zIndex: 1000, background: 'rgba(15,23,42,0.9)', borderRadius: '6px', padding: '7px 8px', fontFamily: 'system-ui', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontSize: '9px', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>WATER TEMPERATURE</div>
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        {['#2563eb', '#06b6d4', '#22c55e', '#facc15', '#f97316', '#ef4444', '#6b7280'].map(c => <span key={c} style={{ width: '14px', height: '7px', background: c, display: 'block' }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '8px' }}><span>cold</span><span>warm</span><span>N/A</span></div>
    </div>
  );
}
