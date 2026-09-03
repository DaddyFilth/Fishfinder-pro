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
  
  return NextResponse.json(data && data.length > 0 ? data : [...DEFAULT_SPOTS]);
  
}










