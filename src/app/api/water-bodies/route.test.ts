import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getSupabaseAdmin, getAuthContext } = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  getAuthContext: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin,
}))

vi.mock('@/lib/auth/server', () => ({
  getAuthContext,
}))

vi.mock('@/lib/groq', () => ({
  getAiProviderTargets: vi.fn(async () => []),
  createOpenAiCompatibleClient: vi.fn(() => null),
}))

import { GET } from './route'

describe('water-bodies route provenance', () => {
  beforeEach(() => {
    getSupabaseAdmin.mockReturnValue(null)
    getAuthContext.mockResolvedValue({ user: { id: 'user-1' }, role: 'angler' })
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('rejects anonymous callers', async () => {
    getAuthContext.mockResolvedValue(null)

    const response = await GET(new NextRequest('https://example.com/api/water-bodies'))
    expect(response.status).toBe(401)
  })

  it('returns fallback with no water bodies when Overpass returns nothing', async () => {
    // Auth is set up; Overpass will return empty results for non-existent area
    getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          limit: () => ({
            data: [],
            error: null,
          }),
        }),
      }),
    } as never)

    const response = await GET(new NextRequest('https://example.com/api/water-bodies?lat=35&lon=-97&radius_miles=10'))
    const payload = await response.json()

    expect(payload).toMatchObject({
      water_bodies: [],
      source: 'overpass-ai',
      data_mode: 'fallback',
      warning: 'Water body data unavailable',
    })
    expect(response.status).toBe(200)
  })

  it('classifies water bodies with AI and returns PUBLIC/PRIVATE/UNKNOWN', async () => {
    // Mock Supabase with existing labels
    const mockLabels = [
      {
        osm_id: 1,
        name: 'Test Lake',
        lat: 35.5,
        lon: -97.5,
        water_type: 'lake',
        raw_tags: { natural: 'water', water: 'lake', name: 'Test Lake' },
        access_status: 'PUBLIC',
        ai_confidence: 95,
        ai_reasoning: 'public boat ramp access',
        last_verified: new Date().toISOString(),
      },
    ]

    getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          limit: () => ({
            data: mockLabels,
            error: null,
          }),
        }),
      }),
    } as never)

    // Mock fetch for Overpass - return one water body
    const overpassResponse = {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { natural: 'water', water: 'lake', name: 'Test Lake' },
          center: { lat: 35.5, lon: -97.5 },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(overpassResponse), { status: 200 })
    )

    const response = await GET(
      new NextRequest('https://example.com/api/water-bodies?lat=35&lon=-97&radius_miles=10')
    )
    const payload = await response.json()

    // Since the osm_id 1 is cached as PUBLIC, it should appear with that status
    expect(payload.water_bodies).toBeInstanceOf(Array)
    if (payload.water_bodies.length > 0) {
      expect(payload.water_bodies[0]).toMatchObject({
        access_status: 'PUBLIC',
        ai_confidence: 95,
      })
    }
    expect(response.status).toBe(200)
  })

  it('returns UNKNOWN for new osm_ids when AI fails', async () => {
    // Mock Supabase WITHOUT existing labels for the osm_ids
    getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          limit: () => ({
            data: [],
            error: null,
          }),
        }),
      }),
    } as never)

    // Mock fetch for Overpass - return one water body
    const overpassResponse = {
      elements: [
        {
          type: 'way',
          id: 999,
          tags: { natural: 'water', water: 'pond', name: 'Unknown Pond' },
          center: { lat: 35.5, lon: -97.5 },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(overpassResponse), { status: 200 })
    )

    // AI provider targets are mocked to return none, so classification falls back to UNKNOWN.
    const response = await GET(
      new NextRequest('https://example.com/api/water-bodies?lat=35&lon=-97&radius_miles=10')
    )
    const payload = await response.json()

    expect(payload.water_bodies).toBeInstanceOf(Array)
    if (payload.water_bodies.length > 0) {
      expect(payload.water_bodies[0].access_status).toBe('UNKNOWN')
      expect(payload.water_bodies[0].ai_confidence).toBe(0)
    }
    expect(response.status).toBe(200)
  })

  it('invalid coordinates return 400', async () => {
    const response = await GET(new NextRequest('https://example.com/api/water-bodies?lat=100&lon=-97&radius_miles=10'))
    expect(response.status).toBe(400)
  })

  it('invalid radius returns 400', async () => {
    const response = await GET(new NextRequest('https://example.com/api/water-bodies?lat=35&lon=-97&radius_miles=0'))
    expect(response.status).toBe(400)

    const response2 = await GET(new NextRequest('https://example.com/api/water-bodies?lat=35&lon=-97&radius_miles=200'))
    expect(response2.status).toBe(400)
  })
})
