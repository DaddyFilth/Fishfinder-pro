import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SPOTS } from '@/lib/defaultSpots'
import { fetchAiBiteTimes, resetAiBiteTimesCache } from './aiBiteTimesClient'

const aiResponse = {
  overall_rating: 'Good',
  overall_score: 78,
  summary: 'A steady morning bite is likely.',
  windows: [
    { start: '06:30', end: '08:00', quality: 'Peak', score: 92, reason: 'Low light.', recommended_bait: 'Spinnerbait', depth: '4–8 ft' },
    { start: '11:00', end: '12:00', quality: 'Good', score: 64, reason: 'Stable conditions.', recommended_bait: 'Plastic worm', depth: '8–12 ft' },
    { start: '17:00', end: '19:00', quality: 'Fair', score: 71, reason: 'Evening transition.', recommended_bait: 'Jig', depth: '6–10 ft' },
  ],
  avoid_times: 'Avoid the hottest midday period.',
  pro_tip: 'Work the wind-blown edge first.',
}

describe('AI bite-time integration across the public spot catalog', () => {
  afterEach(() => {
    resetAiBiteTimesCache()
    vi.unstubAllGlobals()
  })

  it('sends valid coordinates for all 76 spots and receives bait/depth windows', async () => {
    const requests: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify(aiResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    const results = await Promise.all(DEFAULT_SPOTS.map((spot) => fetchAiBiteTimes({
      species: 'Largemouth Bass',
      lat: spot.lat,
      lng: spot.lng,
      water_temp_c: 20,
      pressure_hpa: 1012,
      wind_speed_ms: 3,
      dissolved_oxygen_mgl: 7,
      solunar_score: 74,
      moon_phase: 'Full Moon',
    })))

    expect(results).toHaveLength(76)
    expect(results.every((result) => result?.windows.length === 3)).toBe(true)
    expect(results.every((result) => result?.windows.every((window) => window.recommended_bait && window.depth))).toBe(true)
    expect(requests).toHaveLength(76)
    expect(requests.every((request) => typeof request.lat === 'number' && typeof request.lng === 'number')).toBe(true)
    expect(requests.every((request) => (request.lat as number) >= 33.615 && (request.lat as number) <= 37.002)).toBe(true)
    expect(requests.every((request) => (request.lng as number) >= -103.003 && (request.lng as number) <= -94.430)).toBe(true)
  })

  it('returns null for an unavailable provider so local guidance can remain visible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 })))
    await expect(fetchAiBiteTimes({ species: 'Largemouth Bass', lat: 35.588, lng: -97.588 })).resolves.toBeNull()
  })
})
