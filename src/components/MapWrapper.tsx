'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
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
import { type Spot } from '@/lib/mapFilters';

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Shared style constants ───────────────────────────────────────────────────
const S = {
  popupWrap: {
    minWidth: '300px',
    maxHeight: '430px',
    overflowY: 'auto',
    fontFamily: 'system-ui, sans-serif',
    background: 'rgba(3,7,18,0.96)',
    margin: '-12px',
    padding: '12px',
    borderRadius: '14px',
    color: '#f8fafc',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(18px)',
  } as React.CSSProperties,

  tabBtn: (active: boolean): React.CSSProperties => ({
    background: active ? '#0f766e' : '#111827',
    color: active ? 'white' : '#9ca3af',
    border: `1px solid ${active ? '#14b8a6' : '#374151'}`,
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
  }),

  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  } as React.CSSProperties,

  metricLabel: { fontSize: '11px', color: '#94a3b8' } as React.CSSProperties,
  metricValue: { fontSize: '12px', fontWeight: 700, color: '#f8fafc' } as React.CSSProperties,

  retryBox: {
    background: '#7f1d1d',
    border: '1px solid #dc2626',
    borderRadius: 8,
    padding: 10,
  } as React.CSSProperties,

  retryBtn: {
    background: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,
} as const;

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

export type BaseLayer = 'satellite' | 'explore';

export interface MapLayers {
  hotspots: boolean;
  depth: boolean;
  waterTemp: boolean;
  catchPins: boolean;
  waypoints: boolean;
}

const scoreColor = (s: number) => (s >= 75 ? '#22c55e' : s >= 50 ? '#eab308' : s >= 25 ? '#f97316' : '#ef4444');
const scoreLabel = (s: number) => (s >= 75 ? 'Excellent' : s >= 50 ? 'Good' : s >= 25 ? 'Fair' : 'Poor');

function depthLabel(level: number | null, flow: number | null) {
  if (level !== null) {
    if (level < 0.3) return 'Very Shallow';
    if (level < 0.9) return 'Shallow';
    if (level < 2.4) return 'Moderate';
    if (level < 6) return 'Deep';
    return 'Very Deep';
  }
  if (flow !== null) {
    if (flow < 50) return 'Very Low Flow';
    if (flow < 300) return 'Low Flow';
    if (flow < 1000) return 'Moderate Flow';
    if (flow < 5000) return 'High Flow';
    return 'Flood Stage';
  }
  return 'No depth data';
}

function metricRow({ icon, label, value, unit }: { icon: string; label: string; value: string | number | null; unit?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{icon} {label}</span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

function scoreBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8', marginBottom: '3px' }}>
        <span>{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: '999px', boxShadow: `0 0 18px ${color}88` }} />
      </div>
    </div>
  );
}

