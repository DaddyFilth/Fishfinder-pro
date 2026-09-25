import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SPOTS, OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';
import { enforceRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REMOTE = 'https://seamcast-spots.vercel.app/api/spots';
const PROVIDER_CACHE_TTL_MS = 60_000;

type AnyRec = Record<string, unknown>;

const providerCache = new Map<string, { expiresAt: number; payload: AnyRec }>();

function num(v: unknown, fallback: number): number {
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
  const rawList =
    (Array.isArray(root.spots) && root.spots) ||
    (Array.isArray(root.microSpots) && root.microSpots) ||
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
        water_type: item.water_type ?? 'freshwater',
        spot_type: item.spot_type ?? 'lake',
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
  const dataMode = spots.length > 0 ? 'provider' : 'fallback';
  const normalizedSpots = spots.length > 0
    ? spots.map((spot) => ({
        ...spot,
        source,
        live: false,
        data_mode: dataMode,
        observed_at: observedAt,
      }))
    : DEFAULT_SPOTS.map((spot) => ({
        ...spot,
        source: 'verified-public-water-catalog',
        live: false,
        data_mode: 'fallback',
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
  const limited = enforceRateLimit(req, { name: 'public-spots', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const url = new URL(req.url);
  const lat = num(url.searchParams.get('lat'), 34.999);
  const lon = num(url.searchParams.get('lon'), -97.366);

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
  }

  const cacheKey = `${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const cached = providerCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'x-fishfinder-data-mode': String(cached.payload.data_mode),
      },
    });
  }

  try {
    const res = await fetch(`${REMOTE}?lat=${lat}&lon=${lon}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      if (cached) {
        const stale = { ...cached.payload, data_mode: 'cached', source: 'seamcast-spots-cache' };
        return NextResponse.json(stale, {
          headers: {
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
            'x-fishfinder-data-mode': 'cached',
          },
        });
      }
      return NextResponse.json(normalize(DEFAULT_SPOTS), {
        headers: { 'Cache-Control': 'private, max-age=30', 'x-fishfinder-data-mode': 'fallback' },
      });
    }
    const normalized = normalize(await res.json());
    if (normalized.data_mode === 'provider') {
      providerCache.set(cacheKey, { expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS, payload: normalized });
    }
    return NextResponse.json(normalized, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'x-fishfinder-data-mode': String(normalized.data_mode),
      },
    });
  } catch {
    if (cached) {
      const stale = { ...cached.payload, data_mode: 'cached', source: 'seamcast-spots-cache' };
      return NextResponse.json(stale, {
        headers: { 'Cache-Control': 'private, max-age=30', 'x-fishfinder-data-mode': 'cached' },
      });
    }
    return NextResponse.json(normalize(DEFAULT_SPOTS), {
      headers: { 'Cache-Control': 'private, max-age=30', 'x-fishfinder-data-mode': 'fallback' },
    });
  }
}
