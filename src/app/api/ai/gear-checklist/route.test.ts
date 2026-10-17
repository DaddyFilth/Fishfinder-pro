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
  getAiProviderName: vi.fn(() => 'opencode'),
  getAiProviderTargets: vi.fn(() => [{
    provider: 'opencode',
    model: 'test-vision-model',
    visionModel: 'test-vision-model',
    client: { chat: { completions: { create: createCompletion } } },
  }]),
}));

vi.mock('@/lib/seamcastSpotsClient', () => ({
  fetchSeamcastResponse: vi.fn(async () => null),
}));

vi.mock('@/lib/verifiedConditions', () => ({
  hasVerifiedCurrentConditions: vi.fn(() => false),
}));

import { POST } from './route';

function request(body: unknown) {
  return new NextRequest('https://example.com/api/ai/gear-checklist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  createCompletion.mockReset();
});

describe('POST /api/ai/gear-checklist', () => {
  it('reports the provider that answered instead of assuming Groq', async () => {
    createCompletion.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { item: 'Spinnerbait', spec: '3/8 oz, white/chartreuse', priority: 'Essential', reason: 'General species guidance.' },
          ]),
        },
      }],
    });

    const response = await POST(request({ speciesId: 'largemouth-bass', lat: 35.22, lon: -97.44 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toBe('opencode');
    expect(body.source).toBe('ai');
    expect(body.checklist).toHaveLength(1);
    expect(body.checklist[0].item).toBe('Spinnerbait');
  });
});
