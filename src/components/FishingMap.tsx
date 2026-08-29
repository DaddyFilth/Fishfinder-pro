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

type BaseLayer = 'satellite' | 'terrain';

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
      <div style={{ background: '#1f2937', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${value}%`,
            background: c,
            height: '100%',
            borderRadius: '4px',
            transition: 'width .4s ease',
            boxShadow: `0 0 16px ${c}66`,
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
        borderBottom: '1px solid rgba(255,255,255,0.07)',
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
        background: 'rgba(15,23,42,0.9)',
        border: `1px solid ${c}`,
        borderRadius: '10px',
        padding: '10px',
        marginBottom: '10px',
        boxShadow: `0 0 0 1px ${c}22 inset, 0 12px 30px rgba(0,0,0,0.2)`,
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
            transition: 'width .5s ease',
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
}

export default function FishingMap({ spots }: { spots: Spot[] }) {
  const [conditions, setConditions] = useState<Record<string, Cond>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('terrain');
  const [layers, setLayers] = useState({
    depth: false,
    waterTemp: false,
    waypoints: true,
    clouds: false,
  });

  const baseLayers: Record<
    BaseLayer,
    {
      url: string;
      attribution: string;
      label: string;
      maxZoom?: number;
    }
  > = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles © Esri',
      label: '🛰️ Satellite',
      maxZoom: 18,
    },
    terrain: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      label: '🌍 Explorer',
      maxZoom: 19,
    },
  };

  const rankedSpots = useMemo(
    () =>
      spots
        .filter((spot) => conditions[spot.id])
        .map((spot) => ({ ...spot, score: conditions[spot.id].fishing_score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3),
    [spots, conditions]
  );

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
      const next = { ...p };
      delete next[id];
      return next;
    });
    load(id);
  };

  useEffect(() => {
    spots.forEach((spot) => {
      load(spot.id);
    });
  }, [spots]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((p) => ({ ...p, [key]: !p[key] }));
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', background: '#020617' }}>
      <style>{`
        .fishing-map-shell .leaflet-container {
          background: #020617;
          filter: saturate(1.05) contrast(1.04);
        }
        .fishing-map-shell .leaflet-control-zoom,
        .fishing-map-shell .leaflet-control-attribution {
          opacity: 0.92;
        }
        .fishing-map-shell .leaflet-popup-content-wrapper,
        .fishing-map-shell .leaflet-popup-tip {
          background: transparent;
          box-shadow: none;
        }
        .fishing-map-shell .leaflet-tile {
          transition: filter .3s ease, opacity .3s ease;
        }
        .aurora-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 350;
          background:
            radial-gradient(circle at 20% 20%, rgba(34,197,94,0.14), transparent 28%),
            radial-gradient(circle at 80% 18%, rgba(14,165,233,0.14), transparent 24%),
            radial-gradient(circle at 50% 80%, rgba(59,130,246,0.14), transparent 26%);
          animation: driftGlow 14s ease-in-out infinite alternate;
          mix-blend-mode: screen;
        }
        .scanline-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 351;
          background: linear-gradient(to bottom, rgba(255,255,255,0.025), rgba(255,255,255,0));
          background-size: 100% 6px;
          opacity: 0.25;
        }
        .hud-card {
          background: rgba(7, 12, 24, 0.72);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(16px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.28);
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 0 rgba(34,197,94,0.7);
          animation: pulse 2.2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes driftGlow {
          0% { transform: scale(1) translate3d(0,0,0); opacity: .75; }
          100% { transform: scale(1.05) translate3d(-1.5%, 1.5%, 0); opacity: 1; }
        }
      `}</style>

      <div className="fishing-map-shell" style={{ position: 'absolute', inset: 0 }}>
        <div className="aurora-overlay" />
        <div className="scanline-overlay" />

        <div
          className="hud-card"
          style={{
            position: 'absolute',
            top: '18px',
            left: '18px',
            zIndex: 1600,
            borderRadius: '16px',
            padding: '14px 16px',
            minWidth: '240px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div className="pulse-dot" />
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '15px', letterSpacing: '0.02em' }}>FishFinder Live</div>
              <div style={{ color: '#94a3b8', fontSize: '11px' }}>Cinematic fishing intelligence overlay</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(Object.keys(baseLayers) as BaseLayer[]).map((key) => (
              <button
                key={key}
                onClick={() => setBaseLayer(key)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '999px',
                  border: `1px solid ${baseLayer === key ? 'rgba(45,212,191,0.9)' : 'rgba(255,255,255,0.12)'}`,
                  background: baseLayer === key ? 'rgba(13,148,136,0.26)' : 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {baseLayers[key].label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="hud-card"
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            zIndex: 1600,
            borderRadius: '16px',
            padding: '14px 16px',
            width: '260px',
          }}
        >
          <div style={{ color: 'white', fontSize: '13px', fontWeight: 800, marginBottom: '10px' }}>Top bite zones</div>
          {rankedSpots.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>Loading live scoring...</div>
          ) : (
            rankedSpots.map((spot, index) => (
              <div
                key={spot.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: index === rankedSpots.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div>
                  <div style={{ color: 'white', fontSize: '12px', fontWeight: 700 }}>{spot.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: '10px' }}>{spot.water_type}</div>
                </div>
                <div
                  style={{
                    color: SC(spot.score),
                    fontWeight: 800,
                    fontSize: '13px',
                    textShadow: `0 0 18px ${SC(spot.score)}55`,
                  }}
                >
                  {spot.score}
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            position: 'absolute',
            left: sidebarOpen ? 18 : -290,
            bottom: 18,
            zIndex: 1700,
            width: 272,
            transition: 'left .28s ease',
          }}
        >
          <div className="hud-card" style={{ borderRadius: '18px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>Overlay controls</div>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '18px' }}
              >
                ×
              </button>
            </div>

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
                  width: '100%',
                  padding: '11px 12px',
                  marginBottom: '8px',
                  background: layers[key] ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${layers[key] ? 'rgba(96,165,250,0.65)' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <span>{label}</span>
                <span style={{ color: layers[key] ? '#bfdbfe' : '#64748b', fontSize: '10px' }}>{layers[key] ? 'ON' : 'OFF'}</span>
              </button>
            ))}
          </div>
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="hud-card"
            style={{
              position: 'absolute',
              left: 18,
              bottom: 18,
              zIndex: 1700,
              borderRadius: '999px',
              padding: '10px 14px',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.14)',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '12px',
            }}
          >
            ☰ Controls
          </button>
        )}

        <MapContainer center={[35.5, -97.5]} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl>
          <TileLayer
            key={baseLayer}
            attribution={baseLayers[baseLayer].attribution}
            url={baseLayers[baseLayer].url}
            maxZoom={baseLayers[baseLayer].maxZoom}
          />

          <DepthOverlay enabled={layers.depth} />
          <WaterTempOverlay points={temperaturePoints} enabled={layers.waterTemp} />
          {layers.waypoints && <WaypointMarkers />}

          {spots.map((spot) => {
            const c = conditions[spot.id];
            const activeTab = tabs[spot.id] || 'score';

            return (
              <Marker
                key={spot.id}
                position={[spot.lat, spot.lng]}
                eventHandlers={{
                  click: () => load(spot.id),
                }}
              >
                <Popup maxWidth={340} minWidth={300}>
                  <div
                    style={{
                      minWidth: '300px',
                      maxHeight: '420px',
                      overflowY: 'auto',
                      fontFamily: 'system-ui, sans-serif',
                      background: 'rgba(3,7,18,0.96)',
                      margin: '-12px',
                      padding: '12px',
                      borderRadius: '14px',
                      color: '#f9fafb',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                      backdropFilter: 'blur(18px)',
                    }}
                  >
                    <div style={{ marginBottom: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{spot.name}</h3>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>
                        {spot.water_type} • {spot.spot_type}
                      </div>
                    </div>

                    {loading[spot.id] && (
                      <div style={{ textAlign: 'center', padding: '18px', color: '#9ca3af' }}>Loading conditions...</div>
                    )}

                    {errors[spot.id] && (
                      <div
                        style={{
                          background: '#7f1d1d',
                          border: '1px solid #dc2626',
                          borderRadius: '8px',
                          padding: '10px',
                        }}
                      >
                        <div style={{ fontSize: '12px', marginBottom: '8px' }}>Failed to load: {errors[spot.id]}</div>
                        <button
                          onClick={() => retry(spot.id)}
                          style={{
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {c && (
                      <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                          {([
                            ['score', '🎯'],
                            ['water', '💧'],
                            ['atmosphere', '🌤'],
                            ['marine', '🌊'],
                            ['bite', '🐟'],
                            ['forecast', '📅'],
                            ['log', '📝'],
                            ['ai', '🤖'],
                            ['identify', '📷'],
                          ] as [Tab, string][]).map(([tab, icon]) => (
                            <button
                              key={tab}
                              onClick={() => setTabs((p) => ({ ...p, [spot.id]: tab }))}
                              style={{
                                background: activeTab === tab ? '#0f766e' : '#111827',
                                color: activeTab === tab ? 'white' : '#9ca3af',
                                border: `1px solid ${activeTab === tab ? '#14b8a6' : '#374151'}`,
                                borderRadius: '999px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                              }}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>

                        {activeTab === 'score' && (
                          <>
                            <div
                              style={{
                                background: `linear-gradient(135deg,${SC(c.fishing_score)}20,${SC(c.fishing_score)}08)`,
                                border: `1px solid ${SC(c.fishing_score)}50`,
                                borderRadius: '10px',
                                padding: '12px',
                                marginBottom: '10px',
                                textAlign: 'center',
                              }}
                            >
                              <div style={{ fontSize: '28px', fontWeight: '800', color: SC(c.fishing_score), lineHeight: 1 }}>
                                {c.fishing_score}
                              </div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: SC(c.fishing_score) }}>
                                {SL(c.fishing_score)}
                              </div>
                            </div>

                            <Depth l={c.water_level_m} f={c.flow_rate_cfs} />

                            {Object.entries(c.score_breakdown.components).map(([k, v]) => (
                              <Bar key={k} label={k.replace(/_/g, ' ')} value={v} />
                            ))}

                            {c.score_breakdown.recommendations.length > 0 && (
                              <div style={{ marginTop: '10px' }}>
                                <div style={{ fontSize: '11px', color: '#86efac', marginBottom: '4px', fontWeight: '700' }}>
                                  Recommendations
                                </div>
                                {c.score_breakdown.recommendations.map((r, i) => (
                                  <div key={i} style={{ fontSize: '11px', color: '#d1fae5', marginBottom: '3px' }}>
                                    • {r}
                                  </div>
                                ))}
                              </div>
                            )}

                            {c.score_breakdown.warnings.length > 0 && (
                              <div style={{ marginTop: '10px' }}>
                                <div style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '4px', fontWeight: '700' }}>
                                  Warnings
                                </div>
                                {c.score_breakdown.warnings.map((w, i) => (
                                  <div key={i} style={{ fontSize: '11px', color: '#fecaca', marginBottom: '3px' }}>
                                    • {w}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {activeTab === 'water' && (
                          <>
                            <Row icon="🌡" label="Water temp" value={c.water_temp_c?.toFixed(1) ?? null} unit="°C" />
                            <Row icon="🫧" label="Dissolved oxygen" value={c.dissolved_oxygen_mgl?.toFixed(1) ?? null} unit="mg/L" />
                            <Row icon="🌫" label="Turbidity" value={c.turbidity_ntu?.toFixed(1) ?? null} unit="NTU" />
                            <Row icon="⚗️" label="pH" value={c.ph?.toFixed(1) ?? null} />
                            <Row icon="📏" label="Water level" value={c.water_level_m?.toFixed(2) ?? null} unit="m" />
                            <Row icon="🚰" label="Flow rate" value={c.flow_rate_cfs?.toFixed(0) ?? null} unit="cfs" />
                          </>
                        )}

                        {activeTab === 'atmosphere' && (
                          <>
                            <Row icon="🌤" label="Air temp" value={c.air_temp_c?.toFixed(1) ?? null} unit="°C" />
                            <Row icon="💨" label="Wind speed" value={c.wind_speed_ms?.toFixed(1) ?? null} unit="m/s" />
                            <Row icon="🧭" label="Wind direction" value={c.wind_dir_deg?.toFixed(0) ?? null} unit="°" />
                            <Row icon="🌡" label="Pressure" value={c.pressure_hpa?.toFixed(0) ?? null} unit="hPa" />
                            <Row icon="💧" label="Humidity" value={c.humidity_pct?.toFixed(0) ?? null} unit="%" />
                          </>
                        )}

                        {activeTab === 'marine' && (
                          <>
                            <Row icon="🌊" label="Wave height" value={c.wave_height_m?.toFixed(2) ?? null} unit="m" />
                            <Row icon="⏱" label="Wave period" value={c.wave_period_s?.toFixed(1) ?? null} unit="s" />
                            <Row icon="🧭" label="Swell direction" value={c.swell_direction_deg?.toFixed(0) ?? null} unit="°" />
                            <Row icon="🌙" label="Tide height" value={c.tide_height_m?.toFixed(2) ?? null} unit="m" />
                            <Row icon="🔁" label="Tide type" value={c.tide_type} />
                          </>
                        )}

                        {activeTab === 'bite' && <BiteTimePanel lat={spot.lat} lng={spot.lng} conditions={c} />}
                        {activeTab === 'forecast' && <SevenDayForecast lat={spot.lat} lng={spot.lng} />}
                        {activeTab === 'log' && <CatchLogger spotId={spot.id} spotName={spot.name} lat={spot.lat} lng={spot.lng} />}
                        {activeTab === 'ai' && <FishBot spot={spot} conditions={c} />}
                        {activeTab === 'identify' && <FishIdentifier />}

                        <div style={{ marginTop: '10px', fontSize: '10px', color: '#6b7280' }}>
                          {c.cached ? 'Cached' : 'Live'} • {new Date(c.captured_at).toLocaleString()}
                        </div>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
