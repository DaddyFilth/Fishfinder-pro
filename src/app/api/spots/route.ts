import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SPOTS, OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';
import { enforceRateLimit } from '@/lib/security';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REMOTE = 'https://seamcast-spots.vercel.app/api/spots';
const REMOTE_TIMEOUT_MS = 8_000;
const REMOTE_CACHE_TTL_MS = 60_000;

type AnyRec = Record<string, unknown>;

type RemoteResult = { payload: AnyRec; reason: string | null };

/** Shared cache and single-flight guard so a page load cannot stampede the provider. */
const REMOTE_FAILURE_TTL_MS = 15_000;
const REMOTE_CACHE_MAX_ENTRIES = 200;
const remoteCache = new Map<string, { expiresAt: number; payload: AnyRec; reason: string | null }>();
const remoteInFlight = new Map<string, Promise<RemoteResult>>();

function readRemoteCache(key: string): RemoteResult | null {
  const entry = remoteCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    remoteCache.delete(key);
    return null;
  }
  return { payload: entry.payload, reason: entry.reason };
}

function writeRemoteCache(key: string, payload: AnyRec, reason: string | null, ttlMs: number) {
  if (remoteCache.size >= REMOTE_CACHE_MAX_ENTRIES) {
    const now = Date.now();
    for (const [entryKey, entry] of remoteCache) {
      if (entry.expiresAt <= now) remoteCache.delete(entryKey);
    }
    while (remoteCache.size >= REMOTE_CACHE_MAX_ENTRIES) {
      const oldest = remoteCache.keys().next().value;
      if (oldest === undefined) break;
      remoteCache.delete(oldest);
    }
  }

  remoteCache.set(key, { expiresAt: Date.now() + ttlMs, payload, reason });
}

async function fetchRemoteSpots(key: string, url: string): Promise<RemoteResult> {
  const cached = readRemoteCache(key);
  if (cached) return cached;

  const pending = remoteInFlight.get(key);
  if (pending) return pending;

  const task = (async (): Promise<RemoteResult> => {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
      });

      if (!res.ok) {
        console.warn('[API] remote spots request failed', { status: res.status });
        const reason = `upstream ${res.status}`;
        return { payload: { error: 'Live AI spot feed is unavailable.' }, reason };
      }

      const json = JSON.parse(await res.text()) as unknown;
      const payload = normalize(json);
      const reason = payload.data_mode === 'provider' ? null : 'empty provider response';
      writeRemoteCache(key, payload, reason, REMOTE_CACHE_TTL_MS);
      return { payload, reason };
    } catch (error) {
      console.warn('[API] remote spots request failed', {
        kind: error instanceof Error ? error.name : 'unknown',
      });
      const reason = 'upstream unreachable';
      return { payload: { error: 'Live AI spot feed is unavailable.' }, reason };
    }
  })();

  remoteInFlight.set(key, task);
  try {
    return await task;
  } finally {
    remoteInFlight.delete(key);
  }
}

function num(v: unknown, fallback: number): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isOklahomaCoordinate(lat: number, lng: number) {
  return (
    lat >= OKLAHOMA_BOUNDS.minLat &&
    lat <= OKLAHOMA_BOUNDS.maxLat &&
    lng >= OKLAHOMA_BOUNDS.minLng &&
    lng <= OKLAHOMA_BOUNDS.maxLng
  );
}

function normalize(payload: unknown): AnyRec {
  const root = (payload && typeof payload === 'object' ? payload : {}) as AnyRec;
  // `microSpots` are AI-generated structure suggestions for one queried area,
  // not the application's statewide spot catalog. Treating them as spot rows
  // collapses the map to the provider's three suggestions. Full provider spot
  // rows still win when supplied; otherwise the bundled 76-water catalog is
  // used and each selected spot gets live conditions from its conditions route.
  const rawList =
    (Array.isArray(root.spots) && root.spots.length > 0 && root.spots) ||
    (Array.isArray(payload) ? payload : []);

  const spots = (rawList as AnyRec[])
    .map((s, i) => {
      const item = s && typeof s === 'object' ? s : {};
      const itemLat = num(item.lat ?? item.latitude, Number.NaN);
      const itemLng = num(item.lng ?? item.lon ?? item.longitude, Number.NaN);
      const name = String(item.name ?? item.label ?? item.title ?? '').trim();
      if (!name || !isOklahomaCoordinate(itemLat, itemLng)) return null;
      return {
        ...item,
        id: String(item.id ?? `provider-${i}`),
        name,
        lat: itemLat,
        lng: itemLng,
        water_type: typeof item.water_type === 'string' ? item.water_type : 'freshwater',
        spot_type: typeof item.spot_type === 'string' ? item.spot_type : 'fishing spot',
        source: 'seamcast-spots',
        live: false,
        data_mode: 'provider',
      };
    })
    .filter(Boolean) as AnyRec[];

  const rawConditions = root.conditions && typeof root.conditions === 'object'
    ? root.conditions as AnyRec
    : undefined;
  const observedAt =
    typeof root.observed_at === 'string'
      ? root.observed_at
      : typeof rawConditions?.issuedAt === 'string'
        ? rawConditions.issuedAt
        : undefined;
  const source = typeof root.source === 'string' ? root.source : 'seamcast-spots';
  const dataMode = spots.length > 0 ? 'provider' : 'unavailable';
  const normalizedSpots = spots.map((spot) => ({
    ...spot,
    source,
    live: true,
    data_mode: dataMode,
    observed_at: observedAt,
  }));

  return {
    ...root,
    live: false,
    data_mode: dataMode,
    source: spots.length > 0 ? source : 'verified-public-water-catalog',
    observed_at: observedAt,
    spots: normalizedSpots,
    microSpots: normalizedSpots,
  };
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'public-spots', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const url = new URL(req.url);
  const lat = num(url.searchParams.get('lat'), 34.999);
  const lon = num(url.searchParams.get('lon'), -97.366);

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from('spots')
      .select('id, name, lat, lng, water_type, spot_type, usgs_site_id, noaa_station_id')
      .order('name', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const storedSpots = data
        .filter((spot) => typeof spot.lat === 'number' && typeof spot.lng === 'number' && isOklahomaCoordinate(spot.lat, spot.lng))
        .map((spot) => ({
          ...spot,
          source: 'supabase-live',
          live: true,
          data_mode: 'provider',
        }));
      if (storedSpots.length > 0) {
        return NextResponse.json({
          spots: storedSpots,
          source: 'supabase-live',
          live: true,
          data_mode: 'provider',
          observed_at: new Date().toISOString(),
        }, { headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': 'provider' } });
      }
    }
  }

  const key = `${lat}:${lon}`;
  const { payload, reason } = await fetchRemoteSpots(key, `${REMOTE}?lat=${lat}&lon=${lon}`);

  if (reason || !Array.isArray(payload.spots) || payload.spots.length === 0) {
    const catalogSpots = DEFAULT_SPOTS.map(({ id, name, lat, lng, water_type, spot_type }) => ({
      id,
      name,
      lat,
      lng,
      water_type,
      spot_type,
      source: 'bundled-public-water-catalog',
      live: false,
      data_mode: 'fallback',
    }));

    return NextResponse.json(
      {
        spots: catalogSpots,
        source: 'bundled-public-water-catalog',
        data_mode: 'fallback',
        live: false,
        warning: 'Live spot provider unavailable; showing the bundled public-water catalog.',
      },
      { headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': 'fallback' } },
    );
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
      'x-fishfinder-data-mode': 'provider',
    },
  });
}
