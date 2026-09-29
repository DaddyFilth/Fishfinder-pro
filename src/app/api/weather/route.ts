import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const USER_AGENT = 'Oklahoma SeamCast/1.0 (weather proxy; support@fishfinder-pro.online)';

function coordinate(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function allowedForecastUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.weather.gov';
  } catch {
    return false;
  }
}

async function nwsJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/geo+json, application/json',
      'User-Agent': USER_AGENT,
    },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`NWS request failed (${response.status})`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = coordinate(url.searchParams.get('lat'), -90, 90);
  const lng = coordinate(url.searchParams.get('lng'), -180, 180);
  if (lat === null || lng === null) {
    return NextResponse.json({ error: 'Valid latitude and longitude are required.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const point = await nwsJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, controller.signal);
    const properties = point.properties as { forecastHourly?: unknown } | undefined;
    if (!allowedForecastUrl(properties?.forecastHourly)) {
      throw new Error('NWS returned no hourly forecast URL.');
    }
    const forecast = await nwsJson(properties.forecastHourly, controller.signal);
    const forecastProperties = forecast.properties as { periods?: unknown[]; updateTime?: string; generatedAt?: string } | undefined;
    return NextResponse.json({ periods: forecastProperties?.periods ?? [], updatedAt: forecastProperties?.updateTime ?? forecastProperties?.generatedAt ?? null }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Weather provider timed out.' }, { status: 504 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Weather provider unavailable.' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
