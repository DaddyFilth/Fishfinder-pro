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
        id: String(item.id ?? `live-${i}`),
        name,
        lat: itemLat,
        lng: itemLng,
        source: 'seamcast-spots',
        live: true,
        ...item,
      };
    })
    .filter(Boolean) as AnyRec[];

  // Never turn a missing coordinate into a pin at the user's search center.
  // Use the verified public-water catalog instead so every fallback marker is a real spot.
  const outSpots = spots.length > 0 ? spots : [...DEFAULT_SPOTS];
  const source = spots.length > 0 ? 'seamcast-spots' : 'verified-public-water-catalog';

  return {
    ...root,
    live: spots.length > 0,
    source,
    spots: outSpots,
    microSpots: Array.isArray(root.microSpots) ? root.microSpots : outSpots,
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
      return NextResponse.json(normalize({ spots: DEFAULT_SPOTS, live: false }));
    }
    const text = await res.text();
    const json = JSON.parse(text) as unknown;
    return NextResponse.json(normalize(json));
  } catch {
    return NextResponse.json(normalize({ spots: DEFAULT_SPOTS, live: false }));
  }
}
