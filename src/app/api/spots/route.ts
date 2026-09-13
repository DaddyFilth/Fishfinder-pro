import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_SPOTS, OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

function isOklahomaSpot(spot: { lat: number; lng: number }) {
  return (
    spot.lat >= OKLAHOMA_BOUNDS.minLat &&
    spot.lat <= OKLAHOMA_BOUNDS.maxLat &&
    spot.lng >= OKLAHOMA_BOUNDS.minLng &&
    spot.lng <= OKLAHOMA_BOUNDS.maxLng
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      const filteredDefaults = DEFAULT_SPOTS.filter(isOklahomaSpot);
      return NextResponse.json(filteredDefaults, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
        },
      });
    }

    const { data: spots, error } = await supabase
      .from('fishing_spots')
      .select('*')
      .order('name');

    if (error || !spots || spots.length === 0) {
      const filteredDefaults = DEFAULT_SPOTS.filter(isOklahomaSpot);
      return NextResponse.json(filteredDefaults, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
        },
      });
    }

    const oklahomaSpots = spots.filter(isOklahomaSpot);
    return NextResponse.json(oklahomaSpots, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
      },
    });
  } catch {
    const filteredDefaults = DEFAULT_SPOTS.filter(isOklahomaSpot);
    return NextResponse.json(filteredDefaults, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800',
      },
    });
  }
}
