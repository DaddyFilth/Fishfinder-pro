import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { enforceRateLimit } from '@/lib/security'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
})

function isNwsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'api.weather.gov'
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, { name: 'weather', limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Valid coordinates are required.' }, { status: 400 })

  const headers = {
    Accept: 'application/geo+json, application/json',
    'User-Agent': 'FishFinderPro/1.0 (contact@fishfinderpro.app)',
  }

  try {
    const pointResponse = await fetch(`https://api.weather.gov/points/${parsed.data.lat.toFixed(4)},${parsed.data.lng.toFixed(4)}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    if (!pointResponse.ok) throw new Error(`NWS point lookup failed: ${pointResponse.status}`)
    const point = await pointResponse.json() as { properties?: { forecastHourly?: unknown; relativeLocation?: unknown } }
    if (!isNwsUrl(point.properties?.forecastHourly)) throw new Error('NWS returned an invalid hourly forecast URL')

    const forecastResponse = await fetch(point.properties.forecastHourly, { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000) })
    if (!forecastResponse.ok) throw new Error(`NWS forecast failed: ${forecastResponse.status}`)
    const forecast = await forecastResponse.json() as { properties?: { periods?: unknown[]; updateTime?: string; generatedAt?: string } }
    const periods = Array.isArray(forecast.properties?.periods) ? forecast.properties.periods : []
    if (!periods.length) throw new Error('NWS returned no forecast periods')

    return NextResponse.json({ periods, updatedAt: forecast.properties?.updateTime ?? forecast.properties?.generatedAt ?? null, source: 'NOAA/NWS', data_mode: 'provider', live: true }, { headers: { 'Cache-Control': 'no-store', 'x-fishfinder-data-mode': 'provider' } })
  } catch (error) {
    console.error('[weather] provider request failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'NOAA/NWS weather is unavailable.', source: 'none', data_mode: 'unavailable', live: false }, { status: 503 })
  }
}
