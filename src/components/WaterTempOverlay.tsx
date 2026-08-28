'use client';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface TemperaturePoint { lat:number; lng:number; name:string; temperature:number|null; }

export function colorForTemperature(v:number):string {
  if(v<10)return'#2563eb'; if(v<15)return'#06b6d4';
  if(v<20)return'#22c55e'; if(v<25)return'#facc15';
  if(v<30)return'#f97316'; return'#ef4444';
}

export function getRadiusForZoom(zoom:number):number {
  if(zoom<8)return 15000; if(zoom<=11)return 8000; return 3000;
}

export default function WaterTempOverlay({ points, enabled }:{ points:TemperaturePoint[]; enabled:boolean }) {
  const map = useMap();
  const layersRef = useRef<L.Circle[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const render = () => {
      layersRef.current.forEach(l => map.removeLayer(l));
      layersRef.current = points.map(pt => {
        const color = pt.temperature !== null ? colorForTemperature(pt.temperature) : '#6b7280';
        const tip   = pt.temperature !== null ? `${pt.name}: ${pt.temperature.toFixed(1)}°C` : `${pt.name}: No temp data`;
        return L.circle([pt.lat, pt.lng], {
          radius: getRadiusForZoom(map.getZoom()),
          color, fillColor: color, fillOpacity: 0.2, opacity: 0.75, weight: 1,
        }).bindTooltip(tip, { sticky:true }).addTo(map);
      });
    };

    render();
    map.on('zoomend', render);
    return () => { map.off('zoomend', render); layersRef.current.forEach(l => map.removeLayer(l)); };
  }, [enabled, map, points]);

  if (!enabled) return null;
  return (
    <div style={{ position:'absolute',bottom:'30px',right:'10px',zIndex:1000,background:'rgba(15,23,42,0.9)',borderRadius:'6px',padding:'7px 8px',fontFamily:'system-ui',backdropFilter:'blur(4px)' }}>
      <div style={{ fontSize:'9px',color:'#cbd5e1',marginBottom:'5px',fontWeight:'bold' }}>WATER TEMPERATURE</div>
      <div style={{ display:'flex',gap:'3px',alignItems:'center' }}>
        {['#2563eb','#06b6d4','#22c55e','#facc15','#f97316','#ef4444','#6b7280'].map(c=><span key={c} style={{ width:'14px',height:'7px',background:c,display:'block' }}/>)}
      </div>
      <div style={{ display:'flex',justifyContent:'space-between',color:'#94a3b8',fontSize:'8px' }}><span>cold</span><span>warm</span><span>N/A</span></div>
    </div>
  );
}
