'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import BiteTimePanel from '@/components/BiteTimePanel';
import WaypointMarkers from '@/components/WaypointMarkers';
import DepthOverlay from '@/components/DepthOverlay';
import FishBot from '@/components/ai/FishBot';
import FishIdentifier from '@/components/ai/FishIdentifier';
import CatchLogger from '@/components/logbook/CatchLogger';
import SevenDayForecast from '@/components/SevenDayForecast';
import WaterTempOverlay from '@/components/WaterTempOverlay';

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  water_type: string;
  spot_type: string;
}

interface Cond {
  fishing_score: number;
  air_temp_c: number | null;
  water_temp_c: number | null;
  wind_speed_ms: number | null;
  wind_dir_deg: number | null;
  wave_height_m: number | null;
  wave_period_s: number | null;
  swell_direction_deg: number | null;
  dissolved_oxygen_mgl: number | null;
  flow_rate_cfs: number | null;
  water_level_m: number | null;
  tide_height_m: number | null;
  tide_type: string | null;
  pressure_hpa: number | null;
  humidity_pct: number | null;
  turbidity_ntu: number | null;
  ph: number | null;
  score_breakdown: {
    recommendations: string[];
    warnings: string[];
    components: Record<string, number>;
  };
  data_sources: string[];
  cached: boolean;
  captured_at: string;
}

type Tab =
  | 'score'
  | 'water'
  | 'atmosphere'
  | 'marine'
  | 'bite'
  | 'forecast'
  | 'log'
  | 'ai'
  | 'identify';

type BaseLayer = 'satellite' | 'terrain' | 'street';

const SC = (s: number) => (s >= 75 ? '#22c55e' : s >= 50 ? '#eab308' : s >= 25 ? '#f97316' : '#ef4444');
const SL = (s: number) => (s >= 75 ? 'Excellent' : s >= 50 ? 'Good' : s >= 25 ? 'Fair' : 'Poor');

function DL(l: number | null, f: number | null) {
  if (l !== null) {
    if (l < 0.3) return 'Very Shallow';
    if (l < 0.9) return 'Shallow (1–3ft)';
    if (l < 2.4) return 'Moderate (3–8ft)';
    if (l < 6) return 'Deep (8–20ft)';
    return 'Very Deep';
  }
  if (f !== null) {
    if (f < 50) return 'Very Low Flow';
    if (f < 300) return 'Low Flow';
    if (f < 1000) return 'Moderate Flow';
    if (f < 5000) return 'High Flow';
    return 'Flood Stage';
  }
  return 'No depth data';
}

function DC(l: number | null, f: number | null) {
  if (l !== null) {
    if (l < 0.3) return '#dbeafe';
    if (l < 0.9) return '#93c5fd';
    if (l < 2.4) return '#60a5fa';
    if (l < 6) return '#2563eb';
    return '#1e3a8a';
  }
  if (f !== null) {
    if (f < 50) return '#dbeafe';
    if (f < 1000) return '#60a5fa';
    return '#1e3a8a';
  }
  return '#6b7280';
}

function Bar({ label, value }: { label: string; value: number }) {
  const c = SC(value);
  return (
    <div style={{ marginBottom: '4px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#9ca3af',
          marginBottom: '2px',
        }}
      >
        <span>{label}</span>
        <span style={{ color: c }}>{value}</span>
      </div>
      <div style={{ background: '#1f2937', borderRadius: '4px', height: '5px' }}>
        <div
          style={{
            width: `${value}%`,
            background: c,
            height: '100%',
            borderRadius: '4px',
            transition: 'width .4s',
          }}
        />
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  unit,
  hi,
}: {
  icon: string;
  label: string;
  value: string | number | null;
  unit?: string;
  hi?: string;
}) {
  if (value === null || value === undefined) return null;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '5px 0',
        borderBottom: '1px solid #1f2937',
      }}
    >
      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: '12px', fontWeight: '600', color: hi ?? '#f9fafb' }}>
        {value}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

