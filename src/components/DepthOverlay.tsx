'use client';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const USGS_HYDRO = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}';
const OPENSEAMAP = 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png';

export default function DepthOverlay({ enabled }: { enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    const usgs = L.tileLayer(USGS_HYDRO, {
      opacity: 0.5, attribution: 'USGS NHD Hydro', maxZoom: 18,
    }).addTo(map);
    const sea = L.tileLayer(OPENSEAMAP, {
      opacity: 0.5, attribution: 'OpenSeaMap', maxZoom: 18,
    }).addTo(map);
    return () => { map.removeLayer(usgs); map.removeLayer(sea); };
  }, [enabled, map]);

  if (!enabled) return null;
  return (
    <div style={{ position:'absolute',bottom:'10px',left:'10px',zIndex:1000,background:'rgba(15,23,42,0.9)',borderRadius:'6px',padding:'7px 8px',fontFamily:'system-ui',backdropFilter:'blur(4px)' }}>
      <div style={{ fontSize:'9px',color:'#cbd5e1',marginBottom:'5px',fontWeight:'bold' }}>DEPTH · USGS + NOAA</div>
      <div style={{ display:'flex',gap:'3px',alignItems:'center' }}>
        {['#0c4a6e','#0369a1','#0891b2','#22c55e','#eab308','#f97316'].map(c=><span key={c} style={{ width:'14px',height:'7px',background:c,display:'block' }}/>)}
      </div>
      <div style={{ display:'flex',justifyContent:'space-between',color:'#94a3b8',fontSize:'8px' }}><span>deep</span><span>shallow</span></div>
    </div>
  );
}
