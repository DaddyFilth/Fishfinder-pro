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
  return null;
}
