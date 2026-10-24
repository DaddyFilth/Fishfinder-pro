import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_SPOTS, toFallbackSpot } from '@/lib/defaultSpots';
import { enforceRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, { name: 'public-spots', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const catalogSpots = DEFAULT_SPOTS.map((spot) => ({
    ...toFallbackSpot(spot),
    source: 'bundled-public-water-catalog',
  }));

  return NextResponse.json(
    {
      spots: catalogSpots,
      source: 'bundled-public-water-catalog',
      data_mode: 'fallback',
      live: false,
    },
    { headers: { 'Cache-Control': 'public, max-age=300', 'x-fishfinder-data-mode': 'fallback' } },
  );
}
