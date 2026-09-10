import { NextRequest, NextResponse } from 'next/server';
import {
  fetchNWSConditions,
  fetchUSGSWaterData,
  fetchMarineConditions,
  fetchTideData,
} from '@/lib/fetchers/environmental';
import { calculateFishingScore } from '@/lib/scoring/fishingScore';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_SPOTS, getDefaultCondition } from '@/lib/defaultSpots';
import { z } from 'zod';

const CACHE_MAX_AGE_MS = 30 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = z
    .object({ id: z.string().min(1).max(128) })
    .safeParse(await params);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid spot ID' },
      { status: 400 },
    );
  }

  const { id } = parsed.data;
  const fallbackSpot = DEFAULT_SPOTS.find((spot) => spot.id === id);
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    if (fallbackSpot) {
      return NextResponse.json(getDefaultCondition(fallbackSpot), {
        headers: { 'x-fishfinder-data-mode': 'local-fallback' },
      });
    }

    return NextResponse.json(
      { error: 'Database is not configured' },
      { status: 503 },
    );
  }

  const { data: spot, error: spotErr } = await supabase
    .from('fishing_spots')
    .select('*')
    .eq('id', id)
    .single();

  if (spotErr || !spot) {
    if (fallbackSpot) {
      return NextResponse.json(getDefaultCondition(fallbackSpot), {
        headers: { 'x-fishfinder-data-mode': 'local-fallback' },
      });
    }

    return NextResponse.json(
      { error: 'Spot not found' },
      { status: 404 },
    );
  }

  const { data: cached, error: cacheReadError } = await supabase
    .from('environmental_snapshots')
    .select('*')
    .eq('spot_id', id)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cacheReadError) {
    console.warn('[API] snapshot cache read error', {
      provider: 'Supabase',
      spotId: id,
      operation: 'read',
    });
  }

  const cacheAgeMs = cached
    ? Date.now() - new Date(cached.captured_at).getTime()
    : Number.POSITIVE_INFINITY;

  if (cached && cacheAgeMs <= CACHE_MAX_AGE_MS) {
    return NextResponse.json(
      {
        ...cached,
        cached: true,
        stale: false,
      },
      {
        headers: { 'Cache-Control': 'public, max-age=1800' },
      },
    );
  }

  const [nws, usgs, marine, tides] = await Promise.allSettled([
    fetchNWSConditions(spot.lat, spot.lng),
    spot.usgs_site_id
      ? fetchUSGSWaterData(spot.usgs_site_id)
      : Promise.resolve(null),
    spot.water_type !== 'freshwater'
      ? fetchMarineConditions(spot.lat, spot.lng)
      : Promise.resolve(null),
    spot.noaa_station_id
      ? fetchTideData(spot.noaa_station_id)
      : Promise.resolve(null),
  ]);

  if (nws.status === 'rejected') {
    const reason = nws.reason as { status?: number; name?: string } | undefined;

    console.warn('[NWS] conditions unavailable', {
      provider: 'NWS',
      spotId: id,
      status: typeof reason?.status === 'number' ? reason.status : null,
      kind: reason?.name ?? 'unknown',
    });
  }

  if (usgs.status === 'rejected') {
    console.warn('[USGS] conditions unavailable', {
      provider: 'USGS',
      spotId: id,
    });
  }

  if (marine.status === 'rejected') {
    console.warn('[Marine] conditions unavailable', {
      provider: 'Open-Meteo Marine',
      spotId: id,
    });
  }

  if (tides.status === 'rejected') {
    console.warn('[Tides] conditions unavailable', {
      provider: 'NOAA Tides',
      spotId: id,
    });
  }

  const nwsData = nws.status === 'fulfilled' ? nws.value : null;
  const usgsData = usgs.status === 'fulfilled' ? usgs.value : null;
  const marineData = marine.status === 'fulfilled' ? marine.value : null;
  const tideData = tides.status === 'fulfilled' ? tides.value : null;

  const noLiveProviderData =
    nwsData === null &&
    usgsData === null &&
    marineData === null &&
    tideData === null;

  if (noLiveProviderData && cached) {
    return NextResponse.json(
      {
        ...cached,
        cached: true,
        stale: true,
        warning:
          'Live environmental data is temporarily unavailable. Showing the latest cached conditions.',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'x-fishfinder-data-mode': 'stale-cache',
        },
      },
    );
  }

  const dataSources = [
    nwsData?.source,
    usgsData?.source,
    marineData?.source,
    tideData?.source,
  ].filter(Boolean);

  const water_temp_c =
    (usgsData?.water_temp_c as number | null) ??
    (marineData?.sea_surface_temp_c ?? null);

  const water_level_ft =
    (usgsData?.water_level_ft as number | null) ?? null;

  const water_level_m =
    water_level_ft !== null
      ? Math.round(water_level_ft * 0.3048 * 100) / 100
      : null;

  const scoreInput = {
    air_temp_c: nwsData?.air_temp_c ?? null,
    water_temp_c,
    wind_speed_ms: nwsData?.wind_speed_ms ?? null,
    wave_height_m: marineData?.wave_height_m ?? null,
    dissolved_oxygen_mgl:
      (usgsData?.dissolved_oxygen_mgl as number | null) ?? null,
    tide_type: null,
    is_daytime: nwsData?.is_daytime ?? undefined,
  };

  const scoreResult = calculateFishingScore(scoreInput);

  const snapshot = {
    spot_id: id,
    air_temp_c: nwsData?.air_temp_c ?? null,
    wind_speed_ms: nwsData?.wind_speed_ms ?? null,
    water_temp_c,
    water_level_m,
    flow_rate_cfs: (usgsData?.flow_rate_cfs as number | null) ?? null,
    dissolved_oxygen_mgl: scoreInput.dissolved_oxygen_mgl,
    wave_height_m: marineData?.wave_height_m ?? null,
    wave_period_s: marineData?.wave_period_s ?? null,
    swell_direction_deg: marineData?.wave_direction_deg ?? null,
    tide_height_m: tideData?.tide_height_m ?? null,
    fishing_score: scoreResult.total,
    score_breakdown: scoreResult,
    data_sources: dataSources,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('environmental_snapshots')
    .insert(snapshot)
    .select()
    .single();

  if (insertErr) {
    console.warn('[API] snapshot cache write error', {
      provider: 'Supabase',
      spotId: id,
      operation: 'insert',
    });

    return NextResponse.json(
      {
        ...snapshot,
        captured_at: new Date().toISOString(),
        cached: false,
        stale: false,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'x-fishfinder-cache': 'write-failed',
        },
      },
    );
  }

  return NextResponse.json(
    {
      ...inserted,
      cached: false,
      stale: false,
    },
    {
      headers: { 'Cache-Control': 'public, max-age=1800' },
    },
  );
}
