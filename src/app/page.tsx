'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import SpeciesTab from "@/components/SpeciesTab";
import BiteTimesTab from "@/components/BiteTimesTab";
import WeatherTab from "@/components/WeatherTab";
import LogbookTab from '@/components/logbook/LogbookTab';
import PhotoGalleryTab from "@/components/logbook/PhotoGalleryTab";
import SpotSuggester from '@/components/ai/SpotSuggester';
import type { BaseLayer, MapLayers } from '@/components/MapWrapper';
import { filterSpots, rankSpots, type Spot, type SpotFilter } from '@/lib/mapFilters';
import { watchDeviceLocation, type Coordinates, type LocationStatus } from '@/lib/region';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';
import AuthAccountButton from '@/components/AuthAccountButton';
import { cacheSpots, formatCacheAge, readCachedSpots } from '@/lib/offlineSpots';
import { formatDistance, sortSpotsByDistance } from '@/lib/nearbySpots';

const MapWrapper = dynamic(() => import('@/components/MapWrapper'), { ssr: false });

interface SpotCondition { fishing_score?: number | null }

// ─── Shared style constants ───────────────────────────────────────────────────
const PAGE_STYLES = {
  root: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#030712', color: 'white', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' } as React.CSSProperties,
  header: { background: '#0a0f1e', borderBottom: '1px solid #1e293b', padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '42px', flexShrink: 0, zIndex: 40, gap: '8px' } as React.CSSProperties,
  main: { flex: 1, position: 'relative', overflow: 'hidden' } as React.CSSProperties,
  card: { background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' } as React.CSSProperties,
  scrollPane: { position: 'absolute', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '70px' } as React.CSSProperties,
  padPane: { padding: '16px', overflowY: 'auto', height: '100%' } as React.CSSProperties,
  sectionTitle: { fontSize: '14px', fontWeight: 'bold', color: '#22d3ee', marginBottom: '12px' } as React.CSSProperties,
  navBar: { background: '#0a0f1e', borderTop: '1px solid #1e293b', display: 'flex', height: '60px', flexShrink: 0, zIndex: 40, paddingBottom: 'env(safe-area-inset-bottom)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' } as React.CSSProperties,
  navBtn: (active: boolean): React.CSSProperties => ({
    flex: '0 0 68px', minWidth: '68px', position: 'relative', background: 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '2px', cursor: 'pointer', color: active ? '#22d3ee' : '#64748b', transition: 'color 0.15s',
  }),
  mapBadge: { position: 'absolute', top: '12px', left: '12px', background: 'rgba(10,15,30,0.9)', border: '1px solid #1e293b', borderRadius: '20px', padding: '6px 12px', fontSize: '11px', color: '#94a3b8', zIndex: 10, backdropFilter: 'blur(8px)' } as React.CSSProperties,
  settingsCard: { background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px', marginBottom: '8px' } as React.CSSProperties,
} as const;

const MAP_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'freshwater', label: 'Freshwater' },
  { id: 'lake', label: 'Lake' },
  { id: 'reservoir', label: 'Reservoir' },
  { id: 'river', label: 'River' },
  { id: 'pfa', label: 'Public Fishing Area' },
  { id: 'wma', label: 'Wildlife Area' },
  { id: 'municipal', label: 'Municipal Water' },
  { id: 'trout', label: 'Trout Area' },
] as const;

type SpotLoadResult = {
  spots: Spot[];
  source: 'live' | 'cached' | 'fallback';
  savedAt: string | null;
};

async function getSpots(): Promise<SpotLoadResult> {
  const cached = readCachedSpots();
  try {
    const res = await fetch('/api/spots', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const savedAt = new Date().toISOString();
        cacheSpots(data);
        return { spots: data, source: 'live', savedAt };
      }
    }
  } catch {
    // Fall through to browser cache or bundled Oklahoma fixtures.
  }
  if (cached?.spots.length) return { spots: cached.spots, source: 'cached', savedAt: cached.savedAt };
  return { spots: [...DEFAULT_SPOTS], source: 'fallback', savedAt: null };
}

