import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';

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
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database is not configured.' },
        { status: 503 },
      );
    }

    const { data: spots, error } = await supabase
      .from('fishing_spots')
      .select('*')
      .order('name');

    if (error) {
      return NextResponse.json(
        { error: 'Unable to load fishing spots.' },
        { status: 502 },
      );
    }

    const oklahomaSpots = (spots ?? []).filter(isOklahomaSpot);
    return NextResponse.json(oklahomaSpots, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ error: 'Unexpected server error.' }, { status: 500 });
  }
}
