import axios, { AxiosError } from 'axios';
import { z } from 'zod';

const NWS_BASE = process.env.NWS_BASE ?? 'https://api.weather.gov';
const USGS_BASE = process.env.USGS_BASE ?? 'https://api.waterdata.usgs.gov';
const MARINE_BASE = process.env.OPEN_METEO_MARINE ?? 'https://marine-api.open-meteo.com/v1/marine';
const TIDES_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

const NWS_HOST = 'api.weather.gov';
const NWS_TIMEOUT_MS = 6000;

const NWSPointSchema = z.object({
  properties: z.object({
    forecast: z.string().url(),
  }),
});

const NWSForecastSchema = z.object({
  properties: z.object({
    periods: z.array(z.object({
      temperature: z.number(),
      temperatureUnit: z.string(),
      windSpeed: z.string(),
      windDirection: z.string(),
      shortForecast: z.string(),
      isDaytime: z.boolean(),
      name: z.string(),
    })).min(1),
  }),
});

const USGSSchema = z.object({
  value: z.object({
    timeSeries: z.array(z.object({
      variable: z.object({
        variableCode: z.array(z.object({ value: z.string() })),
      }),
      values: z.array(z.object({
        value: z.array(z.object({ value: z.string() })),
      })),
    })),
  }),
});

const MarineSchema = z.object({
  hourly: z.object({
    wave_height: z.array(z.number().nullable()).optional(),
    wave_period: z.array(z.number().nullable()).optional(),
    wave_direction: z.array(z.number().nullable()).optional(),
    sea_surface_temperature: z.array(z.number().nullable()).optional(),
    swell_wave_height: z.array(z.number().nullable()).optional(),
  }),
});

function safeNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return Number.isNaN(n) ? null : n;
}

function isAllowedNwsUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      url.hostname === NWS_HOST &&
      url.pathname.startsWith('/')
    );
  } catch {
    return false;
  }
}

function getNwsPointUrl(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  if (!isAllowedNwsUrl(NWS_BASE)) {
    return null;
  }

  try {
    const base = new URL(NWS_BASE);
    const basePath = base.pathname.endsWith('/')
      ? base.pathname.slice(0, -1)
      : base.pathname;

    base.pathname =
      basePath +
      '/points/' +
      lat.toFixed(4) +
      ',' +
      lng.toFixed(4);

    base.search = '';
    base.hash = '';

    return base.toString();
  } catch {
    return null;
  }
}

function logNwsFailure(
  spotLat: number,
  spotLng: number,
  error: unknown,
): void {
  const status =
    error instanceof AxiosError && typeof error.response?.status === 'number'
      ? error.response.status
      : null;

  const kind =
    error instanceof AxiosError
      ? error.code === 'ECONNABORTED'
        ? 'timeout'
        : status === 404
          ? 'http-404'
          : 'http-or-network'
      : error instanceof z.ZodError
        ? 'invalid-response'
        : 'invalid-url-or-request';

  console.warn('[NWS] conditions unavailable', {
    provider: 'NWS',
    spotLat: Number(spotLat.toFixed(4)),
    spotLng: Number(spotLng.toFixed(4)),
    status,
    kind,
  });
}

