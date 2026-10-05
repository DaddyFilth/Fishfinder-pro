import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getSupabaseAdmin } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin,
}))

import { GET } from './route'

describe('spots route provenance', () => {
  beforeEach(() => {
    getSupabaseAdmin.mockReturnValue(null)
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('uses the configured Seamcast endpoint and returns its spots', async () => {
    vi.stubEnv('SPOTS_API', 'https://configured-seamcast.example/api/spots')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      spots: [{
        id: 'configured-spot',
        name: 'Configured Lake',
        lat: 35.2,
        lng: -96.8,
      }],
    }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(new NextRequest('https://example.com/api/spots?lat=35.2&lon=-96.8'))
    const payload = await response.json()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://configured-seamcast.example/api/spots?lat=35.2&lon=-96.8',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(payload).toMatchObject({
      data_mode: 'provider',
      spots: [{ id: 'configured-spot', name: 'Configured Lake', source: 'seamcast-spots' }],
    })
  })

  it('does not label provider spot metadata as a live observation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      source: 'upstream-spots',
      live: true,
      observed_at: '2026-10-05T04:00:00.000Z',
      spots: [{
        id: 'provider-1',
        name: 'Provider Lake',
        lat: 35.1,
        lng: -97.1,
        water_type: 'freshwater',
        spot_type: 'lake',
        live: true,
      }],
    }), { status: 200 })))

    const response = await GET(new NextRequest('https://example.com/api/spots?lat=35.1&lon=-97.1'))
    const payload = await response.json()

    expect(payload.live).toBe(false)
    expect(payload.spots[0]).toMatchObject({
      source: 'upstream-spots',
      live: false,
      data_mode: 'provider',
    })
    expect(payload.spots[0].observed_at).toBeUndefined()
  })

  it('does not attach a fabricated observation time to stored spot metadata', async () => {
    const query = {
      from: vi.fn(),
      select: vi.fn(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: 'stored-1',
          name: 'Stored Lake',
          lat: 35.1,
          lng: -97.1,
          water_type: 'freshwater',
          spot_type: 'lake',
        }],
        error: null,
      }),
    }
    query.from.mockReturnValue(query)
    query.select.mockReturnValue(query)
    getSupabaseAdmin.mockReturnValue(query)

    const response = await GET(new NextRequest('https://example.com/api/spots'))
    const payload = await response.json()

    expect(payload.live).toBe(false)
    expect(payload.observed_at).toBeUndefined()
    expect(payload.spots[0]).toMatchObject({
      source: 'supabase-spots',
      live: false,
      data_mode: 'provider',
    })
  })
})
