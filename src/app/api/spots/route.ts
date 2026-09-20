import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REMOTE = 'https://seamcast-spots.vercel.app/api/spots';

type AnyRec = Record<string, unknown>;

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalize(payload: unknown, lat: number, lon: number): AnyRec {
  const root = (payload && typeof payload === 'object' ? payload : {}) as AnyRec;
  const rawList =
    (Array.isArray(root.microSpots) && root.microSpots) ||
    (Array.isArray(root.spots) && root.spots) ||
    (Array.isArray(payload) ? payload : []);

  const spots = (rawList as AnyRec[]).map((s, i) => {
    const item = s && typeof s === 'object' ? s : {};
    return {
      id: String(item.id ?? `live-${i}`),
      name: String(item.name ?? item.label ?? item.title ?? `Live spot ${i + 1}`),
      lat: num(item.lat ?? item.latitude, lat),
      lng: num(item.lng ?? item.lon ?? item.longitude, lon),
      source: 'seamcast-spots',
      live: true,
      ...item,
    };
  });

  const outSpots =
    spots.length > 0
      ? spots
      : [
          {
            id: 'live-center',
            name: 'Live AI pin',
            lat,
            lng: lon,
            source: 'seamcast-spots',
            live: true,
          },
        ];

  return {
    ...root,
    live: true,
    source: 'seamcast-spots',
    spots: outSpots,
    microSpots: Array.isArray(root.microSpots) ? root.microSpots : outSpots,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lat = num(url.searchParams.get('lat'), 34.999);
  const lon = num(url.searchParams.get('lon'), -97.366);

  try {
    const res = await fetch(`${REMOTE}?lat=${lat}&lon=${lon}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Remote spots API failed', status: res.status, detail: text, live: false },
        { status: 502 },
      );
    }
    const json = JSON.parse(text) as unknown;
    return NextResponse.json(normalize(json, lat, lon));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Error calling remote spots API', detail: message, live: false },
      { status: 500 },
    );
  }
}