export async function fetchNWSConditions(lat: number, lng: number) {
  const pointUrl = getNwsPointUrl(lat, lng);

  if (!pointUrl) {
    console.warn('[NWS] conditions unavailable', {
      provider: 'NWS',
      spotLat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
      spotLng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
      status: null,
      kind: 'invalid-url-or-coordinates',
    });

    return null;
  }

  try {
    const pointRes = await axios.get(pointUrl, {
      headers: {
        Accept: 'application/geo+json, application/json',
        'User-Agent': 'FishFinderPro/1.0 (contact@fishfinderpro.app)',
      },
      timeout: NWS_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const point = NWSPointSchema.parse(pointRes.data);
    const forecastUrl = point.properties.forecast;

    if (!isAllowedNwsUrl(forecastUrl)) {
      console.warn('[NWS] conditions unavailable', {
        provider: 'NWS',
        spotLat: Number(lat.toFixed(4)),
        spotLng: Number(lng.toFixed(4)),
        status: null,
        kind: 'invalid-forecast-url',
      });

      return null;
    }

    const forecastRes = await axios.get(forecastUrl, {
      headers: {
        Accept: 'application/geo+json, application/json',
        'User-Agent': 'FishFinderPro/1.0 (contact@fishfinderpro.app)',
      },
      timeout: NWS_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const forecast = NWSForecastSchema.parse(forecastRes.data);
    const current = forecast.properties.periods[0];

    const tempC =
      current.temperatureUnit === 'F'
        ? ((current.temperature - 32) * 5) / 9
        : current.temperature;

    const windMatch = current.windSpeed.match(/(d+(?:.d+)?)/);
    const windMs =
      windMatch
        ? (safeNum(windMatch[1]) ?? 0) * 0.44704
        : null;

    return {
      source: 'NOAA NWS',
      air_temp_c: Math.round(tempC * 10) / 10,
      wind_speed_ms: windMs !== null ? Math.round(windMs * 10) / 10 : null,
      wind_direction: current.windDirection,
      short_forecast: current.shortForecast,
      is_daytime: current.isDaytime,
      period_name: current.name,
    };
  } catch (error) {
    logNwsFailure(lat, lng, error);
    return null;
  }
}

export async function fetchUSGSWaterData(siteId: string) {
  try {
    const res = await axios.get(`${USGS_BASE}/iv/`, {
      params: {
        sites: siteId,
        parameterCd: '00060,00065,00010,00300',
        siteStatus: 'active',
        format: 'json',
      },
      timeout: 10000,
    });

    const data = USGSSchema.parse(res.data);
    const result: Record<string, number | null | string> = {
      source: 'USGS Water Data',
      site_id: siteId,
    };

    for (const series of data.value.timeSeries) {
      const code = series.variable.variableCode[0]?.value;
      const val = safeNum(series.values[0]?.value[0]?.value);

      if (code === '00060') result.flow_rate_cfs = val;
      if (code === '00065') result.water_level_ft = val;
      if (code === '00010') result.water_temp_c = val;
      if (code === '00300') result.dissolved_oxygen_mgl = val;
    }

    return result;
  } catch (err) {
    console.error('[USGS]', err instanceof AxiosError ? err.message : err);
    return null;
  }
}

export async function fetchMarineConditions(lat: number, lng: number) {
  try {
    const res = await axios.get(MARINE_BASE, {
      params: {
        latitude: lat,
        longitude: lng,
        hourly: 'wave_height,wave_period,wave_direction,sea_surface_temperature,swell_wave_height',
        forecast_days: 1,
        timezone: 'auto',
      },
      timeout: 8000,
    });

    const data = MarineSchema.parse(res.data);
    const h = data.hourly;
    const idx = new Date().getHours();

    return {
      source: 'Open-Meteo Marine',
      wave_height_m: h.wave_height?.[idx] ?? null,
      wave_period_s: h.wave_period?.[idx] ?? null,
      wave_direction_deg: h.wave_direction?.[idx] ?? null,
      sea_surface_temp_c: h.sea_surface_temperature?.[idx] ?? null,
      swell_height_m: h.swell_wave_height?.[idx] ?? null,
    };
  } catch (err) {
    console.error('[Marine]', err instanceof AxiosError ? err.message : err);
    return null;
  }
}

export async function fetchTideData(stationId: string) {
  try {
    const dateStr = new Date()
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '');

    const res = await axios.get(TIDES_BASE, {
      params: {
        begin_date: dateStr,
        end_date: dateStr,
        station: stationId,
        product: 'water_level',
        datum: 'MLLW',
        time_zone: 'lst_ldt',
        units: 'metric',
        application: 'FishFinderPro',
        format: 'json',
      },
      timeout: 8000,
    });

    if (!res.data?.data) return null;

    const readings: Array<{ t: string; v: string }> = res.data.data;
    const nowMs = Date.now();

    const closest = readings.reduce((prev, curr) =>
      Math.abs(new Date(curr.t).getTime() - nowMs) <
      Math.abs(new Date(prev.t).getTime() - nowMs)
        ? curr
        : prev,
    );

    return {
      source: 'NOAA Tides',
      station_id: stationId,
      tide_height_m: safeNum(closest.v),
      observation_time: closest.t,
    };
  } catch (err) {
    console.error('[Tides]', err instanceof AxiosError ? err.message : err);
    return null;
  }
}
