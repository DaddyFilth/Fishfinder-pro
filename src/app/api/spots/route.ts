import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_SPOTS, OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

function isOklahomaSpot(spot: { lat: number; lng: number }) {
  return (
    spot.lat >= OKLAHOMA_BOUNDS.minLat &&
    spot.lat <= OKLAHOMA_BOUNDS.maxLat &&
    spot.lng >= OKLAHOMA_BOUNDS.minLng &&
    spot.lng <= OKLAHOMA_BOUNDS.maxLng
  );
}

export async function GET() {
  const fallbackHeaders = {
    'Cache-Control': 'no-store',
    'x-fishfinder-data-mode': 'fallback',
  };

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json([...DEFAULT_SPOTS], {
        headers: fallbackHeaders,
      });
    }

    const { data: spots, error } = await supabase
      .from('fishing_spots')
      .select('*')
      .order('name');

    if (error) {
      return NextResponse.json([...DEFAULT_SPOTS], {
        headers: fallbackHeaders,
      });
    }

    const oklahomaSpots = (spots ?? []).filter(isOklahomaSpot);
    if (oklahomaSpots.length === 0) {
      return NextResponse.json([...DEFAULT_SPOTS], {
        headers: fallbackHeaders,
      });
    }

    return NextResponse.json(oklahomaSpots, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600',
        'x-fishfinder-data-mode': 'live',
      },
    });
  } catch {
    return NextResponse.json([...DEFAULT_SPOTS], {
      headers: fallbackHeaders,
    });
  }
}
