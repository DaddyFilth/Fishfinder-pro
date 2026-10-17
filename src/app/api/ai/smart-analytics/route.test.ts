import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock('@/lib/security', () => ({
  enforceRateLimit: vi.fn(() => null),
  isSameOrigin: vi.fn(() => true),
  readJsonBody: vi.fn(async (request: Request) => ({
    ok: true,
    value: await request.json(),
  })),
}));

vi.mock('@/lib/groq', () => ({
  getAiModel: vi.fn(() => 'test-model'),
  getAiProviderName: vi.fn(() => 'groq'),
  getGroqClient: vi.fn(() => ({
    chat: { completions: { create: createCompletion } },
  })),
}));

vi.mock('@/lib/fetchers/environmental', () => ({
  fetchNWSConditions: vi.fn(async () => null),
  fetchPressureTrend: vi.fn(async () => null),
  fetchMarineConditions: vi.fn(async () => null),
}));

vi.mock('@/lib/webSearch', () => ({
  searchFishingInfo: vi.fn(async () => null),
  formatSearchSummary: vi.fn(() => ''),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(() => null),
}));

vi.mock('@/lib/auth/server', () => ({
  getAuthContext: vi.fn(async () => null),
}));

import { maxDuration, POST } from './route';
import { DEFAULT_SPOTS } from '@/lib/defaultSpots';

function request(body: unknown) {
  return new NextRequest('https://example.com/api/ai/smart-analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    body: JSON.stringify(body),
  });
}

function modelJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    verdict: 'Bootstrap analysis: hold for a better window.',
    confidence: 42,
    reasoning: 'Provider readings were unavailable, so the catalog baseline and research carried this run.',
    data_gaps: ['No provider readings answered for these coordinates.'],
    recommendations: [
      {
        spot_id: DEFAULT_SPOTS[0].id,
        spot_name: DEFAULT_SPOTS[0].name,
        score: 61,
        rating: 'Good',
        primary_species: ['Largemouth Bass'],
        best_time_today: 'Early morning (estimate)',
        best_technique: 'Slow-roll a spinnerbait along the windblown bank.',
        recommended_lure: 'White spinnerbait',
        reason: 'Catalog baseline ranks this water highest near the requested coordinates.',
      },
      {
        spot_id: 'invented-spot-id',
        spot_name: 'Hallucinated Lake',
        score: 99,
        rating: 'Hot',
        primary_species: ['Walleye'],
        best_time_today: 'Dusk',
        best_technique: 'Drag a jig.',
        recommended_lure: 'Jig',
        reason: 'Not in the stored catalog.',
      },
    ],
    ...overrides,
  });
}

beforeEach(() => {
  createCompletion.mockReset();
});

describe('POST /api/ai/smart-analytics', () => {
  it('allows enough time for provider retries and source gathering', () => {
    expect(maxDuration).toBe(120);
  });

  it('returns AI analysis, drops recommendations outside the stored catalog, and reports bootstrap phase', async () => {
    createCompletion.mockResolvedValue({ choices: [{ message: { content: modelJson() } }] });

    const res = await POST(request({ lat: 35.4676, lng: -97.5164 }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.source).toBe('ai');
    expect(body.data_mode).toBe('ai-generated');
    expect(body.data_phase).toBe('bootstrap');
    expect(body.data_sufficiency.sufficient).toBe(false);
    expect(body.analysis.confidence).toBe(42);

    const ids = body.recommendations.map((row: { spot_id: string }) => row.spot_id);
    expect(ids).toContain(DEFAULT_SPOTS[0].id);
    expect(ids).not.toContain('invented-spot-id');
    expect(body.dropped_recommendations).toBe(1);

    const sourceIds = body.sources.map((row: { id: string }) => row.id);
    expect(sourceIds).toEqual(
      expect.arrayContaining([
        'provider-conditions',
        'spot-catalog',
        'species-catalog',
        'catch-log',
        'web-search',
      ]),
    );
    expect(body.sources.every((row: { status: string; note: string }) => row.status !== 'ok' || typeof row.note === 'string')).toBe(true);
    expect(body.live_data).toBe(false);

    const prompt = createCompletion.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('BOOTSTRAP mode');
    expect(prompt).toContain(DEFAULT_SPOTS[0].id);
  });

  it('answers 503 without publishing anything when the provider returns unusable output', async () => {
    createCompletion.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] });

    const res = await POST(request({ lat: 35.4676, lng: -97.5164 }));
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toMatch(/no analysis was generated/i);
    expect(body.data_mode).toBe('unavailable');
    expect(body.analysis).toBeUndefined();
  });

  it('answers 400 when coordinates are missing', async () => {
    const res = await POST(request({ lat: 'nope' }));
    expect(res.status).toBe(400);
  });
});
