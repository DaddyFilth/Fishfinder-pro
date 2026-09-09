import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_SPOTS, OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isOklahomaSpot(spot: { lat: number; lng: number }) {
  return Number.isFinite(spot.lat) && Number.isFinite(spot.lng) &&
    spot.lat >= OKLAHOMA_BOUNDS.minLat && spot.lat <= OKLAHOMA_BOUNDS.maxLat &&
    spot.lng >= OKLAHOMA_BOUNDS.minLng && spot.lng <= OKLAHOMA_BOUNDS.maxLng;
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json([...DEFAULT_SPOTS], { headers: { 'x-fishfinder-data-mode': 'local-fallback' } });
  const { data, error } = await supabase
    .from('fishing_spots')
    .select('id, name, lat, lng, water_type, spot_type')
    .gte('lat', OKLAHOMA_BOUNDS.minLat)
    .lte('lat', OKLAHOMA_BOUNDS.maxLat)
    .gte('lng', OKLAHOMA_BOUNDS.minLng)
    .lte('lng', OKLAHOMA_BOUNDS.maxLng)
    .order('name');
  if (error) return NextResponse.json([...DEFAULT_SPOTS], { headers: { 'x-fishfinder-data-mode': 'local-fallback' } });

  const byId = new Map(DEFAULT_SPOTS.map((spot) => [spot.id, spot]));
  for (const spot of data ?? []) {
    if (isOklahomaSpot(spot)) byId.set(spot.id, spot);
  }

  const uniqueSpots = [...byId.values()].filter(isOklahomaSpot).filter((spot, index, list) => {
    const key = `${spot.name.trim().toLowerCase()}|${spot.lat.toFixed(3)}|${spot.lng.toFixed(3)}`;
    return list.findIndex((candidate) => `${candidate.name.trim().toLowerCase()}|${candidate.lat.toFixed(3)}|${candidate.lng.toFixed(3)}` === key) === index;
  });

  return NextResponse.json(uniqueSpots, {
    headers: { 'x-fishfinder-data-mode': data && data.length > 0 ? 'supabase-plus-oklahoma-catalog' : 'oklahoma-catalog-fallback' },
  });
}
