import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchNWSConditions,
  fetchUSGSWaterData,
  fetchMarineConditions,
  fetchTideData,
} from '@/lib/fetchers/environmental';
import { calculateFishingScore } from '@/lib/scoring/fishingScore';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthContext } from '@/lib/auth/server';
import { enforceRateLimit } from '@/lib/security';
import { fetchSeamcastSpotSuggestions } from '@/lib/seamcastSpotsClient';
import { OKLAHOMA_BOUNDS } from '@/lib/defaultSpots';
import { z } from 'zod';

const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
const MEMORY_FALLBACK_TTL_MS = 2 * 60 * 1000;

const idSchema = z.object({ id: z.string().min(1).max(128) });
const sensorSiteSchema = z.string().regex(/^[A-Za-z0-9._-]{1,32}$/);

type Json = Record<string, unknown>;

type ResolvedSpot = {
  id: string;
  lat: number;
  lng: number;
  water_type: string;
  usgs_site_id: string | null;
  noaa_station_id: string | null;
};

type BuildResult = {
  status: number;
  payload: Json;
  cacheControl: string;
  extraHeaders?: Record<string, string>;
};

type MemoryEntry = BuildResult & { expiresAt: number };

/**
 * Per-instance cache and single-flight guard. One page load asks for every
 * visible spot, so without this each selection re-issues provider calls that the
 * upstream weather/water APIs rate limit (which is what surfaced as 503s).
 */
const memoryCache = new Map<string, MemoryEntry>();
const inFlight = new Map<string, Promise<BuildResult>>();

function readMemory(id: string): BuildResult | null {
  const entry = memoryCache.get(id);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(id);
    return null;
  }
  return {
    status: entry.status,
    payload: entry.payload,
    cacheControl: entry.cacheControl,
    extraHeaders: entry.extraHeaders,
  };
}

function writeMemory(id: string, result: BuildResult) {
  if (result.status !== 200) return;
  if (memoryCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of memoryCache) {
      if (entry.expiresAt <= now) memoryCache.delete(key);
    }
    if (memoryCache.size > 500) {
      const oldest = memoryCache.keys().next().value;
      if (oldest !== undefined) memoryCache.delete(oldest);
    }
  }

  const mode = String(result.payload.data_mode ?? '');
  const ttl = mode === 'fallback' || mode === 'unavailable'
    ? MEMORY_FALLBACK_TTL_MS
    : MEMORY_CACHE_TTL_MS;

  memoryCache.set(id, { ...result, expiresAt: Date.now() + ttl });
}

function readCoordinate(param: string | null): number | null {
  if (param === null || param.trim() === '') return null;
  const value = Number(param);
  return Number.isFinite(value) ? value : null;
}

function isOklahomaCoordinate(lat: number, lng: number) {
  return (
    lat >= OKLAHOMA_BOUNDS.minLat &&
    lat <= OKLAHOMA_BOUNDS.maxLat &&
    lng >= OKLAHOMA_BOUNDS.minLng &&
    lng <= OKLAHOMA_BOUNDS.maxLng
  );
}

