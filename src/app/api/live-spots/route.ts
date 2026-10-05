import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';
import { enforceRateLimit } from '@/lib/security';
import { normalizeProviderSpots } from '@/lib/spotProvenance';
import { fetchSeamcastResponse } from '@/lib/seamcastSpotsClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'live-spots', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat') || '34.999');
  const lon = Number(searchParams.get('lon') || '-97.366');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
  }

  try {
    const res = await fetchSeamcastResponse(new URLSearchParams({ lat: String(lat), lon: String(lon) }), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!res) {
      const data = normalizeProviderSpots(null, DEFAULT_SPOTS);
      return NextResponse.json(
        { ...data, live: false, warning: 'Provider spot feed unavailable (all upstreams failed).' },
        { headers: { 'Cache-Control': 'public, max-age=60', 'x-fishfinder-data-mode': 'fallback' } },
      );
    }

    const data = normalizeProviderSpots(await res.json(), DEFAULT_SPOTS);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': data.data_mode ?? 'provider' },
    });
  } catch {
    const data = normalizeProviderSpots(null, DEFAULT_SPOTS);
    return NextResponse.json(
      { ...data, live: false, warning: 'Provider spot feed unavailable (upstream unreachable).' },
      { headers: { 'Cache-Control': 'public, max-age=60', 'x-fishfinder-data-mode': 'fallback' } },
    );
  }
}
