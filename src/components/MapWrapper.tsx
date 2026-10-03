'use client';



import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import HotZoneOverlay from '@/components/HotZoneOverlay';

import L from 'leaflet';
import BiteTimePanel from '@/components/BiteTimePanel';
import MapZoomControls from '@/components/MapZoomControls';
import SpotFocusController, { type SpotMarkerRegistry } from '@/components/SpotFocusController';
import WaypointMarkers from '@/components/WaypointMarkers';
import DepthOverlay from '@/components/DepthOverlay';
import FishBot from '@/components/ai/FishBot';
import FishIdentifier from '@/components/ai/FishIdentifier';
import CommunityPinsPanel from '@/components/CommunityPinsPanel';
import CatchLogger from '@/components/logbook/CatchLogger';
import SevenDayForecast from '@/components/SevenDayForecast';
import WaterTempOverlay from '@/components/WaterTempOverlay';
import MapDataSourceBadge, { type MapDataSourceMode } from '@/components/MapDataSourceBadge';
import { type Spot } from '@/lib/mapFilters';
import { fetchSpotConditions } from '@/lib/conditionsClient';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_Z_INDEX,
  OKLAHOMA_MAP_VIEW,
  resolveMapInsets,
  resolveSpotPopupFrame,
} from '@/lib/mapViewport';
import { SPECIES, biteRateFor, spotTargetsFor, deriveFishingCondition, type FishingCondition } from '@/lib/speciesCatalog';

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ─── Shared style constants ───────────────────────────────────────────────────
const S = {
  popupWrap: {
    // Visual shell only: the width/height caps are applied per render from `popupFrame` so the
    // CSS can never exceed the maxWidth/minWidth/maxHeight handed to Leaflet's Popup.
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

  /** "Get directions" call to action, shared by the spot popup and the two overlay popups. */
  directionsBtn: {
    background: '#0f766e',
    color: 'white',
    border: 0,
    borderRadius: 7,
    padding: '7px 10px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,

  /**
   * Floating status card. It steps aside for spot details and the sheet, and sits bottom-left
   * so it can never cover the zoom stack that occupies the middle-left of the map.
   */
  hud: (visible: boolean, sheetOpen: boolean): React.CSSProperties => ({
    position: 'absolute',
    bottom: sheetOpen ? 'calc(45dvh + 14px)' : 74,
    left: 14,
    zIndex: MAP_Z_INDEX.chrome,
    borderRadius: 18,
    padding: '14px 16px',
    minWidth: 265,
    maxWidth: 'min(320px, calc(100% - 28px))',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.18s ease, transform 0.18s ease, bottom 0.3s ease',
  }),
} as const;

interface Cond {
  fishing_score: number;
  bite_score?: number | null;
  bite_level?: string | null;
  ai_micro_spots?: Array<{
    name?: string;
    label?: string;
    description?: string;
    biteScore?: number;
    bite_score?: number;
    depth?: string;
    structure?: string;
  }>;
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
  data_mode?: 'provider' | 'cached' | 'stale-cache' | 'fallback' | 'unavailable' | 'ai-generated';
  stale?: boolean;
  warning?: string;
  captured_at: string | null;
}

/** The HUD and the overlay badge share one data-mode vocabulary. */
type SpotDataMode = MapDataSourceMode;

type Tab =
  | 'score'
  | 'water'
  | 'atmosphere'
  | 'marine'
  | 'bite'
  | 'forecast'
  | 'log'
  | 'ai'
  | 'identify'
  | 'community';

export type BaseLayer = 'satellite' | 'explore';

export interface MapLayers {
  hotspots: boolean;
  depth: boolean;
  waterTemp: boolean;
 conditionMarkers: boolean;
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

  // This is a score derived from provider values; it is not an observation or catch report.
  function conditionForSpot(condition: Cond | undefined): FishingCondition | null {
    return deriveFishingCondition(condition);
  }

function stableSpotVariant(id: Spot['id'], variantCount: number) {
  const key = String(id);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % variantCount;
}

function spotSpeciesTargets(spot: Spot, condition: Cond | undefined) {
  const fishingCondition = conditionForSpot(condition);
  if (!fishingCondition) return [];
  const type = `${spot.spot_type} ${spot.notes ?? ''}`.toLowerCase();
  const groupSets = type.includes('trout')
    ? [['Trout'], ['Trout', 'Bass'], ['Trout', 'Panfish']]
    : type.includes('river') || type.includes('stream')
      ? [['Catfish', 'Bass', 'Panfish'], ['Bass', 'Catfish', 'Panfish'], ['Panfish', 'Catfish', 'Bass']]
      : type.includes('reservoir')
        ? [['Bass', 'Walleye', 'Catfish'], ['Walleye', 'Bass', 'Catfish'], ['Catfish', 'Bass', 'Walleye']]
        : [['Bass', 'Panfish', 'Catfish'], ['Panfish', 'Bass', 'Catfish'], ['Catfish', 'Panfish', 'Bass']];
  const variant = stableSpotVariant(spot.id, groupSets.length);
  const preferredGroups = groupSets[variant];

  return preferredGroups
    .flatMap((group) => SPECIES.filter((species) => species.group === group))
    .filter((species, index, list) => list.findIndex((item) => item.id === species.id) === index)
    .map((species) => ({
      species,
      rate: biteRateFor(species, fishingCondition),
      structure: spotTargetsFor(species, fishingCondition).slice(0, 2).join(' and '),
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
}

function metricRow({ icon, label, value, unit }: { icon: string; label: string; value: string | number | null; unit?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div style={S.metricRow}>
      <span style={S.metricLabel}>{icon} {label}</span>
      <span style={S.metricValue}>
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

function scoreBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div key={label} style={{ marginBottom: '6px' }}>
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
  spotDataMode,
  spotDataStatusLabel,
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
  spotDataMode: SpotDataMode;
  spotDataStatusLabel: string;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedSpot?: Spot | null;
  sheetOpen?: boolean;
  onSpotSelect?: (spot: Spot) => void;
  onPopupOpen?: (spot: Spot) => void;
  onPopupClose?: () => void;
}) {
  /** The map HUD and the zoom control stack both step aside for spot details and the sheet. */
  const showMapOverlays = !sheetOpen && !selectedSpot;
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
  const loadedRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<SpotMarkerRegistry['current']>({});
  const [mapSize, setMapSize] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));
  // The hot-zone overlay is keyed to real provider conditions from the
  // nearest spot that has a loaded conditions payload. Nothing is assumed.
  const overlayCondition = useMemo<FishingCondition | null>(() => {
    if (!userLocation) return null;
    let bestCond: Cond | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const spot of spots) {
      const cond = conditions[spot.id];
      if (!cond) continue;
      const distance = Math.hypot(spot.lat - userLocation.latitude, spot.lng - userLocation.longitude);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCond = cond;
      }
    }
    return bestCond ? deriveFishingCondition(bestCond) : null;
  }, [conditions, spots, userLocation]);
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

  /** Map pixels left over after the floating chrome, used for focusing and popup sizing. */
  const mapInsets = useMemo(
    () => resolveMapInsets({ height: mapSize.height, sheetOpen }),
    [mapSize.height, sheetOpen],
  );

  const popupFrame = useMemo(
    () => resolveSpotPopupFrame({ width: mapSize.width, height: mapSize.height, insets: mapInsets }),
    [mapInsets, mapSize.height, mapSize.width],
  );

  useEffect(() => {
    const node = mapShellRef.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setMapSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const temperaturePoints = useMemo(
    () =>
      spots.map((spot) => ({
        lat: spot.lat,
        lng: spot.lng,
        name: spot.name,
        temperature: conditions[spot.id]?.data_mode === 'provider' ? conditions[spot.id].water_temp_c : null,
      })),
    [spots, conditions]
  );

  const rankedSpots = useMemo(
    () =>
      spots
        .filter((spot) => conditions[spot.id]?.data_mode === 'provider')
        .map((spot) => ({ spot, score: conditions[spot.id].fishing_score }))
        .sort((a, b) => b.score - a.score),
    [spots, conditions]
  );

  const hotSpots = rankedSpots.slice(0, 6);
  const conditionMarkers = rankedSpots.slice(0, 18);
  const hudStatusColor =
    spotDataMode === 'provider'
      ? '#22c55e'
      : spotDataMode === 'cached' || spotDataMode === 'offline-cached'
        ? '#fbbf24'
      : spotDataMode === 'loading'
        ? '#94a3b8'
        : '#f59e0b';

  function describeConditionState(condition: Cond) {
    const mode = condition.data_mode;

    if (mode === 'fallback') {
      return {
        label: 'Offline data',
        tone: '#f59e0b',
      };
    }

    if (mode === 'stale-cache' || condition.stale) {
      return {
        label: 'Offline cache',
        tone: '#fbbf24',
      };
    }

    if (mode === 'cached' || condition.cached) {
      return {
        label: 'Cached provider snapshot',
        tone: '#fbbf24',
      };
    }

    if (mode === 'provider') {
      return {
        label: 'Provider readings (timestamp shown below)',
        tone: '#22c55e',
      };
    }

    return {
      label: 'Data source unavailable',
      tone: '#f59e0b',
    };
  }

  const load = useCallback((spot: Spot, force = false) => {
    const id = spot.id;
    if (inFlightRef.current.has(id)) return;
    if (!force && loadedRef.current.has(id)) return;

    inFlightRef.current.add(id);
    setLoading((p) => ({ ...p, [id]: true }));

    void fetchSpotConditions({
      id,
      lat: spot.lat,
      lng: spot.lng,
      water_type: spot.water_type,
      usgs_site_id: spot.usgs_site_id,
      noaa_station_id: spot.noaa_station_id,
    }, { force })
      .then((result) => {
        if (result.ok) {
          loadedRef.current.add(id);
          setConditions((p) => ({ ...p, [id]: result.data as unknown as Cond }));
          setTabs((p) => (p[id] ? p : { ...p, [id]: 'score' }));
          setErrors((p) => {
            if (!p[id]) return p;
            const next = { ...p };
            delete next[id];
            return next;
          });
          return;
        }

        setErrors((p) => ({ ...p, [id]: result.message }));
      })
      .finally(() => {
        inFlightRef.current.delete(id);
        setLoading((p) => ({ ...p, [id]: false }));
      });
  }, []);

  const retry = (spot: Spot) => {
    loadedRef.current.delete(spot.id);
    setErrors((p) => {
      const next = { ...p };
      delete next[spot.id];
      return next;
    });
    setConditions((p) => {
      const next = { ...p };
      delete next[spot.id];
      return next;
    });
    load(spot, true);
  };

  useEffect(() => {
    spots.forEach((spot) => load(spot));
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
          z-index: ${MAP_Z_INDEX.leafletControls};
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
          z-index: ${MAP_Z_INDEX.effect};
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
          z-index: ${MAP_Z_INDEX.vignette};
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

      <div className="premium-map" ref={mapShellRef} style={{ position: 'absolute', inset: 0 }}>
        <div className="map-glow" />
        <div className="map-vignette" />

        {/* Sits above the sheet handle so the top of the map stays free for the zoom controls. */}
        <div className="hud" aria-hidden={!showMapOverlays} style={S.hud(showMapOverlays, sheetOpen)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="pulse" />
            <div>
              <div style={{ color: 'white', fontSize: 15, fontWeight: 800 }}>Oklahoma SeamCast Map</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Public-water planning tools; provider data is labeled below</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1' }}>
            <span>Spots tracked</span>
            <span style={{ color: 'white', fontWeight: 700 }}>{spots.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#cbd5e1', marginTop: 4 }}>
            <span>Data status</span>
            <span
              aria-live="polite"
              style={{
                color: hudStatusColor,
                fontWeight: 700,
              }}
            >
              {spotDataStatusLabel}
            </span>
          </div>
        </div>

        <MapDataSourceBadge mode={spotDataMode} />

      <MapContainer
        center={[OKLAHOMA_MAP_VIEW.center.lat, OKLAHOMA_MAP_VIEW.center.lng]}
          zoom={OKLAHOMA_MAP_VIEW.zoom}
          minZoom={MAP_MIN_ZOOM}
          maxZoom={MAP_MAX_ZOOM}
          zoomControl={false}
          doubleClickZoom
          scrollWheelZoom
          touchZoom
          boxZoom
          keyboard
          worldCopyJump
          style={{ height: '100%', width: '100%' }}
        >
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
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Calculated hotspot score: {score}</div>
                      <button type="button" onClick={() => openDirections(spot)} style={S.directionsBtn}>Get directions</button>
                    </div>
              </Popup>
            </CircleMarker>
          ))}

          {layers.conditionMarkers && conditionMarkers.map(({ spot, score }) => (
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
                      <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Calculated condition score: {score}</div>
                      <button type="button" onClick={() => openDirections(spot)} style={S.directionsBtn}>Get directions</button>
                    </div>
              </Popup>
            </CircleMarker>
          ))}

          {selectedSpot && (
            <CircleMarker
              center={[selectedSpot.lat, selectedSpot.lng]}
              radius={22}
              pathOptions={{
                color: '#67e8f9',
                fillColor: '#22d3ee',
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '4 4',
              }}
            />
          )}

          {spots.map((spot) => {
            const c = conditions[spot.id];
            const displayScore = c?.bite_score ?? c?.fishing_score ?? 0;
            const activeTab = tabs[spot.id] || 'score';
            const conditionState = c ? describeConditionState(c) : null;

            return (
              <Marker
                key={spot.id}
                position={[spot.lat, spot.lng]}
                ref={(instance) => {
                  markerRefs.current[spot.id] = instance;
                }}
                eventHandlers={{ click: () => { load(spot); onSpotSelect?.(spot); onPopupOpen?.(spot); } }}
              >
                <Popup
                  maxWidth={popupFrame.maxWidth}
                  minWidth={popupFrame.minWidth}
                  maxHeight={popupFrame.maxHeight}
                  autoPanPaddingTopLeft={[mapInsets.left, mapInsets.top]}
                  autoPanPaddingBottomRight={[mapInsets.right, mapInsets.bottom]}
                  eventHandlers={{ add: () => onPopupOpen?.(spot), remove: () => onPopupClose?.() }}
                >
                  <div style={{ ...S.popupWrap, minWidth: popupFrame.minWidth, maxHeight: popupFrame.maxHeight }}>
                    <div style={{ marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{spot.name}</h3>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{spot.water_type} • {spot.spot_type} • {spot.access_type ?? 'Public access'}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 4 }}>{spot.region ?? 'Oklahoma'} · {spot.notes ?? 'Verify current access and regulations before traveling.'}</div>
                      <button type="button" onClick={() => openDirections(spot)} style={{ ...S.directionsBtn, marginTop: 10 }}>Get directions</button>
                    </div>

                    <div style={{ background: '#082f49', border: '1px solid #155e75', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: '9px', color: '#67e8f9', fontWeight: 800, marginBottom: 7 }}>CATALOG TARGET ESTIMATE</div>
                      {spotSpeciesTargets(spot, c).length > 0 ? spotSpeciesTargets(spot, c).map(({ species, rate, structure }) => (
                        <div key={species.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid rgba(103,232,249,0.12)' }}>
                          <div><div style={{ color: '#f8fafc', fontSize: 11, fontWeight: 700 }}>{species.name}</div><div style={{ color: '#94a3b8', fontSize: 9 }}>{structure}</div></div>
                          <div style={{ color: '#86efac', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{rate}/100</div>
                        </div>
                      )) : <div style={{ fontSize: 10, color: '#94a3b8' }}>Target estimate unavailable until a provider snapshot loads.</div>}
                      <div style={{ color: '#94a3b8', fontSize: 9, marginTop: 7 }}>Catalog/algorithm estimate from spot metadata and available provider values; not a catch report or live reading.</div>
                    </div>

                    {loading[spot.id] && <div style={{ textAlign: 'center', padding: 18, color: '#94a3b8' }}>Loading provider snapshot…</div>}

                    {errors[spot.id] && (
                      <div style={S.retryBox}>
                        <div style={{ fontSize: 12, marginBottom: 8 }}>Failed to load: {errors[spot.id]}</div>
                        <button
                          onClick={() => retry(spot)}
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
                            ['community', '📍'],
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

                        {c.warning && (
                          <div style={{ background: 'rgba(120,53,15,0.35)', border: '1px solid #92400e', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 11, color: '#fde68a', lineHeight: 1.35 }}>
                            {c.warning}
                          </div>
                        )}

                        {activeTab === 'score' && (
                          <>
                            <div
                              style={{
                                background: `linear-gradient(135deg,${scoreColor(displayScore)}20,${scoreColor(displayScore)}08)`,
                                border: `1px solid ${scoreColor(displayScore)}50`,
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 10,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(displayScore), lineHeight: 1 }}>{displayScore}</div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: scoreColor(displayScore) }}>{c.bite_score != null ? 'AI bite score' : scoreLabel(displayScore)}</div>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 11, color: '#cbd5e1' }}>
                                  <div>{depthLabel(c.water_level_m, c.flow_rate_cfs)}</div>
                                  <div style={{ color: conditionState?.tone }}>{conditionState?.label}</div>
                                </div>
                              </div>
                            </div>

                            {c.ai_micro_spots && c.ai_micro_spots.length > 0 && (
                              <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(15,118,110,0.14)', border: '1px solid rgba(45,212,191,0.25)' }}>
                                <div style={{ fontSize: 11, color: '#99f6e4', fontWeight: 800, marginBottom: 6 }}>AI SPOT ANALYSIS</div>
                                {c.ai_micro_spots.slice(0, 3).map((microSpot, index) => {
                                  const microScore = microSpot.biteScore ?? microSpot.bite_score;
                                  return (
                                    <div key={`${microSpot.name ?? microSpot.label ?? 'spot'}-${index}`} style={{ padding: '6px 0', borderTop: index ? '1px solid rgba(255,255,255,0.08)' : undefined }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: '#f0fdfa', fontWeight: 700 }}>
                                        <span>{microSpot.name ?? microSpot.label ?? `Likely holding area ${index + 1}`}</span>
                                        {microScore != null && <span style={{ color: '#5eead4' }}>{microScore}/100</span>}
                                      </div>
                                      {(microSpot.description ?? microSpot.structure ?? microSpot.depth) && (
                                        <div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.35, color: '#ccfbf1' }}>{microSpot.description ?? microSpot.structure ?? microSpot.depth}</div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

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
                        {activeTab === 'community' && (
<CommunityPinsPanel
    knownSpotId={spot.id}
    spotName={spot.name}
    latitude={spot.lat}
    longitude={spot.lng}
  />
)} 
                        <div style={{ marginTop: 10, fontSize: 10, color: '#6b7280' }}>
                          {c.captured_at ? new Date(c.captured_at).toLocaleString() : 'No provider timestamp'}
                        </div>
                      </>
                    )}
                  </div>
                </Popup>
          {userLocation && (
            <HotZoneOverlay 
              center={[userLocation.latitude, userLocation.longitude]}
              condition={overlayCondition} 
              visible={showMapOverlays} 
            />
          )}

              </Marker>
            );
          })}

          <SpotFocusController
            spot={selectedSpot ?? null}
            insets={mapInsets}
            size={mapSize}
            markerRefs={markerRefs}
            minZoom={MAP_MIN_ZOOM}
            maxZoom={MAP_MAX_ZOOM}
          />
          <MapZoomControls minZoom={MAP_MIN_ZOOM} maxZoom={MAP_MAX_ZOOM} visible={showMapOverlays} />
        </MapContainer>
      </div>
    </div>
  );
}
