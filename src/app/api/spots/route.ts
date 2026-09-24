import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SPOTS, OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';
import { enforceRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REMOTE = 'https://seamcast-spots.vercel.app/api/spots';

type AnyRec = Record<string, unknown>;

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

  try {
    const res = await fetch(`${REMOTE}?lat=${lat}&lon=${lon}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Remote spots API failed.', live: false },
        { status: 502 },
      );
    }
    const text = await res.text();
    const json = JSON.parse(text) as unknown;
    const normalized = normalize(json);
    return NextResponse.json(normalized, {
      headers: {
        'Cache-Control': 'no-store',
        'x-fishfinder-data-mode': String(normalized.data_mode),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to load fishing spots.', live: false },
      { status: 502 },
    );
  }
}
