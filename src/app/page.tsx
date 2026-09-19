'use client';

import NextBestAction from '@/components/NextBestAction';

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
import { createClient, hasSupabasePublicConfig } from '@/lib/supabase/client';
import { cacheSpots, formatCacheAge, readCachedSpots } from '@/lib/offlineSpots';
import { formatDistance, sortSpotsByDistance } from '@/lib/nearbySpots';

const MapWrapper = dynamic(() => import('@/components/MapWrapper'), { ssr: false });

interface SpotCondition { fishing_score?: number | null }

// ─── Shared style constants ───────────────────────────────────────────────────
const PAGE_STYLES = {
  root: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#07111b', color: '#f8fafc', fontFamily: 'system-ui,sans-serif', overflow: 'hidden' } as React.CSSProperties,
  header: { background: 'rgba(7,17,27,0.94)', borderBottom: '1px solid #1d3442', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px', flexShrink: 0, zIndex: 40, gap: '12px', backdropFilter: 'blur(16px)' } as React.CSSProperties,
  main: { flex: 1, position: 'relative', overflow: 'hidden' } as React.CSSProperties,
  card: { background: '#0d1c29', border: '1px solid #1d3442', borderRadius: '14px', padding: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)' } as React.CSSProperties,
  scrollPane: { position: 'absolute', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 16px calc(84px + env(safe-area-inset-bottom))' } as React.CSSProperties,
  padPane: { padding: '20px 16px calc(84px + env(safe-area-inset-bottom))', overflowY: 'auto', height: '100%' } as React.CSSProperties,
  sectionTitle: { fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: '#e2f7ff', marginBottom: '16px' } as React.CSSProperties,
  navBar: { background: 'rgba(7,17,27,0.96)', borderTop: '1px solid #1d3442', display: 'flex', height: '68px', flexShrink: 0, zIndex: 40, paddingBottom: 'env(safe-area-inset-bottom)', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', boxShadow: '0 -10px 24px rgba(0,0,0,0.16)' } as React.CSSProperties,
  navBtn: (active: boolean): React.CSSProperties => ({
    flex: '0 0 76px', minWidth: '76px', position: 'relative', background: active ? 'rgba(14,116,144,0.16)' : 'none', border: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '5px', cursor: 'pointer', color: active ? '#67e8f9' : '#78909c', transition: 'color 0.15s, background 0.15s',
  }),
  mapBadge: { position: 'absolute', top: '14px', left: '14px', background: 'rgba(7,17,27,0.88)', border: '1px solid #294452', borderRadius: '999px', padding: '8px 12px', fontSize: '11px', color: '#c4d7df', zIndex: 10, backdropFilter: 'blur(12px)' } as React.CSSProperties,
  settingsCard: { background: '#0d1c29', border: '1px solid #1d3442', borderRadius: '14px', padding: '16px', marginBottom: '12px' } as React.CSSProperties,
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

  // __SETTINGS_TRANSFORM_APPLIED__

  type UnitPreference = 'imperial' | 'metric'
  type AutoRefreshPreference = 'off' | '15' | '30' | '60'
  type NotificationState = 'loading' | 'unsupported' | NotificationPermission

  const BASE_STYLE_OPTIONS = [
    { id: 'explore', label: 'Dark / Explore' },
    { id: 'satellite', label: 'Satellite' },
  ] as const

  const AUTO_REFRESH_OPTIONS = [
    { id: 'off', label: 'Off', minutes: null },
    { id: '15', label: 'Every 15 minutes', minutes: 15 },
    { id: '30', label: 'Every 30 minutes', minutes: 30 },
    { id: '60', label: 'Every 60 minutes', minutes: 60 },
  ] as const

  const SETTINGS_STORAGE_KEYS = {
    units: 'fishfinder.units',
    mapStyle: 'fishfinder.map-style',
    autoRefresh: 'fishfinder.auto-refresh',
    notifications: 'fishfinder.notifications.enabled',
  } as const

  function readStoredValue(key: string, fallback: string) {
    if (typeof window === 'undefined') return fallback

    try {
      return window.localStorage.getItem(key) ?? fallback
    } catch {
      return fallback
    }
  }

  function saveStoredValue(key: string, value: string) {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Storage denial or private browsing should not break settings UI.
    }
  }

  type SettingCardProps = {
    icon: string
    title: string
    description: string
    status?: string
    children?: React.ReactNode
  }

  function SettingCard({ icon, title, description, status, children }: SettingCardProps) {
    return (
      <section style={{ background: '#0a0f1e', border: '1px solid #1e293b', borderRadius: '10px', padding: '14px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span aria-hidden="true" style={{ fontSize: '20px' }}>{icon}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '13px', color: '#e2e8f0' }}>{title}</h3>
              <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#94a3b8' }}>{description}</p>
            </div>
          </div>
          {status && <span style={{ fontSize: '9px', color: '#22d3ee', fontWeight: 800 }}>{status}</span>}
        </div>
        {children && <div style={{ marginTop: '12px' }}>{children}</div>}
      </section>
    )
  }

  type PreferenceButtonProps = {
    label: string
    selected: boolean
    onSelect: () => void
  }

  function PreferenceButton({ label, selected, onSelect }: PreferenceButtonProps) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        style={{
          flex: 1,
          minWidth: '92px',
          background: selected ? '#0369a1' : '#0f172a',
          border: selected ? '1px solid #7dd3fc' : '1px solid #1e293b',
          borderRadius: '8px',
          color: selected ? '#e0f2fe' : '#cbd5e1',
          padding: '8px',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: selected ? 800 : 500,
        }}
      >
        {label}
      </button>
    )
  }

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
  const [authReady, setAuthReady] = useState(() => !hasSupabasePublicConfig());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [nearbyMode, setNearbyMode] = useState(false);
  const [cacheSource, setCacheSource] = useState<'loading' | 'live' | 'cached' | 'fallback'>('loading');
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<'map'|'log'|'gallery'|'ai'|'top'|'species'|'bitetime'|'weather'|'settings'>('map');
  const [isOnline, setIsOnline] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [backHint, setBackHint] = useState(false);
  const lastBackAtRef = useRef(0);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [, setMapPopupOpen] = useState(false);
  const [mapFilter, setMapFilter] = useState<SpotFilter>('all');
  const [conditionScores, setConditionScores] = useState<Record<string, number>>({});
  const [loadingScores, setLoadingScores] = useState<Record<string, boolean>>({});
  const [baseLayer, setBaseLayer] = useState<BaseLayer>('explore');
  const [unitsPreference, setUnitsPreference] = useState<UnitPreference>('imperial');
  const [autoRefreshPreference, setAutoRefreshPreference] = useState<AutoRefreshPreference>('off');
  const [notificationState, setNotificationState] = useState<NotificationState>('loading');
  const [notificationsPreferred, setNotificationsPreferred] = useState(false);
  const [mapLayers, setMapLayers] = useState<MapLayers>({
    hotspots: true,
    depth: false,
    waterTemp: false,
    catchPins: true,
    waypoints: true,
  });
  const scoreFetchInFlight = useRef<Record<string, boolean>>({});
  const refreshInFlightRef = useRef(false);
  const locationCleanupRef = useRef<(() => void) | null>(null);


  useEffect(() => { const up = () => setIsOnline(navigator.onLine); window.addEventListener('online', up); window.addEventListener('offline', up); up(); return () => { window.removeEventListener('online', up); window.removeEventListener('offline', up); }; }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
    const storedMapStyle = readStoredValue(SETTINGS_STORAGE_KEYS.mapStyle, 'explore');
    setBaseLayer(storedMapStyle === 'satellite' ? 'satellite' : 'explore');

    const storedUnits = readStoredValue(SETTINGS_STORAGE_KEYS.units, 'imperial');
    setUnitsPreference(storedUnits === 'metric' ? 'metric' : 'imperial');

    const storedAutoRefresh = readStoredValue(SETTINGS_STORAGE_KEYS.autoRefresh, 'off');
    setAutoRefreshPreference(
      storedAutoRefresh === '15' || storedAutoRefresh === '30' || storedAutoRefresh === '60'
        ? storedAutoRefresh
        : 'off',
    );

    setNotificationsPreferred(
      readStoredValue(SETTINGS_STORAGE_KEYS.notifications, 'false') === 'true',
    );

    if (!('Notification' in window)) {
      setNotificationState('unsupported');
      return;
    }

    setNotificationState(Notification.permission);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const loadSpotData = async (isAutoRefresh = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const result = await getSpots();
      setSpots(result.spots);
      setCacheSource(result.source);
      setCachedAt(result.savedAt);

      if (result.source === 'live' && isAutoRefresh) {
        setConditionScores({});
        setLoadingScores({});
        scoreFetchInFlight.current = {};
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let mounted = true;
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const signedIn = Boolean(data.session?.user);
      setIsAuthenticated(signedIn);
      setAuthReady(true);
      if (signedIn) void loadSpotData(false);
      else setSpots([]);
    };

    void syncSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const signedIn = Boolean(session?.user);
      setIsAuthenticated(signedIn);
      setAuthReady(true);
      if (signedIn) void loadSpotData(false);
      else {
        setSpots([]);
        setSelectedSpot(null);
        setConditionScores({});
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;

    const selectedAutoRefresh = AUTO_REFRESH_OPTIONS.find(
      (option) => option.id === autoRefreshPreference,
    );

    if (!selectedAutoRefresh?.minutes) return;

    const refreshIfSafe = () => {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine &&
        !refreshInFlightRef.current
      ) {
        void loadSpotData(true);
      }
    };

    const intervalId = window.setInterval(
      refreshIfSafe,
      selectedAutoRefresh.minutes * 60 * 1000,
    );

    window.addEventListener('online', refreshIfSafe);
    document.addEventListener('visibilitychange', refreshIfSafe);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', refreshIfSafe);
      document.removeEventListener('visibilitychange', refreshIfSafe);
    };
  }, [autoRefreshPreference, authReady, isAuthenticated]);

  useEffect(() => () => {
    locationCleanupRef.current?.();
  }, []);

  useEffect(() => {
    const marker = { fishfinderMapBack: true };

    if (!window.history.state?.fishfinderMapBack) {
      window.history.replaceState(marker, '', window.location.href);
      window.history.pushState(marker, '', window.location.href);
    }

    const onPopState = () => {
      const mapIsFocused = tab === 'map' && !sheetOpen;

      if (!mapIsFocused) {
        setTab('map');
        setSheetOpen(false);
        setSelectedSpot(null);
        setMapPopupOpen(false);
        setBackHint(false);
        window.history.pushState(marker, '', window.location.href);
        return;
      }

      const now = Date.now();

      if (now - lastBackAtRef.current < 2000) {
        return;
      }

      lastBackAtRef.current = now;
      setBackHint(true);
      window.setTimeout(() => setBackHint(false), 2000);
      window.history.pushState(marker, '', window.location.href);
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [tab, sheetOpen]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setNotificationState('unsupported');
      setNotificationsPreferred(false);
      saveStoredValue(SETTINGS_STORAGE_KEYS.notifications, 'false');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationState(permission);

    const enabled = permission === 'granted';
    setNotificationsPreferred(enabled);
    saveStoredValue(SETTINGS_STORAGE_KEYS.notifications, String(enabled));

    if (enabled && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('SeamCast notifications enabled', {
        body: 'You will receive fishing updates from this browser when alerts are available.',
        icon: '/icons/icon-192.png',
        tag: 'seamcast-notifications-enabled',
      });
    }
  };

  const locationSettingStatus = (
    locationStatus === 'locating' ? 'LOCATING' :
    locationStatus === 'active' ? 'ON' :
    locationStatus === 'denied' ? 'DENIED' :
    locationStatus === 'unavailable' ? 'UNAVAILABLE' : 'OFF'
  );

  const unitPreferenceLabel = unitsPreference === 'imperial' ? 'IMPERIAL' : 'METRIC';
  const mapStyleLabel = baseLayer === 'satellite' ? 'SATELLITE' : 'DARK/EXPLORE';
  const autoRefreshLabel = autoRefreshPreference === 'off'
    ? 'OFF'
    : `EVERY ${autoRefreshPreference} MIN`;

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
    if (!authReady || !isAuthenticated || !spots.length) return;

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
  }, [authReady, isAuthenticated, spots, mapFilter, conditionScores]);

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
    { id: 'map', icon: '🗺️', label: 'Explore' },
    { id: 'log', icon: '📓', label: 'Logbook' },
    { id: 'top', icon: '⭐', label: 'Top spots' },
    { id: 'weather', icon: '🌤️', label: 'Weather' },
    { id: 'bitetime', icon: '🌙', label: 'Bite times' },
    { id: 'species', icon: '🐟', label: 'Species' },
    { id: 'gallery', icon: '📸', label: 'Gallery' },
    { id: 'ai', icon: '🧭', label: 'Trip help' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ] as const;
  return (
    <div style={PAGE_STYLES.root}>

      {/* HEADER */}
      <header style={PAGE_STYLES.header}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', minWidth:0 }}>
          <span style={{ fontSize:'18px', flexShrink:0 }}>🎣</span>
          <span style={{ fontSize:'14px', fontWeight:'800', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', background:'linear-gradient(90deg,#22d3ee,#0ea5e9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>SeamCast</span>
        </div>
        <div style={{ display:'flex', gap:'7px', alignItems:'center', flexShrink:0 }}>
          <span style={{ fontSize:'9px', color:'#22c55e' }}>● LIVE</span>
          <AuthAccountButton />
        </div>
      </header>

      {backHint && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '82px',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(15,23,42,0.96)',
            border: '1px solid #334155',
            borderRadius: '999px',
            color: '#e2e8f0',
            padding: '10px 16px',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
          }}
        >
          Press Back again to exit SeamCast
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main style={PAGE_STYLES.main}>

        {/* MAP TAB */}
{tab === "map" && <NextBestAction spotCount={nearbySpots.length} selectedSpotName={selectedSpot?.name ?? null} isOnline={isOnline} hasConditions={false} onOpenAi={() => setTab("ai")} onOpenLogbook={() => setTab("log")} onRefresh={() => { void loadSpotData(false) }} />}
        {tab === 'map' && (
          <div style={{ position:'absolute', inset:0 }}>
            <MapWrapper
              spots={visibleSpots}
              baseLayer={baseLayer}
              layers={mapLayers}
              userLocation={coordinates}
              selectedSpot={selectedSpot}
              sheetOpen={sheetOpen}
              onSpotSelect={(spot) => {
                setSelectedSpot(spot);
                setMapPopupOpen(true);
              }}
              onPopupOpen={(spot) => {
                setSelectedSpot(spot);
                setMapPopupOpen(true);
              }}
              onPopupClose={() => {
                setMapPopupOpen(false);
                setSelectedSpot(null);
              }}
            />

            {!authReady && (
              <div role="status" style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', zIndex:20, background:'rgba(2,6,23,0.48)', backdropFilter:'blur(3px)' }}>
                <div style={{ background:'rgba(7,17,27,0.96)', border:'1px solid #1d3442', borderRadius:'14px', padding:'18px 20px', color:'#cbd5e1', fontSize:'13px', fontWeight:700 }}>Checking account…</div>
              </div>
            )}
            {authReady && !isAuthenticated && (
              <div role="status" style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', zIndex:20, background:'rgba(2,6,23,0.42)', backdropFilter:'blur(3px)' }}>
                <div style={{ maxWidth:'300px', margin:'16px', textAlign:'center', background:'rgba(7,17,27,0.97)', border:'1px solid #1d3442', borderRadius:'16px', padding:'22px', boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}>
                  <div style={{ fontSize:'15px', fontWeight:800, color:'#e2f7ff' }}>Sign in to explore spots</div>
                  <p style={{ margin:'8px 0 16px', color:'#94a3b8', fontSize:'12px', lineHeight:1.5 }}>Fishing locations are private to account holders. Sign in to view exact map points and conditions.</p>
                  <a href="/auth/login?next=/" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minHeight:'38px', padding:'0 16px', borderRadius:'9px', background:'#0369a1', color:'white', fontSize:'12px', fontWeight:800, textDecoration:'none' }}>Log in or create account</a>
                </div>
              </div>
            )}

            {/* Floating spot count badge */}
            <div style={{ position:'absolute', top:'12px', left:'12px', right:'12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', zIndex:10 }}>
              <div style={PAGE_STYLES.mapBadge}>
                {visibleSpots.length}{' '}{nearbyMode ? 'nearby ' : ''}public waters
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
            <SettingCard
              icon="🔔"
              title="Notifications"
              description="Browser permission only. Server-sent hot-bite alerts require VAPID keys, subscription storage, and review."
              status={notificationState === 'unsupported' ? 'UNAVAILABLE' : notificationState.toUpperCase()}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <PreferenceButton
                  label={notificationsPreferred ? 'Notifications enabled' : 'Enable notifications'}
                  selected={notificationsPreferred && notificationState === 'granted'}
                  onSelect={() => void requestNotificationPermission()}
                />
              </div>
              {notificationState === 'denied' && (
                <p style={{ margin: '8px 0 0', color: '#fca5a5', fontSize: '10px' }}>
                  Browser permission is blocked. Enable it in Android browser/site settings.
                </p>
              )}
              {notificationState === 'unsupported' && (
                <p style={{ margin: '8px 0 0', color: '#fca5a5', fontSize: '10px' }}>
                  This browser or app shell does not expose the Notifications API.
                </p>
              )}
            </SettingCard>

            <SettingCard
              icon="📍"
              title="Location"
              description="Uses browser GPS only for local nearby-water sorting. Coordinates stay on this device by default."
              status={locationSettingStatus}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <PreferenceButton
                  label={locationStatus === 'locating' ? 'Finding location…' : locationStatus === 'active' ? 'Stop GPS' : 'Enable GPS'}
                  selected={locationStatus === 'active'}
                  onSelect={startLocationTracking}
                />
                <PreferenceButton
                  label="Show all waters"
                  selected={!nearbyMode}
                  onSelect={() => setNearbyMode(false)}
                />
              </div>
            </SettingCard>

            <SettingCard
              icon="🌡"
              title="Units"
              description="Saved locally. Temperature and location formatting stays in Fahrenheit/miles for now."
              status={unitPreferenceLabel}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <PreferenceButton
                  label="Imperial (lbs, ft, °F)"
                  selected={unitsPreference === 'imperial'}
                  onSelect={() => {
                    setUnitsPreference('imperial');
                    saveStoredValue(SETTINGS_STORAGE_KEYS.units, 'imperial');
                  }}
                />
                <PreferenceButton
                  label="Metric (kg, m, °C)"
                  selected={unitsPreference === 'metric'}
                  onSelect={() => {
                    setUnitsPreference('metric');
                    saveStoredValue(SETTINGS_STORAGE_KEYS.units, 'metric');
                  }}
                />
              </div>
              {unitsPreference === 'metric' && (
                <p style={{ margin: '8px 0 0', color: '#fbbf24', fontSize: '10px' }}>
                  Metric preference is saved; display conversion is staged for the next UI consistency pass.
                </p>
              )}
            </SettingCard>

            <SettingCard
              icon="🗺"
              title="Map Style"
              description="Selects the active base map immediately. Dark and Explore use the same current tile source."
              status={mapStyleLabel}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {BASE_STYLE_OPTIONS.map((option) => (
                  <PreferenceButton
                    key={option.id}
                    label={option.label}
                    selected={baseLayer === option.id}
                    onSelect={() => {
                      setBaseLayer(option.id);
                      saveStoredValue(SETTINGS_STORAGE_KEYS.mapStyle, option.id);
                    }}
                  />
                ))}
              </div>
            </SettingCard>

            <SettingCard
              icon="🔁"
              title="Auto-refresh"
              description="Refreshes only while the app is visible and online. AI and image routes never refresh automatically."
              status={autoRefreshLabel}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {AUTO_REFRESH_OPTIONS.map((option) => (
                  <PreferenceButton
                    key={option.id}
                    label={option.label}
                    selected={autoRefreshPreference === option.id}
                    onSelect={() => {
                      setAutoRefreshPreference(option.id);
                      saveStoredValue(SETTINGS_STORAGE_KEYS.autoRefresh, option.id);
                    }}
                  />
                ))}
              </div>
            </SettingCard>
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