function readSensorSite(value: string | null): string | null {
  if (!value) return null;
  const parsed = sensorSiteSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Resolve a spot from the database first, then the bundled catalog, and finally
 * from coordinates the client already holds for the selected pin. Provider spots
 * are not always present in the database, and an id lookup alone cannot describe
 * them, so the coordinates are the documented fallback.
 */
async function resolveSpot(
  supabase: SupabaseClient | null,
  id: string,
  request: NextRequest,
): Promise<ResolvedSpot | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('spots')
        .select('id, lat, lng, water_type, usgs_site_id, noaa_station_id')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return {
            id,
            lat,
            lng,
            water_type: typeof data.water_type === 'string' ? data.water_type : 'freshwater',
            usgs_site_id: typeof data.usgs_site_id === 'string' ? data.usgs_site_id : null,
            noaa_station_id: typeof data.noaa_station_id === 'string' ? data.noaa_station_id : null,
          };
        }
      }
    } catch (error) {
      console.warn('[API] spot lookup failed', {
        provider: 'Supabase',
        spotId: id,
        kind: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  const url = new URL(request.url);
  const lat = readCoordinate(url.searchParams.get('lat'));
  const lng = readCoordinate(url.searchParams.get('lng'));

  if (lat === null || lng === null || !isOklahomaCoordinate(lat, lng)) return null;

  return {
    id,
    lat,
    lng,
    water_type: url.searchParams.get('water_type') === 'saltwater' ? 'saltwater' : 'freshwater',
    usgs_site_id: readSensorSite(url.searchParams.get('usgs')),
    noaa_station_id: readSensorSite(url.searchParams.get('noaa')),
  };
}

function unavailablePayload(id: string): Json {
  const neutralScore = calculateFishingScore({
    air_temp_c: null,
    water_temp_c: null,
    wind_speed_ms: null,
    wave_height_m: null,
    dissolved_oxygen_mgl: null,
    tide_type: null,
  });

  return {
    spot_id: id,
    captured_at: null,
    air_temp_c: null,
    wind_speed_ms: null,
    water_temp_c: null,
    water_level_m: null,
    flow_rate_cfs: null,
    dissolved_oxygen_mgl: null,
    wave_height_m: null,
    wave_period_s: null,
    swell_direction_deg: null,
    tide_height_m: null,
    fishing_score: neutralScore.total,
    bite_score: null,
    bite_level: null,
    ai_micro_spots: [],
    score_breakdown: neutralScore,
    data_sources: [],
    cached: false,
    stale: false,
    live: false,
    data_mode: 'fallback',
    warning:
      'Live provider conditions are unavailable right now. Values shown are neutral defaults, not measurements.',
  };
}

async function buildConditions(request: NextRequest, id: string): Promise<BuildResult> {
  try {
    const supabase = getSupabaseAdmin();
    const spot = await resolveSpot(supabase, id, request);

    if (!spot) {
      return {
        status: 404,
        payload: { error: 'Spot not found', data_mode: 'unavailable' },
        cacheControl: 'no-store',
      };
    }

    let cached: Record<string, unknown> | null = null;

    if (supabase) {
      const { data: snapshot, error: cacheReadError } = await supabase
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
      } else {
        cached = snapshot ?? null;
      }
    }

    const seamcast = await fetchSeamcastSpotSuggestions(spot.lat, spot.lng);
    const biteScore = typeof seamcast?.overallBite?.score === 'number'
      ? seamcast.overallBite.score
      : null;
    const biteLevel = seamcast?.overallBite?.level ?? null;

    const cachedIsFallback = Boolean(
      cached && (
        cached.data_mode === 'fallback' ||
        (Array.isArray(cached.data_sources) &&
          cached.data_sources.some((source: unknown) =>
            typeof source === 'string' && source.toLowerCase().includes('fallback'),
          ))
      ),
    );

    const cachedCapturedAt = typeof cached?.captured_at === 'string'
      ? Date.parse(cached.captured_at)
      : Number.NaN;
    const cacheAgeMs = cached && Number.isFinite(cachedCapturedAt)
      ? Date.now() - cachedCapturedAt
      : Number.POSITIVE_INFINITY;

    if (cached && !cachedIsFallback && cacheAgeMs <= CACHE_MAX_AGE_MS) {
      return {
        status: 200,
          payload: {
            ...cached,
            bite_score: biteScore,
            bite_level: biteLevel,
            ai_micro_spots: seamcast?.microSpots ?? [],
            cached: true,
            stale: false,
            data_mode: 'cached',
          },
        cacheControl: 'public, max-age=1800',
      };
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

    const dataSources = [
      nwsData?.source,
      usgsData?.source,
      marineData?.source,
      tideData?.source,
    ].filter((source): source is string => typeof source === 'string' && source.length > 0);

    if (dataSources.length === 0) {
      return {
        status: 503,
        payload: {
          error: 'Live environmental conditions are unavailable; no score or prediction was generated.',
          spot_id: id,
          data_mode: 'unavailable',
          live: false,
        },
        cacheControl: 'no-store',
      };
    }

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
      bite_score: biteScore,
      bite_level: biteLevel,
      ai_micro_spots: seamcast?.microSpots ?? [],
      score_breakdown: scoreResult,
      data_sources: dataSources,
    };

    const providerPayload: Json = {
      ...snapshot,
      captured_at: new Date().toISOString(),
      cached: false,
      stale: false,
      live: false,
      data_mode: 'provider',
    };

    if (!supabase) {
      return {
        status: 200,
        payload: providerPayload,
        cacheControl: 'public, max-age=1800',
      };
    }

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

      return {
        status: 200,
        payload: providerPayload,
        cacheControl: 'no-store',
        extraHeaders: { 'x-fishfinder-cache': 'write-failed' },
      };
    }

    return {
      status: 200,
      payload: { ...inserted, cached: false, stale: false, live: false, data_mode: 'provider' },
      cacheControl: 'public, max-age=1800',
    };
  } catch (error) {
    console.warn('[API] spot conditions failed', {
      spotId: id,
      kind: error instanceof Error ? error.name : 'unknown',
    });

    return {
      status: 200,
      payload: unavailablePayload(id),
      cacheControl: 'public, max-age=60',
    };
  }
}

function respond(result: BuildResult, cached = false) {
  const dataMode = String(result.payload.data_mode ?? 'unavailable');
  const headers: Record<string, string> = {
    'Cache-Control': result.cacheControl,
    'x-fishfinder-data-mode': dataMode,
    ...result.extraHeaders,
  };
  if (cached) headers['x-fishfinder-cache'] = 'hit';

  return NextResponse.json(result.payload, { status: result.status, headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await enforceRateLimit(request, {
    name: 'spot-conditions',
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  // Enforced here as well as in the proxy: this handler reads through a service-role client that
  // bypasses RLS, so it must never rely on proxy config alone for access control.
  const context = await getAuthContext();
  if (!context) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const parsed = idSchema.safeParse(await params);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid spot ID' }, { status: 400 });
  }

  const { id } = parsed.data;

  const cached = readMemory(id);
  if (cached) return respond(cached, true);

  const pending = inFlight.get(id);
  if (pending) return respond(await pending, true);

  const task = buildConditions(request, id);
  inFlight.set(id, task);

  let result: BuildResult;
  try {
    result = await task;
  } finally {
    inFlight.delete(id);
  }

  writeMemory(id, result);
  return respond(result);
}
