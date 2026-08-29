import { NextRequest, NextResponse } from 'next/server';
import { fetchNWSConditions, fetchUSGSWaterData, fetchMarineConditions, fetchTideData } from '@/lib/fetchers/environmental';
import { calculateFishingScore } from '@/lib/scoring/fishingScore';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'Database is not configured' }, { status: 503 });
  const parsed = z.object({ id: z.string().uuid() }).safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid spot ID' }, { status: 400 });

  const { id: id } = parsed.data;
  const { data: spot, error: spotErr } = await supabase
    .from('fishing_spots').select('*').eq('id', id).single();
  if (spotErr || !spot) return NextResponse.json({ error: 'Spot not found' }, { status: 404 });

  // Return cache if fresher than 30 min
  const { data: cached } = await supabase
    .from('environmental_snapshots').select('*').eq('spot_id', id)
    .gte('captured_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('captured_at', { ascending: false }).limit(1).single();
  if (cached) return NextResponse.json({ ...cached, cached: true }, { headers: { 'Cache-Control': 'public, max-age=1800' } });

  // Fetch all sources in parallel — failures don't block other sources
  const [nws, usgs, marine, tides] = await Promise.allSettled([
    fetchNWSConditions(spot.lat, spot.lng),
    spot.usgs_site_id   ? fetchUSGSWaterData(spot.usgs_site_id)      : Promise.resolve(null),
    spot.water_type !== 'freshwater' ? fetchMarineConditions(spot.lat, spot.lng) : Promise.resolve(null),
    spot.noaa_station_id ? fetchTideData(spot.noaa_station_id)       : Promise.resolve(null),
  ]);

  const nwsData    = nws.status    === 'fulfilled' ? nws.value    : null;
  const usgsData   = usgs.status   === 'fulfilled' ? usgs.value   : null;
  const marineData = marine.status === 'fulfilled' ? marine.value : null;
  const tideData   = tides.status  === 'fulfilled' ? tides.value  : null;

  const dataSources = [nwsData?.source, usgsData?.source, marineData?.source, tideData?.source].filter(Boolean);

  const water_temp_c = (usgsData?.water_temp_c as number | null) ?? (marineData?.sea_surface_temp_c ?? null);
  const water_level_ft = (usgsData?.water_level_ft as number | null) ?? null;
  const water_level_m  = water_level_ft !== null ? Math.round(water_level_ft * 0.3048 * 100) / 100 : null;

  const scoreInput = {
    air_temp_c:           nwsData?.air_temp_c ?? null,
    water_temp_c,
    wind_speed_ms:        nwsData?.wind_speed_ms ?? null,
    wave_height_m:        marineData?.wave_height_m ?? null,
    dissolved_oxygen_mgl: (usgsData?.dissolved_oxygen_mgl as number | null) ?? null,
    tide_type:            null,
    is_daytime:           nwsData?.is_daytime ?? undefined,
  };

  const scoreResult = calculateFishingScore(scoreInput);

  const snapshot = {
    spot_id:              id,
    air_temp_c:           nwsData?.air_temp_c ?? null,
    wind_speed_ms:        nwsData?.wind_speed_ms ?? null,
    water_temp_c,
    water_level_m,
    flow_rate_cfs:        (usgsData?.flow_rate_cfs as number | null) ?? null,
    dissolved_oxygen_mgl: scoreInput.dissolved_oxygen_mgl,
    wave_height_m:        marineData?.wave_height_m ?? null,
    wave_period_s:        marineData?.wave_period_s ?? null,
    swell_direction_deg:  marineData?.wave_direction_deg ?? null,
    tide_height_m:        tideData?.tide_height_m ?? null,
    fishing_score:        scoreResult.total,
    score_breakdown:      scoreResult,
    data_sources:         dataSources,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('environmental_snapshots').insert(snapshot).select().single();

  if (insertErr) {
    console.error('[API] snapshot insert error:', insertErr.message);
    return NextResponse.json({ ...snapshot, cached: false, captured_at: new Date().toISOString() });
  }

  return NextResponse.json({ ...inserted, cached: false }, {
    headers: { 'Cache-Control': 'public, max-age=1800' }
  });
}
