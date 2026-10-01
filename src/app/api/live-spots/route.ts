import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';
import { enforceRateLimit } from '@/lib/security';
import { normalizeProviderSpots } from '@/lib/spotProvenance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, { name: 'live-spots', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat') || '34.999');
  const lon = Number(searchParams.get('lon') || '-97.366');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
  }

  const providers = [
    process.env.SPOTS_API,
    process.env.NEXT_PUBLIC_SPOTS_API_URL,
    'https://seamcast-api.vercel.app/api/spots',
    'https://seamcast-spots.vercel.app/api/spots',
  ].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

  for (const provider of providers) {
    try {
      const remoteUrl = new URL(provider);
      remoteUrl.searchParams.set('lat', String(lat));
      remoteUrl.searchParams.set('lon', String(lon));
      const res = await fetch(remoteUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) continue;

      const data = normalizeProviderSpots(await res.json(), DEFAULT_SPOTS);
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': data.data_mode ?? 'provider' },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: 'Unable to load provider fishing spots.', live: false },
    { status: 502 }
  );
}
