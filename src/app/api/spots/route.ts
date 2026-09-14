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
  const fallbackSpots = DEFAULT_SPOTS.filter(isOklahomaSpot);

  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(fallbackSpots, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
      });
    }

    const { data: spots, error } = await supabase
      .from('fishing_spots')
      .select('*')
      .order('name');

    // If database table is empty or errored, return the catalog
    if (error || !spots || spots.length === 0) {
      return NextResponse.json(fallbackSpots, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
      });
    }

    const oklahomaSpots = spots.filter(isOklahomaSpot);
    return NextResponse.json(oklahomaSpots.length > 0 ? oklahomaSpots : fallbackSpots, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json(fallbackSpots, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
    });
  }
}
