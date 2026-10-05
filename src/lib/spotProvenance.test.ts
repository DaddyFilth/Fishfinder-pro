import { describe, expect, it } from 'vitest'

import { normalizeProviderSpots, parseSpotApiPayload } from './spotProvenance'

const UPSTREAM_FEED = {
  query: { lat: 34.999, lon: -97.366 },
  conditions: { source: 'api.weather.gov', temperatureF: 64 },
  overallBite: { score: 70, level: 'good' },
  speciesLikely: [],
  recommendedBaits: [],
  microSpots: [
    {
      id: 'north-wind-bank',
      label: 'Wind-blown bank',
      lat: 35,
      lon: -97.366,
      biteScore: { score: 70, level: 'good', reasons: [] },
      bestSpecies: [],
    },
  ],
}

describe('normalizeProviderSpots', () => {
  const fallback = [
    { id: 'fallback-1', name: 'Fallback Lake', lat: 35.0, lng: -97.0, water_type: 'freshwater', spot_type: 'lake' },
  ]

  it('uses upstream microSpots when no named spots are present', () => {
    const result = normalizeProviderSpots(UPSTREAM_FEED, fallback)

    expect(result.data_mode).toBe('provider')
    expect(result.spots).toHaveLength(1)
    expect(result.spots[0]).toMatchObject({
      id: 'north-wind-bank',
      name: 'Wind-blown bank',
      lat: 35,
      lng: -97.366,
      source: 'seamcast-spots',
      live: false,
      data_mode: 'provider',
    })
  })

  it('prefers an explicit spots array when present', () => {
    const feed = { ...UPSTREAM_FEED, spots: [{ id: 'custom-1', name: 'Named Spot', lat: 35.1, lng: -96.9, water_type: 'lake', spot_type: 'lake' }] }
    const result = normalizeProviderSpots(feed, fallback)
    expect(result.spots[0].name).toBe('Named Spot')
    expect(result.data_mode).toBe('provider')
  })

  it('does not infer a provider source when an API payload omits provenance', () => {
    const result = parseSpotApiPayload({
      spots: [{ id: 'unknown-1', name: 'Unknown Spot', lat: 35.1, lng: -96.9, water_type: 'lake', spot_type: 'lake' }],
    })

    expect(result?.data_mode).toBe('unavailable')
    expect(result?.live).toBe(false)
    expect(result?.spots[0]?.data_mode).toBe('unavailable')
  })

  it('falls back to the bundled catalog when nothing upstream usable', () => {
    const result = normalizeProviderSpots({ spots: [] }, fallback)
    expect(result.data_mode).toBe('fallback')
    expect(result.spots[0].name).toBe('Fallback Lake')
    expect(result.source).toBe('bundled-public-water-catalog')
  })

  it('falls back when the payload is garbage', () => {
    const result = normalizeProviderSpots(null, fallback)
    expect(result.data_mode).toBe('fallback')
    expect(result.spots[0]).toMatchObject(fallback[0])
  })
})
