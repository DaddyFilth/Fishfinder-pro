import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}))

vi.mock('@/lib/security', () => ({
  enforceRateLimit: vi.fn(() => null),
  isSameOrigin: vi.fn(() => true),
  readJsonBody: vi.fn(async (request: Request) => ({
    ok: true,
    value: await request.json(),
  })),
}))

vi.mock('@/lib/ollama', () => ({
  getAiModel: vi.fn(() => 'test-model'),
  getGroqClient: vi.fn(() => ({
    chat: { completions: { create: createCompletion } },
  })),
}))

import { POST } from './route'

const spots = [{
  id: 'spot-1',
  name: 'Catalog Lake',
  lat: 35.1,
  lng: -97.1,
  water_type: 'freshwater',
  spot_type: 'lake',
}]

function prediction(spotName = 'Catalog Lake', species = 'Largemouth Bass') {
  return [{
    spot_name: spotName,
    fishing_score: 50,
    rating: 'Fair',
    primary_species: [species],
    best_time_today: 'Early morning (estimate)',
    best_technique: 'Try a general bass technique.',
    recommended_lure: 'Soft plastic worm',
    reason: 'A general estimate based on limited catalog metadata.',
  }]
}

function request() {
  return new NextRequest('https://example.com/api/ai/suggest-spots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spots,
      species: 'Largemouth Bass',
      userLat: 35,
      userLng: -97,
    }),
  })
}

describe('AI spot suggestions', () => {
  beforeEach(() => {
    createCompletion.mockReset()
  })

  it('returns actual AI predictions only when they match supplied spots and target species', async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(prediction()) } }],
    })

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      source: 'ai',
      data_mode: 'ai-generated',
      live_data: false,
      total_nearby: 1,
      results: [{
        spot_id: 'spot-1',
        spot_name: 'Catalog Lake',
        primary_species: ['Largemouth Bass'],
      }],
    })
  })

  it('rejects AI output that cannot be matched to the supplied spot', async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(prediction('Imaginary Lake')) } }],
    })

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('No hardcoded ratings were used'),
      source: undefined,
    })
  })

  it('does not return predictions that omit the requested species', async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(prediction('Catalog Lake', 'Crappie')) } }],
    })

    const response = await POST(request())

    expect(response.status).toBe(503)
  })
})
