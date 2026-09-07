import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';

export const revalidate = 300;

export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json([...DEFAULT_SPOTS], { headers: { 'x-fishfinder-data-mode': 'local-fallback' } });
  const { data, error } = await supabase
    .from('fishing_spots')
    .select('id, name, lat, lng, water_type, spot_type')
    .order('name');
  if (error) return NextResponse.json([...DEFAULT_SPOTS], { headers: { 'x-fishfinder-data-mode': 'local-fallback' } });

  const byId = new Map(DEFAULT_SPOTS.map((spot) => [spot.id, spot]));
  for (const spot of data ?? []) byId.set(spot.id, spot);

  return NextResponse.json([...byId.values()], {
    headers: { 'x-fishfinder-data-mode': data && data.length > 0 ? 'supabase-plus-national-fallback' : 'local-fallback' },
  });
}
