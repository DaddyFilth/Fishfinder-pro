import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  getAiProviderName: vi.fn(() => 'opencode'),
  getAiProviderTargets: vi.fn(() => [{
    provider: 'opencode',
    model: 'test-vision-model',
    visionModel: 'test-vision-model',
    client: { chat: { completions: { create: createCompletion } } },
  }]),
}));

vi.mock('@/lib/seamcastSpotsClient', () => ({
  fetchSeamcastSpotSuggestions: vi.fn(async () => null),
}));

import { POST } from './route';

const BODY = {
  spot: { name: 'Lake Thunderbird', water_type: 'reservoir', lat: 35.22, lng: -97.44 },
  conditions: {
    scope: 'area',
    radius_miles: 25,
    source: 'caller-supplied context',
    data_mode: 'reported',
    water_temp_c: 18.9,
    fishing_score: 61,
  },
};

function request(body: unknown) {
  return new NextRequest('https://example.com/api/ai/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    body: JSON.stringify(body),
  });
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createCompletion.mockReset();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('POST /api/ai/analyze', () => {
  it('reports the provider that answered instead of the configured primary', async () => {
    createCompletion.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'Lake Thunderbird area: reported water 18.9°C and a calculated score of 61/100.',
            emoji_rating: 'Fair conditions',
          }),
        },
      }],
    });

    const response = await POST(request(BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBe('opencode');
    expect(body.source).toBe('ai');
    expect(body.data_mode).toBe('ai-generated');
    expect(body.summary).toContain('Lake Thunderbird');
  });

  it('answers from supplied data when no provider is reachable', async () => {
    createCompletion.mockRejectedValue(new Error('opencode outage'));

    const response = await POST(request(BODY));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe('app-stored');
    expect(body.data_mode).toBe('catalog-derived');
    expect(body.summary).toContain('No AI model was reachable');
    expect(body.summary).toContain('Lake Thunderbird');
  });
});