function Depth({ l, f }: { l: number | null; f: number | null }) {
  const pct = l !== null ? Math.min((l / 10) * 100, 100) : f !== null ? Math.min((f / 10000) * 100, 100) : 0;
  const c = DC(l, f);

  return (
    <div
      style={{
        background: '#0f172a',
        border: `1px solid ${c}`,
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>📏 Depth / Water Level</span>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: c }}>{DL(l, f)}</span>
      </div>
      <div
        style={{
          position: 'relative',
          background: '#eff6ff',
          borderRadius: '6px',
          height: '18px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg,#dbeafe,${c})`,
            height: '100%',
            borderRadius: '6px',
            transition: 'width .5s',
          }}
        />
        <span
          style={{
            position: 'absolute',
            right: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            color: pct > 55 ? 'white' : '#1e3a8a',
            fontWeight: 'bold',
          }}
        >
          {l !== null ? `${l.toFixed(2)}m` : f !== null ? `${f.toFixed(0)} cfs` : 'N/A'}
        </span>
      </div>
    </div>
  );
}export default function FishingMap({ spots }: { spots: Spot[] }) {
  const [conditions, setConditions] = useState<Record<string, Cond>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('satellite');
  const [layers, setLayers] = useState({
    depth: false,
    waterTemp: false,
    waypoints: true,
    clouds: false,
  });

  const temperaturePoints = useMemo(
    () =>
      spots.map((spot) => ({
        lat: spot.lat,
        lng: spot.lng,
        name: spot.name,
        temperature: conditions[spot.id]?.water_temp_c ?? null,
      })),
    [spots, conditions]
  );

  const rankedSpots = spots
    .filter((spot) => conditions[spot.id])
    .map((spot) => ({ spot, score: conditions[spot.id].fishing_score }))
    .sort((a, b) => b.score - a.score);

  const load = async (id: string) => {
    if (conditions[id] || loading[id]) return;
    setLoading((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/spots/${id}/conditions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Cond = await res.json();
      setConditions((p) => ({ ...p, [id]: data }));
      setTabs((p) => ({ ...p, [id]: 'score' }));
    } catch (e) {
      setErrors((p) => ({ ...p, [id]: e instanceof Error ? e.message : 'Failed' }));
    } finally {
      setLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const retry = (id: string) => {
    setErrors((p) => ({ ...p, [id]: '' }));
    setConditions((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    load(id);
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    spots.forEach((spot) => {
      load(spot.id);
    });
  }, [spots]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((p) => ({ ...p, [key]: !p[key] }));
  };

  const baseLayers: Record<BaseLayer, { url: string; attribution: string; label: string }> = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      label: '🛰️ Satellite',
    },
    terrain: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution:
        'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
      label: '⛰️ Terrain',
    },
    street: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      label: '🗺️ Street',
    },
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: sidebarOpen ? 0 : '-290px',
          width: '270px',
          height: '100%',
          background: 'rgba(10, 15, 25, 0.94)',
          backdropFilter: 'blur(12px)',
          zIndex: 2000,
          transition: 'left 0.28s ease',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.45)' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Map Layers</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '22px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Base map
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(Object.keys(baseLayers) as BaseLayer[]).map((key) => (
            <button
              key={key}
              onClick={() => setBaseLayer(key)}
              style={{
                padding: '10px 12px',
                background: baseLayer === key ? '#0f766e' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${baseLayer === key ? '#14b8a6' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '10px',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              {baseLayers[key].label}
            </button>
          ))}
        </div>

        <div
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: '4px',
          }}
        >
          Overlays
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {([
            ['depth', '📏 Depth contours'],
            ['waterTemp', '🌡 Water temperature'],
            ['clouds', '☁️ Cloud cover'],
            ['waypoints', '📍 Waypoints'],
          ] as [keyof typeof layers, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              style={{
                padding: '10px 12px',
                background: layers[key] ? 'rgba(37, 99, 235, 0.22)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${layers[key] ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '10px',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{label}</span>
              <span style={{ fontSize: '10px', color: layers[key] ? '#bfdbfe' : '#64748b' }}>
                {layers[key] ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: 'auto',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '10px 12px',
            color: '#94a3b8',
            fontSize: '11px',
            lineHeight: 1.4,
          }}
        >
          Satellite is the default so depth, temp, and cloud layers stay transparent over the imagery, similar to modern fishing maps.
        </div>
      </div>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 1500,
            background: 'rgba(10,15,25,0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '10px',
            padding: '10px 14px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          }}
        >
          ☰ Layers
        </button>
      )}      <MapContainer center={[35.5, -97.5]} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl>
        <TileLayer
          key={baseLayer}
          attribution={baseLayers[baseLayer].attribution}
          url={baseLayers[baseLayer].url}
        />

        {layers.clouds && (
          <TileLayer
            attribution='&copy; OpenWeatherMap'
            url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${process.env.NEXT_PUBLIC_OWM_KEY}`}
            opacity={0.28}
          />
        )}

        <DepthOverlay enabled={layers.depth} />
        <WaterTempOverlay points={temperaturePoints} enabled={layers.waterTemp} />
        {layers.waypoints && <WaypointMarkers />}

        {spots.map((spot) => {
          const c = conditions[spot.id];
          const tab = tabs[spot.id] ?? 'score';
          const color = c ? SC(c.fishing_score) : '#6b7280';

          const icon = L.divIcon({
            className: '',
            html: `<div style="background:${color};width:30px;height:30px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:white">${c ? c.fishing_score : '?'}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          });

          const TB = (t: Tab, lbl: string) => (
            <button
              key={t}
              onClick={() => setTabs((p) => ({ ...p, [spot.id]: t }))}
              style={{
                flex: 1,
                padding: '5px 2px',
                fontSize: '10px',
                fontWeight: tab === t ? 'bold' : 'normal',
                background: tab === t ? '#0891b2' : 'rgba(255,255,255,0.10)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              {lbl}
            </button>
          );

          return (
            <Marker key={spot.id} position={[spot.lat, spot.lng]} icon={icon} eventHandlers={{ click: () => load(spot.id) }}>
              <Popup maxWidth={380} minWidth={340}>
                <div
                  style={{
                    fontFamily: 'system-ui,sans-serif',
                    fontSize: '13px',
                    color: '#f9fafb',
                    background: 'rgba(17,24,39,0.95)',
                    backdropFilter: 'blur(10px)',
                    margin: '-12px -16px',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  <div
                    style={{
                      marginBottom: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      {rankedSpots.slice(0, 3).findIndex(({ spot: r }) => r.id === spot.id) >= 0 && (
                        <span
                          style={{
                            display: 'inline-block',
                            color: '#22c55e',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            marginBottom: '4px',
                            background: 'rgba(34,197,94,0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          OPTIMAL NOW · AI RANK #{rankedSpots.findIndex(({ spot: r }) => r.id === spot.id) + 1}
                        </span>
                      )}
                      <strong style={{ fontSize: '15px', color: '#22d3ee', display: 'block', marginTop: '4px' }}>
                        {spot.name}
                      </strong>
                      <p style={{ color: '#6b7280', fontSize: '11px', margin: '4px 0 0' }}>
                        {spot.water_type} · {spot.spot_type}
                      </p>
                    </div>
                    {c && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#475569',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        📍 {spot.lat.toFixed(3)}, {spot.lng.toFixed(3)}
                      </div>
                    )}
                  </div>

                  {loading[spot.id] && (
                    <p style={{ color: '#3b82f6', textAlign: 'center', padding: '16px 0' }}>
                      ⏳ Fetching live conditions...
                    </p>
                  )}

                  {errors[spot.id] && !loading[spot.id] && (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '10px',
                        background: 'rgba(239,68,68,0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(239,68,68,0.3)',
                      }}
                    >
                      <p style={{ color: '#ef4444', fontSize: '11px', margin: '0 0 8px' }}>
                        ⚠ {errors[spot.id]}
                      </p>
                      <button
                        onClick={() => retry(spot.id)}
                        style={{
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!c && !loading[spot.id] && !errors[spot.id] && (
                    <button
                      onClick={() => load(spot.id)}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg,#0369a1,#0284c7)',
                        color: 'white',
                        border: 'none',
                        padding: '10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(3,105,161,0.3)',
                      }}
                    >
                      🌊 Load Live Conditions
                    </button>
                  )}

                  {c && (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '10px',
                          background: 'rgba(15,23,42,0.6)',
                          borderRadius: '10px',
                          padding: '10px',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div style={{ textAlign: 'center', minWidth: '56px' }}>
                          <div style={{ fontSize: '30px', fontWeight: 'bold', color: SC(c.fishing_score), lineHeight: 1 }}>
                            {c.fishing_score}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: SC(c.fishing_score),
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                            }}
                          >
                            {SL(c.fishing_score)}
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          {c.score_breakdown?.components &&
                            Object.entries(c.score_breakdown.components)
                              .slice(0, 3)
                              .map(([k, v]) => (
                                <Bar key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
                              ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {TB('score', '📊')}
                        {TB('water', '💧')}
                        {TB('atmosphere', '🌤')}
                        {spot.water_type !== 'freshwater' && TB('marine', '🌊')}
                        {TB('bite', '🌙')}
                        {TB('forecast', '📅')}
                        {TB('ai', 'AI')}
                        {TB('identify', 'ID')}
                        {TB('log', '🎣')}
                      </div>

                      {tab === 'score' && (
                        <div>
                          {c.score_breakdown?.components &&
                            Object.entries(c.score_breakdown.components).map(([k, v]) => (
                              <Bar key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
                            ))}
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '8px',
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: '6px',
                            }}
                          >
                            {c.score_breakdown?.recommendations?.map((r, i) => (
                              <p key={i} style={{ color: '#4ade80', fontSize: '10px', margin: '3px 0' }}>
                                ✓ {r}
                              </p>
                            ))}
                            {c.score_breakdown?.warnings?.map((w, i) => (
                              <p key={i} style={{ color: '#f87171', fontSize: '10px', margin: '3px 0' }}>
                                ⚠ {w}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {tab === 'water' && (
                        <div>
                          <Depth l={c.water_level_m} f={c.flow_rate_cfs} />
                          <Row
                            icon="🌡"
                            label="Water Temp"
                            value={c.water_temp_c}
                            unit="°C"
                            hi={c.water_temp_c !== null && c.water_temp_c >= 15 && c.water_temp_c <= 25 ? '#4ade80' : '#f87171'}
                          />
                          <Row
                            icon="💨"
                            label="Dissolved Oxygen"
                            value={c.dissolved_oxygen_mgl}
                            unit="mg/L"
                            hi={c.dissolved_oxygen_mgl !== null && c.dissolved_oxygen_mgl >= 7 ? '#4ade80' : '#f87171'}
                          />
                          <Row
                            icon="📏"
                            label="Water Level"
                            value={c.water_level_m !== null ? c.water_level_m.toFixed(2) : null}
                            unit="m"
                          />
                          <Row
                            icon="🌊"
                            label="Flow Rate"
                            value={c.flow_rate_cfs !== null ? c.flow_rate_cfs.toFixed(0) : null}
                            unit="cfs"
                          />
                          <Row
                            icon="🧪"
                            label="pH"
                            value={c.ph}
                            hi={c.ph !== null && c.ph >= 6.5 && c.ph <= 8.5 ? '#4ade80' : '#eab308'}
                          />
                          <Row icon="🌫" label="Turbidity" value={c.turbidity_ntu} unit="NTU" />
                          <Row
                            icon="↕"
                            label="Tide Height"
                            value={c.tide_height_m !== null ? c.tide_height_m.toFixed(2) : null}
                            unit="m"
                          />
                          <Row icon="🌊" label="Tide State" value={c.tide_type} />
                        </div>
                      )}

                      {tab === 'atmosphere' && (
                        <div>
                          <Row icon="🌡" label="Air Temp" value={c.air_temp_c} unit="°C" />
                          <Row
                            icon="🔵"
                            label="Pressure"
                            value={c.pressure_hpa}
                            unit="hPa"
                            hi={c.pressure_hpa !== null && c.pressure_hpa >= 1010 ? '#4ade80' : '#f87171'}
                          />
                          <Row icon="💧" label="Humidity" value={c.humidity_pct} unit="%" />
                          <Row
                            icon="💨"
                            label="Wind Speed"
                            value={c.wind_speed_ms !== null ? c.wind_speed_ms.toFixed(1) : null}
                            unit="m/s"
                            hi={
                              c.wind_speed_ms !== null && c.wind_speed_ms <= 6
                                ? '#4ade80'
                                : c.wind_speed_ms !== null && c.wind_speed_ms <= 10
                                  ? '#eab308'
                                  : '#f87171'
                            }
                          />
                          <Row icon="🧭" label="Wind Dir" value={c.wind_dir_deg} unit="°" />
                        </div>
                      )}

                      {tab === 'marine' && (
                        <div>
                          <Row
                            icon="🌊"
                            label="Wave Height"
                            value={c.wave_height_m !== null ? c.wave_height_m.toFixed(2) : null}
                            unit="m"
                            hi={c.wave_height_m !== null && c.wave_height_m <= 1 ? '#4ade80' : '#f87171'}
                          />
                          <Row
                            icon="⏱"
                            label="Wave Period"
                            value={c.wave_period_s !== null ? c.wave_period_s.toFixed(1) : null}
                            unit="s"
                          />
                          <Row icon="🧭" label="Swell Direction" value={c.swell_direction_deg} unit="°" />
                          <Row
                            icon="↕"
                            label="Tide Height"
                            value={c.tide_height_m !== null ? c.tide_height_m.toFixed(2) : null}
                            unit="m"
                          />
                          <Row icon="🌊" label="Tide State" value={c.tide_type} />
                        </div>
                      )}

                      {tab === 'bite' && (
                        <BiteTimePanel
                          lat={spot.lat}
                          lng={spot.lng}
                          conditions={{
                            water_temp_c: c.water_temp_c,
                            pressure_hpa: c.pressure_hpa,
                            wind_speed_ms: c.wind_speed_ms,
                            dissolved_oxygen_mgl: c.dissolved_oxygen_mgl,
                            is_daytime: new Date().getHours() > 6 && new Date().getHours() < 20,
                          }}
                        />
                      )}

                      {tab === 'forecast' && <SevenDayForecast lat={spot.lat} lng={spot.lng} />}
                      {tab === 'log' && <CatchLogger spotId={spot.id} spotName={spot.name} lat={spot.lat} lng={spot.lng} />}
                      {tab === 'ai' && <FishBot spot={spot} conditions={c} />}
                      {tab === 'identify' && <FishIdentifier />}

                      <div
                        style={{
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <p style={{ color: '#4b5563', fontSize: '9px', margin: 0 }}>
                          Sources: {c.data_sources?.join(' · ')}
                        </p>
                        <p style={{ color: '#374151', fontSize: '9px', margin: 0 }}>
                          {c.cached ? '📦 Cached' : '🔴 Live'} ·{' '}
                          {c.captured_at ? new Date(c.captured_at).toLocaleTimeString() : ''}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
        }
        .leaflet-popup-tip {
          background: rgba(17,24,39,0.95) !important;
        }
      `}</style>
    </div>
  );
}