export default function MobilePage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [nearbyMode, setNearbyMode] = useState(false);
  const [cacheSource, setCacheSource] = useState<'loading' | 'live' | 'cached' | 'fallback'>('loading');
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<'map'|'log'|'gallery'|'ai'|'top'|'species'|'bitetime'|'weather'|'settings'>('map');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<SpotFilter>('all');
  const [conditionScores, setConditionScores] = useState<Record<string, number>>({});
  const [loadingScores, setLoadingScores] = useState<Record<string, boolean>>({});
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('explore');
  const [mapLayers, setMapLayers] = useState<MapLayers>({
    hotspots: true,
    depth: false,
    waterTemp: false,
    catchPins: true,
    waypoints: true,
  });
  const scoreFetchInFlight = useRef<Record<string, boolean>>({});
  const locationCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    getSpots().then((result) => {
      if (!active) return;
      setSpots(result.spots);
      setCacheSource(result.source);
      setCachedAt(result.savedAt);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    locationCleanupRef.current?.();
  }, []);

  const startLocationTracking = () => {
    if (locationStatus === 'active' || locationStatus === 'locating') {
      locationCleanupRef.current?.();
      locationCleanupRef.current = null;
      setLocationStatus('idle');
      setNearbyMode(false);
      return;
    }
    setLocationStatus('locating');
    locationCleanupRef.current = watchDeviceLocation(
      (nextCoordinates) => {
        setCoordinates(nextCoordinates);
        setLocationStatus('active');
        setNearbyMode(true);
      },
      (status) => {
        locationCleanupRef.current?.();
        locationCleanupRef.current = null;
        setLocationStatus(status);
      },
    );
  };

  useEffect(() => {
    if (!spots.length) return;

    const visibleSpots = filterSpots(spots, mapFilter);
    visibleSpots.forEach((spot) => {
      if (conditionScores[spot.id] !== undefined || scoreFetchInFlight.current[spot.id]) return;

      scoreFetchInFlight.current[spot.id] = true;
      setLoadingScores((prev) => ({ ...prev, [spot.id]: true }));

      fetch(`/api/spots/${spot.id}/conditions`)
        .then(async (res) => {
          if (!res.ok) {
            setConditionScores((prev) => ({ ...prev, [spot.id]: 0 }));
            return;
          }

          const data = (await res.json()) as SpotCondition;
          const fishingScore = typeof data.fishing_score === 'number' ? data.fishing_score : 0;
          setConditionScores((prev) => ({ ...prev, [spot.id]: fishingScore }));
        })
        .catch(() => {
          setConditionScores((prev) => ({ ...prev, [spot.id]: 0 }));
        })
        .finally(() => {
          scoreFetchInFlight.current[spot.id] = false;
          setLoadingScores((prev) => ({ ...prev, [spot.id]: false }));
        });
    });
  }, [spots, mapFilter, conditionScores]);

  const filteredSpots = filterSpots(spots, mapFilter);
  const nearbySpots = useMemo(() => sortSpotsByDistance(filteredSpots, coordinates), [filteredSpots, coordinates]);
  const visibleSpots = nearbyMode && coordinates ? nearbySpots.slice(0, 20) : filteredSpots;
  const rankedSpots = rankSpots(visibleSpots, conditionScores);
  const distanceById = useMemo(() => new Map(nearbySpots.map((spot) => [spot.id, spot.distanceMiles])), [nearbySpots]);
  const topSpots = rankedSpots.slice(0, 8);
  const toggleMapLayer = (key: keyof MapLayers) => {
    setMapLayers((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const tabs = [
{ id: "map",      icon: "🗺",  label: "Map"      },
{ id: "log",      icon: "📓",  label: "Logbook"  },
{ id: "gallery", icon: "📸", label: "Gallery" },
{ id: "ai",       icon: "🤖",  label: "AI"       },
{ id: "top",      icon: "🏆",  label: "Top Spots"},
{ id: "species",  icon: "◎",   label: "Species"  },
{ id: "settings", icon: "⚙️", label: "Settings" },
{ id: "bitetime", icon: "⏱",  label: "Bite Time"},
{ id: "weather",  icon: "🌤",  label: "Weather"  },
] as const;
  return (
    <div style={PAGE_STYLES.root}>

      {/* HEADER */}
      <header style={PAGE_STYLES.header}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', minWidth:0 }}>
          <span style={{ fontSize:'18px', flexShrink:0 }}>🎣</span>
          <span style={{ fontSize:'14px', fontWeight:'800', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', background:'linear-gradient(90deg,#22d3ee,#0ea5e9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Fishfinder Pro</span>
        </div>
        <div style={{ display:'flex', gap:'7px', alignItems:'center', flexShrink:0 }}>
          <span style={{ fontSize:'9px', color:'#22c55e' }}>● LIVE</span>
          <AuthAccountButton />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={PAGE_STYLES.main}>

        {/* MAP TAB */}
        {tab === 'map' && (
          <div style={{ position:'absolute', inset:0 }}>
            <MapWrapper spots={visibleSpots} baseLayer={baseLayer} layers={mapLayers} userLocation={coordinates} />

            {/* Floating spot count badge */}
            <div style={{ position:'absolute', top:'12px', left:'12px', right:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', zIndex:10 }}>
              <div style={PAGE_STYLES.mapBadge}>
                📍 {visibleSpots.length} {nearbyMode ? 'nearby ' : ''}Oklahoma public-access waters
              </div>
              <button type="button" onClick={startLocationTracking} style={{ background:'rgba(10,15,30,0.94)', border:'1px solid #155e75', borderRadius:'20px', padding:'6px 10px', color: locationStatus === 'active' ? '#67e8f9' : '#cbd5e1', fontSize:'10px', cursor:'pointer', backdropFilter:'blur(8px)' }}>
                {locationStatus === 'locating' ? 'Locating…' : locationStatus === 'active' ? 'Stop GPS' : 'Find nearby'}
              </button>
            </div>
            <div style={{ position:'absolute', top:'52px', left:'12px', background:'rgba(10,15,30,0.86)', border:'1px solid #1e293b', borderRadius:'8px', padding:'5px 8px', fontSize:'9px', color: cacheSource === 'live' ? '#86efac' : '#fbbf24', zIndex:10, backdropFilter:'blur(8px)' }}>
              {cacheSource === 'live' ? 'Online spot data cached' : cacheSource === 'cached' ? `Offline cache · ${formatCacheAge(cachedAt) ?? 'saved data'}` : cacheSource === 'fallback' ? 'Bundled offline spot data' : 'Loading spot data…'}
              {locationStatus === 'denied' && ' · Location permission denied'}
              {locationStatus === 'unavailable' && ' · GPS unavailable'}
            </div>

            {mapLayers.depth && (
              <div style={{ position:'absolute', right:'12px', bottom: sheetOpen ? 'calc(45dvh + 12px)' : '64px', width:'132px', background:'rgba(10,15,30,0.9)', border:'1px solid #1e293b', borderRadius:'8px', padding:'9px', zIndex:10, backdropFilter:'blur(8px)', transition:'bottom 0.3s ease' }}>
                <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'700', marginBottom:'6px' }}>DEPTH REFERENCE</div>
                <div style={{ display:'flex', gap:'3px', alignItems:'center' }}>
                  {['#0c4a6e','#0369a1','#0891b2','#22c55e','#eab308','#f97316'].map((color) => <span key={color} style={{ flex:1, height:'8px', background:color }} />)}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', color:'#64748b', fontSize:'9px', marginTop:'3px' }}><span>Deep</span><span>Shallow</span></div>
              </div>
            )}



            {/* Slide-up sheet handle */}
            <div
              onClick={() => setSheetOpen(!sheetOpen)}
              style={{ position:'absolute', bottom:0, left:0, right:0, background:'#0a0f1e', borderTop:'1px solid #1e293b', borderRadius:'16px 16px 0 0', padding:'8px 0 0', cursor:'pointer', zIndex:20, transition:'transform 0.3s ease' }}
            >
              <div style={{ width:'36px', height:'4px', background:'#334155', borderRadius:'2px', margin:'0 auto 10px' }} />
              {!sheetOpen && (
                <div style={{ padding:'0 16px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'#64748b' }}>🏆 Top Spots Today</span>
                  <span style={{ fontSize:'11px', color:'#0ea5e9' }}>Show ↑</span>
                </div>
              )}
              {sheetOpen && (
                <div style={{ padding:'0 16px 16px', maxHeight:'45dvh', overflowY:'auto' }}>
                  <div style={{ fontSize:'11px', color:'#64748b', marginBottom:'10px', display:'flex', justifyContent:'space-between', gap:'8px' }}>
                    <span>{nearbyMode ? '📍 NEAREST OKLAHOMA WATERS' : '🏆 OKLAHOMA TOP WATERS TODAY'}</span>
                    <button type="button" onClick={(event) => { event.stopPropagation(); setNearbyMode(false); }} style={{ background:'transparent', border:0, color:'#0ea5e9', fontSize:'10px', cursor:'pointer', padding:0 }}>Show all</button>
                  </div>
                  {topSpots.length > 0 ? topSpots.map(({ spot, score }, i) => {
                    const scoreValue = loadingScores[spot.id] ? '…' : score;
                    return (
                      <div key={spot.id} onClick={e => { e.stopPropagation(); setSheetOpen(false); }}
                        style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #0f172a', cursor:'pointer' }}>
                        <span style={{ color:'#475569', fontSize:'12px', minWidth:'18px' }}>#{i+1}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{spot.name}</div>
                          <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{spot.water_type} · {spot.spot_type}{Number.isFinite(distanceById.get(spot.id)) ? ` · ${formatDistance(distanceById.get(spot.id) ?? Number.POSITIVE_INFINITY)}` : ''}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'18px', fontWeight:'bold', color:'#22c55e' }}>{scoreValue}</div>
                          <div style={{ fontSize:'8px', color:'#475569' }}>SCORE</div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ color:'#64748b', fontSize:'12px', padding:'12px 0' }}>No spots match this filter yet.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOGBOOK TAB */}
        {tab === 'log' && <LogbookTab />}
        {tab === 'gallery' && <PhotoGalleryTab />}
        {/* AI TAB */}
        {tab === 'ai' && (
          <div style={PAGE_STYLES.padPane}>
            <SpotSuggester spots={visibleSpots} />
          </div>
        )}

        {/* TOP SPOTS TAB */}
        {tab === 'top' && (
          <div style={PAGE_STYLES.padPane}>
            <div style={PAGE_STYLES.sectionTitle}>🏆 Top Spots</div>
            {rankedSpots.length > 0 ? rankedSpots.map(({ spot, score }, i) => {
              const scoreValue = loadingScores[spot.id] ? '…' : score;
              return (
                <div key={spot.id} style={PAGE_STYLES.card}>
                  <span style={{ fontSize:'20px', fontWeight:'bold', color:'#334155', minWidth:'28px' }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', color:'#e2e8f0', fontWeight:'600' }}>{spot.name}</div>
                    <div style={{ fontSize:'10px', color:'#475569', marginTop:'2px' }}>{spot.water_type} · {spot.spot_type}{Number.isFinite(distanceById.get(spot.id)) ? ` · ${formatDistance(distanceById.get(spot.id) ?? Number.POSITIVE_INFINITY)}` : ''}</div>
                  </div>
                  <div style={{ background:'#14532d', color:'#4ade80', fontSize:'14px', fontWeight:'bold', padding:'4px 10px', borderRadius:'16px' }}>{scoreValue}</div>
                </div>
              );
            }) : (
              <div style={{ color:'#64748b', fontSize:'12px', padding:'32px 0', textAlign:'center' }}>No live scores available for the current filter.</div>
            )}
          </div>
        )}

        {/* SPECIES TAB */}
{/* CATCHES TAB */}

        {/* BITE TIMES TAB */}
        {tab === 'bitetime' && (
          <div style={PAGE_STYLES.scrollPane}>
            <BiteTimesTab />
          </div>
        )}

        {/* WEATHER TAB */}
        {tab === 'weather' && (
          <div style={PAGE_STYLES.scrollPane}>
            <WeatherTab />
          </div>
        )}

        {/* SOCIAL TAB */}
        {tab === 'species' && (
          <div style={PAGE_STYLES.scrollPane}>
            <SpeciesTab coordinates={coordinates} />
          </div>
        )}
        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <div style={PAGE_STYLES.padPane}>
            <div style={PAGE_STYLES.sectionTitle}>⚙️ Settings</div>

            {/* Map Filters */}
            <div style={{ marginBottom:'20px' }}>
              <div style={{ fontSize:'12px', fontWeight:'bold', color:'#64748b', marginBottom:'8px' }}>🗺 Map Filters</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {MAP_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setMapFilter(filter.id as SpotFilter)}
                    style={{
                      background: mapFilter === filter.id ? '#0369a1' : '#0a0f1e',
                      border: mapFilter === filter.id ? '1px solid #7dd3fc' : '1px solid #1e293b',
                      borderRadius:'8px',
                      fontSize:'11px',
                      cursor:'pointer',
                      color: mapFilter === filter.id ? '#e0f2fe' : '#cbd5e1',
                      padding:'6px 12px',
                      fontWeight: mapFilter === filter.id ? '700' : '500',
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={PAGE_STYLES.settingsCard}>
              <div style={{ fontSize:'13px', color:'#e2e8f0', marginBottom:'10px' }}>🗺 Map layers</div>
              {([
                ['hotspots', '🔥 Hotspots'],
                ['depth', '📏 Depth contours'],
                ['waterTemp', '🌡 Water temperature'],
                ['catchPins', '🎣 Catch pins'],
                ['waypoints', '📍 Waypoints'],
              ] as [keyof MapLayers, string][]).map(([key, label]) => (
                <button key={key} onClick={() => toggleMapLayer(key)} style={{ width:'100%', background:'none', border:'none', borderTop:'1px solid #1e293b', color:'#cbd5e1', padding:'10px 0', display:'flex', justifyContent:'space-between', cursor:'pointer', fontSize:'12px', textAlign:'left' }}>
                  <span>{label}</span><span style={{ color:mapLayers[key] ? '#22d3ee' : '#64748b' }}>{mapLayers[key] ? 'ON' : 'OFF'}</span>
                </button>
              ))}
              <div style={{ fontSize:'13px', color:'#e2e8f0', margin:'12px 0 10px' }}>Base map</div>
              <div style={{ display:'flex', gap:'8px' }}>
                {(['explore', 'satellite'] as BaseLayer[]).map((layer) => (
                  <button key={layer} onClick={() => setBaseLayer(layer)} style={{ flex:1, background:baseLayer === layer ? '#0369a1' : '#0f172a', border:'1px solid #1e293b', borderRadius:'8px', color:'#e2e8f0', padding:'8px', cursor:'pointer', fontSize:'11px', textTransform:'capitalize' }}>{layer}</button>
                ))}
              </div>
            </div>
            {[
              ['🔎', 'Notifications', 'Push alerts for hot bites'],
              ['📍', 'Location', 'Use GPS for nearby spots'],
              ['🌡', 'Units', 'Imperial (lbs, ft, °F)'],
              ['🗺', 'Map Style', 'Dark (default)'],
              ['🔁', 'Auto-refresh', 'Every 30 minutes'],
            ].map(([icon, title, sub]) => (
              <div key={title as string} style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px' }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{title as string}</div>
                    <div style={{ fontSize: '10px', color: '#475569' }}>{sub as string}</div>
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>Coming soon</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav style={PAGE_STYLES.navBar}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSheetOpen(false); }}
            style={PAGE_STYLES.navBtn(tab === t.id)}>
            <span style={{ fontSize:'20px' }}>{t.icon}</span>
            <span style={{ fontSize:'10px', fontWeight: tab === t.id ? 'bold' : 'normal', whiteSpace:'nowrap' }}>{t.label}</span>
            {tab === t.id && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:'32px', height:'2px', background:'#22d3ee', borderRadius:'1px' }} />}
          </button>
        ))}
      </nav>
    </div>
  );
}
