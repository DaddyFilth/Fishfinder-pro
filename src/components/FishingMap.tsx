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
}

export default function FishingMap({ spots }: { spots: Spot[] }) {
  const [conditions, setConditions] = useState<Record<string, Cond>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('street');
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

  const baseLayers: Record<
    BaseLayer,
    {
      url: string;
      attribution: string;
      label: string;
      maxZoom?: number;
      subdomains?: string[];
    }
  > = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      label: '🛰️ Satellite',
      maxZoom: 18,
    },
    terrain: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      label: '⛰️ Terrain',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    },
    street: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      label: '🗺️ Street',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
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
      )}

      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 1500,
          display: 'flex',
          gap: '8px',
          background: 'rgba(10,15,25,0.82)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        }}
      >
        {(Object.keys(baseLayers) as BaseLayer[]).map((key) => (
          <button
            key={key}
            onClick={() => setBaseLayer(key)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: baseLayer === key ? '#14b8a6' : 'rgba(255,255,255,0.12)',
              background: baseLayer === key ? '#0f766e' : 'rgba(255,255,255,0.04)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {baseLayers[key].label}
          </button>
        ))}
      </div>

      <MapContainer center={[35.5, -97.5]} zoom={7} style={{ height: '100%', width: '100%' }} zoomControl>
        <TileLayer
          key={baseLayer}
          attribution={baseLayers[baseLayer].attribution}
          url={baseLayers[baseLayer].url}
          maxZoom={baseLayers[baseLayer].maxZoom}
          subdomains={baseLayers[baseLayer].subdomains}
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
                    background: '#030712',
                    margin: '-12px',
                    padding: '12px',
                    borderRadius: '12px',
                    color: '#f9fafb',
                  }}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{spot.name}</h3>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>
                      {spot.water_type} • {spot.spot_type}
                    </div>
                  </div>

                  {loading[spot.id] && (
                    <div style={{ textAlign: 'center', padding: '18px', color: '#9ca3af' }}>
                      Loading conditions...
                    </div>
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
                      <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                        Failed to load: {errors[spot.id]}
                      </div>
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
                            <div
                              style={{
                                fontSize: '28px',
                                fontWeight: '800',
                                color: SC(c.fishing_score),
                                lineHeight: 1,
                              }}
                            >
                              {c.fishing_score}
                            </div>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: '700',
                                color: SC(c.fishing_score),
                              }}
                            >
                              {SL(c.fishing_score)}
                            </div>
                          </div>

                          <Depth l={c.water_level_m} f={c.flow_rate_cfs} />

                          {Object.entries(c.score_breakdown.components).map(([k, v]) => (
                            <Bar key={k} label={k.replace(/_/g, ' ')} value={v} />
                          ))}

                          {c.score_breakdown.recommendations.length > 0 && (
                            <div style={{ marginTop: '10px' }}>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#86efac',
                                  marginBottom: '4px',
                                  fontWeight: '700',
                                }}
                              >
                                Recommendations
                              </div>
                              {c.score_breakdown.recommendations.map((r, i) => (
                                <div
                                  key={i}
                                  style={{
                                    fontSize: '11px',
                                    color: '#d1fae5',
                                    marginBottom: '3px',
                                  }}
                                >
                                  • {r}
                                </div>
                              ))}
                            </div>
                          )}

                          {c.score_breakdown.warnings.length > 0 && (
                            <div style={{ marginTop: '10px' }}>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#fca5a5',
                                  marginBottom: '4px',
                                  fontWeight: '700',
                                }}
                              >
                                Warnings
                              </div>
                              {c.score_breakdown.warnings.map((w, i) => (
                                <div
                                  key={i}
                                  style={{
                                    fontSize: '11px',
                                    color: '#fecaca',
                                    marginBottom: '3px',
                                  }}
                                >
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
                          <Row
                            icon="🫧"
                            label="Dissolved oxygen"
                            value={c.dissolved_oxygen_mgl?.toFixed(1) ?? null}
                            unit="mg/L"
                          />
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
                          <Row
                            icon="🧭"
                            label="Swell direction"
                            value={c.swell_direction_deg?.toFixed(0) ?? null}
                            unit="°"
                          />
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
  );
}