export default function FishingMap({
  spots,
  baseLayer,
  layers,
  userLocation,
  selectedSpot,
  sheetOpen = false,
  onSpotSelect,
  onPopupOpen,
  onPopupClose,
}: {
  spots: Spot[];
  baseLayer: BaseLayer;
  layers: MapLayers;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedSpot?: Spot | null;
  sheetOpen?: boolean;
  onSpotSelect?: (spot: Spot) => void;
  onPopupOpen?: (spot: Spot) => void;
  onPopupClose?: () => void;
}) {
  const showMapHud = !sheetOpen && !selectedSpot;
  const openDirections = (spot: Spot) => {
    const origin = userLocation ? `${userLocation.latitude},${userLocation.longitude}` : 'Current Location';
    const destination = `${spot.lat},${spot.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const [conditions, setConditions] = useState<Record<string, Cond>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tabs, setTabs] = useState<Record<string, Tab>>({});
  const baseLayers: Record<BaseLayer, { url: string; attribution: string; label: string; maxZoom?: number }> = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles © Esri',
      label: 'Satellite',
      maxZoom: 18,
    },
    explore: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      label: 'Explore',
      maxZoom: 19,
    },
  };

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

  const rankedSpots = useMemo(
    () =>
      spots
        .filter((spot) => conditions[spot.id])
        .map((spot) => ({ spot, score: conditions[spot.id].fishing_score }))
        .sort((a, b) => b.score - a.score),
    [spots, conditions]
  );

  const hotSpots = rankedSpots.slice(0, 6);
  const recentPins = rankedSpots.slice(0, 18);
  const liveFeeds = rankedSpots.length;

  const load = useCallback(async (id: string) => {
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
  }, [conditions, loading]);

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
    spots.forEach((spot) => load(spot.id));
  }, [load, spots]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', background: '#020617' }}>
      <style>{`
        .premium-map .leaflet-container {
          background: #020617;
          filter: saturate(1.1) contrast(1.03);
        }
        .premium-map .leaflet-popup-content-wrapper,
        .premium-map .leaflet-popup-tip {
          background: transparent;
          box-shadow: none;
        }
        .premium-map .leaflet-control-container {
          z-index: 600;
        }
        .hud {
          background: rgba(7, 12, 24, 0.72);
          border: 1px solid rgba(255,255,255,0.12);
          backdrop-filter: blur(18px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.32);
        }
        .map-glow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 300;
          background:
            radial-gradient(circle at 20% 18%, rgba(34,197,94,0.12), transparent 24%),
            radial-gradient(circle at 78% 14%, rgba(14,165,233,0.12), transparent 22%),
            radial-gradient(circle at 55% 82%, rgba(59,130,246,0.14), transparent 26%);
          mix-blend-mode: screen;
          animation: drift 16s ease-in-out infinite alternate;
        }
        .map-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 301;
          box-shadow: inset 0 0 140px rgba(2,6,23,0.6);
        }
        .pulse {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 0 0 rgba(34,197,94,0.7);
          animation: pulse 2.1s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70% { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes drift {
          0% { transform: translate3d(0,0,0) scale(1); opacity: 0.78; }
          100% { transform: translate3d(-1.5%, 1.2%, 0) scale(1.04); opacity: 1; }
        }
      `}</style>

      <div className="premium-map" style={{ position: 'absolute', inset: 0 }}>
        <div className="map-glow" />
        <div className="map-vignette" />

        <div className="hud" aria-hidden={!showMapHud} style={{ position: 'absolute', top: 18, left: 18, zIndex: 1600, borderRadius: 18, padding: '14px 16px', minWidth: 265, pointerEvents: 'none', opacity: showMapHud ? 1 : 0, transform: showMapHud ? 'translateY(0)' : 'translateY(-10px)', transition: 'opacity 0.18s ease, transform 0.18s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="pulse" />
            <div>
              <div style={{ color: 'white', fontSize: 15, fontWeight: 800 }}>Oklahoma Fishfinder Pro Map</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Public waters, catches, contours, and Oklahoma fishing intelligence</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1' }}>
            <span>Spots tracked</span>
            <span style={{ color: 'white', fontWeight: 700 }}>{spots.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
            <span>Live feeds</span>
            <span style={{ color: '#22c55e', fontWeight: 700 }}>{liveFeeds}</span>
          </div>
        </div>

        <MapContainer center={[35.5, -97.5]} zoom={7} minZoom={6} style={{ height: '100%', width: '100%' }} zoomControl>
          <TileLayer
            key={baseLayer}
            attribution={baseLayers[baseLayer].attribution}
            url={baseLayers[baseLayer].url}
            maxZoom={baseLayers[baseLayer].maxZoom}
          />

          {userLocation && (
            <>
              <CircleMarker
                center={[userLocation.latitude, userLocation.longitude]}
                radius={8}
                pathOptions={{ color: '#38bdf8', fillColor: '#0284c7', fillOpacity: 1, weight: 3 }}
              >
                <Popup><strong>Your location</strong></Popup>
              </CircleMarker>
              <CircleMarker
                center={[userLocation.latitude, userLocation.longitude]}
                radius={22}
                pathOptions={{ color: '#38bdf8', fillColor: '#38bdf8', fillOpacity: 0.12, weight: 1 }}
              />
            </>
          )}

          {layers.depth && <DepthOverlay enabled={true} />}
          {layers.waterTemp && <WaterTempOverlay points={temperaturePoints} enabled={true} />}
          {layers.waypoints && <WaypointMarkers />}

          {layers.hotspots && hotSpots.map(({ spot, score }) => (
            <CircleMarker
              key={`hot-${spot.id}`}
              center={[spot.lat, spot.lng]}
              radius={Math.max(10, Math.min(22, 8 + score / 8))}
              pathOptions={{
                color: scoreColor(score),
                fillColor: scoreColor(score),
                fillOpacity: 0.18,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 800 }}>{spot.name}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Hotspot confidence: {score}</div>
                      <button type="button" onClick={() => openDirections(spot)} style={{ background: '#0f766e', color: 'white', border: 0, borderRadius: 7, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Get directions</button>
                    </div>
              </Popup>
            </CircleMarker>
          ))}

          {layers.catchPins && recentPins.map(({ spot, score }) => (
            <CircleMarker
              key={`pin-${spot.id}`}
              center={[spot.lat, spot.lng]}
              radius={4}
              pathOptions={{
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: 0.9,
                weight: 1,
              }}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 800 }}>{spot.name}</div>
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Recent catch activity signal • score {score}</div>
                      <button type="button" onClick={() => openDirections(spot)} style={{ background: '#0f766e', color: 'white', border: 0, borderRadius: 7, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Get directions</button>
                    </div>
              </Popup>
            </CircleMarker>
          ))}

          {spots.map((spot) => {
            const c = conditions[spot.id];
            const activeTab = tabs[spot.id] || 'score';

            return (
              <Marker key={spot.id} position={[spot.lat, spot.lng]} eventHandlers={{ click: () => { load(spot.id); onSpotSelect?.(spot); onPopupOpen?.(spot); } }}>
                <Popup maxWidth={360} minWidth={310} eventHandlers={{ add: () => onPopupOpen?.(spot), remove: () => onPopupClose?.() }}>
                  <div style={S.popupWrap}>
                    <div style={{ marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{spot.name}</h3>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{spot.water_type} • {spot.spot_type} • {spot.access_type ?? 'Public access'}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{spot.region ?? 'Oklahoma'} · {spot.notes ?? 'Verify current access and regulations before traveling.'}</div>
                      <button type="button" onClick={() => openDirections(spot)} style={{ marginTop: 10, background: '#0f766e', color: 'white', border: 0, borderRadius: 7, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Get directions</button>
                    </div>

                    {loading[spot.id] && <div style={{ textAlign: 'center', padding: 18, color: '#94a3b8' }}>Loading conditions...</div>}

                    {errors[spot.id] && (
                      <div style={S.retryBox}>
                        <div style={{ fontSize: 12, marginBottom: 8 }}>Failed to load: {errors[spot.id]}</div>
                        <button
                          onClick={() => retry(spot.id)}
                          style={S.retryBtn}
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {c && (
                      <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
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
                              style={S.tabBtn(activeTab === tab)}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>

                        {activeTab === 'score' && (
                          <>
                            <div
                              style={{
                                background: `linear-gradient(135deg,${scoreColor(c.fishing_score)}20,${scoreColor(c.fishing_score)}08)`,
                                border: `1px solid ${scoreColor(c.fishing_score)}50`,
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 10,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(c.fishing_score), lineHeight: 1 }}>{c.fishing_score}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor(c.fishing_score) }}>{scoreLabel(c.fishing_score)}</div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 11, color: '#cbd5e1' }}>
                                  <div>{depthLabel(c.water_level_m, c.flow_rate_cfs)}</div>
                                  <div>{c.cached ? 'Cached feed' : 'Live feed'}</div>
                                </div>
                              </div>
                            </div>

                            {Object.entries(c.score_breakdown.components).map(([k, v]) => scoreBar({ label: k.replace(/_/g, ' '), value: v }))}

                            {c.score_breakdown.recommendations.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 11, color: '#86efac', marginBottom: 4, fontWeight: 700 }}>Recommendations</div>
                                {c.score_breakdown.recommendations.map((r, i) => (
                                  <div key={i} style={{ fontSize: 11, color: '#d1fae5', marginBottom: 3 }}>• {r}</div>
                                ))}
                              </div>
                            )}
                            {c.score_breakdown.warnings.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 4, fontWeight: 700 }}>Warnings</div>
                                {c.score_breakdown.warnings.map((w, i) => (
                                  <div key={i} style={{ fontSize: 11, color: '#fecaca', marginBottom: 3 }}>• {w}</div>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {activeTab === 'water' && (
                          <>
                            {metricRow({ icon: '🌡', label: 'Water temp', value: c.water_temp_c != null ? (c.water_temp_c * 9 / 5 + 32).toFixed(1) : null, unit: '°F' })}
                            {metricRow({ icon: '🫧', label: 'Dissolved oxygen', value: c.dissolved_oxygen_mgl?.toFixed(1) ?? null, unit: 'mg/L' })}
                            {metricRow({ icon: '🌫', label: 'Turbidity', value: c.turbidity_ntu?.toFixed(1) ?? null, unit: 'NTU' })}
                            {metricRow({ icon: '⚗️', label: 'pH', value: c.ph?.toFixed(1) ?? null })}
                            {metricRow({ icon: '📏', label: 'Water level', value: c.water_level_m?.toFixed(2) ?? null, unit: 'm' })}
                            {metricRow({ icon: '🚰', label: 'Flow rate', value: c.flow_rate_cfs?.toFixed(0) ?? null, unit: 'cfs' })}
                          </>
                        )}

                        {activeTab === 'atmosphere' && (
                          <>
                            {metricRow({ icon: '🌤', label: 'Air temp', value: c.air_temp_c != null ? (c.air_temp_c * 9 / 5 + 32).toFixed(1) : null, unit: '°F' })}
                            {metricRow({ icon: '💨', label: 'Wind speed', value: c.wind_speed_ms?.toFixed(1) ?? null, unit: 'm/s' })}
                            {metricRow({ icon: '🧭', label: 'Wind direction', value: c.wind_dir_deg?.toFixed(0) ?? null, unit: '°' })}
                            {metricRow({ icon: '🌡', label: 'Pressure', value: c.pressure_hpa?.toFixed(0) ?? null, unit: 'hPa' })}
                            {metricRow({ icon: '💧', label: 'Humidity', value: c.humidity_pct?.toFixed(0) ?? null, unit: '%' })}
                          </>
                        )}

                        {activeTab === 'marine' && (
                          <>
                            {metricRow({ icon: '🌊', label: 'Wave height', value: c.wave_height_m?.toFixed(2) ?? null, unit: 'm' })}
                            {metricRow({ icon: '⏱', label: 'Wave period', value: c.wave_period_s?.toFixed(1) ?? null, unit: 's' })}
                            {metricRow({ icon: '🧭', label: 'Swell direction', value: c.swell_direction_deg?.toFixed(0) ?? null, unit: '°' })}
                            {metricRow({ icon: '🌙', label: 'Tide height', value: c.tide_height_m?.toFixed(2) ?? null, unit: 'm' })}
                            {metricRow({ icon: '🔁', label: 'Tide type', value: c.tide_type })}
                          </>
                        )}

                        {activeTab === 'bite' && <BiteTimePanel lat={spot.lat} lng={spot.lng} conditions={c} />}
                        {activeTab === 'forecast' && <SevenDayForecast lat={spot.lat} lng={spot.lng} />}
                        {activeTab === 'log' && <CatchLogger spotId={spot.id} spotName={spot.name} lat={spot.lat} lng={spot.lng} />}
                        {activeTab === 'ai' && <FishBot spot={spot} conditions={c} />}
                        {activeTab === 'identify' && <FishIdentifier />}

                        <div style={{ marginTop: 10, fontSize: 10, color: '#6b7280' }}>
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
