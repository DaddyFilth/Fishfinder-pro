import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  id: z.string().min(1).max(128),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, { name: 'spot-conditions', limit: 60, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = requestSchema.safeParse({
    ...(await params),
    lat: request.nextUrl.searchParams.get('lat'),
    lng: request.nextUrl.searchParams.get('lng'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Spot coordinates are required.', data_mode: 'fallback' }, { status: 400 });
  }

  const { id, lat, lng } = parsed.data;
  try {
    const response = await fetch(`https://seamcast-spots.vercel.app/api/spots?lat=${lat}&lon=${lng}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const payload = await response.json() as Record<string, unknown>;
    const bite = payload.overallBite as Record<string, unknown> | undefined;
    const score = Number(bite?.score);
    const fishingScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;

    return NextResponse.json({
      spot_id: id,
      fishing_score: fishingScore,
      score_breakdown: bite ?? null,
      data_sources: ['seamcast-spots'],
      provider: payload.conditions ?? null,
      species: payload.speciesLikely ?? [],
      recommended_baits: payload.recommendedBaits ?? [],
      micro_spots: payload.microSpots ?? [],
      cached: false,
      stale: false,
      data_mode: 'provider',
    }, { headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': 'provider' } });
  } catch (error) {
    console.warn('[spot-conditions] seamcast-spots unavailable', { id, error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({
      spot_id: id,
      fishing_score: 0,
      score_breakdown: null,
      data_sources: [],
      cached: false,
      stale: true,
      data_mode: 'fallback',
      warning: 'Provider conditions are temporarily unavailable. Spot details remain available.',
    }, { headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': 'fallback' } });
  }
}
