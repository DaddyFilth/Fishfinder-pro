import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider } from '@/lib/groq';

const { targets } = vi.hoisted(() => ({
  targets: [] as Array<{
    provider: string;
    model: string;
    visionModel: string;
    client: { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
  }>,
}));

vi.mock('@/lib/groq', () => ({
  getAiModel: vi.fn(() => 'primary-model'),
  getAiProviderName: vi.fn(() => 'groq'),
  getAiProviderTargets: vi.fn(() => targets),
}));

import { askBrain, askBrainVision, buildFallbackReply } from './brain';

function addTarget(provider: AiProvider, impl: (params: { model: string }) => Promise<unknown>): ReturnType<typeof vi.fn> {
  const create = vi.fn(impl);
  targets.push({
    provider,
    model: `${provider}-model`,
    visionModel: `${provider}-vision-model`,
    client: { chat: { completions: { create } } },
  });
  return create;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  targets.length = 0;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('askBrain provider fallback', () => {
  it('returns the first provider result without degrading', async () => {
    const create = addTarget('groq', async () => ({ choices: [{ message: { content: '  Hello angler  ' } }] }));

    const result = await askBrain('What should I throw?', { species: ['Largemouth Bass'] });

    expect(result).toMatchObject({
      text: 'Hello angler',
      provider: 'groq',
      model: 'groq-model',
      degraded: false,
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].model).toBe('groq-model');
  });

  it('falls through to the next provider when an earlier one fails', async () => {
    const failing = addTarget('groq', async () => {
      throw new Error('groq outage');
    });
    addTarget('openai', async () => ({ choices: [{ message: { content: 'From OpenAI' } }] }));

    const result = await askBrain('Is today a good day?');

    expect(result).toMatchObject({
      text: 'From OpenAI',
      provider: 'openai',
      model: 'openai-model',
      degraded: false,
    });
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('answers completely from supplied data when every provider fails', async () => {
    addTarget('groq', async () => {
      throw new Error('groq outage');
    });
    addTarget('openai', async () => ({ choices: [{ message: { content: '   ' } }] }));

    const result = await askBrain('Any bite windows?', {
      spot: { name: 'Lake Thunderbird' },
      conditions: { water_temp_c: 18 },
    });

    expect(result.degraded).toBe(true);
    expect(result.provider).toBe('groq');
    expect(result.text).toContain('Lake Thunderbird');
    expect(result.text).toContain('Water temperature 64°F (converted from 18°C)');
    expect(result.text).toContain('no AI model was used');
    expect(result.text).not.toMatch(/temporarily unavailable/i);
  });

  it('answers from the stored catalog instead of refusing when no provider is configured', async () => {
    const result = await askBrain('How do I catch Largemouth Bass?');

    expect(result.degraded).toBe(true);
    expect(result.text).toContain('Largemouth Bass');
    expect(result.text).toContain('stored catalog entry');
    expect(result.text).toContain('No current conditions were supplied');
    expect(result.text).not.toMatch(/temporarily unavailable/i);
  });

  it('still rejects an empty question before reaching a provider', async () => {
    addTarget('groq', async () => ({ choices: [{ message: { content: 'nope' } }] }));

    await expect(askBrain('   ')).rejects.toThrow('A question is required.');
  });

  it('names the spot in the local answer when the context includes one', () => {
    expect(buildFallbackReply({ spot: { id: 's1', name: 'Lake Thunderbird' } }))
      .toContain('Lake Thunderbird');
  });
});

describe('askBrainVision provider fallback', () => {
  it('uses the provider vision model for the first target', async () => {
    const create = addTarget('groq', async () => ({ choices: [{ message: { content: '{"is_fish":true}' } }] }));

    const result = await askBrainVision('Identify this fish', 'data:image/jpeg;base64,AAAA');

    expect(result).toMatchObject({ provider: 'groq', model: 'groq-vision-model', degraded: false });
    expect(create.mock.calls[0][0].model).toBe('groq-vision-model');
  });

  it('returns a degraded message when every vision provider fails', async () => {
    addTarget('groq', async () => {
      throw new Error('vision outage');
    });

    const result = await askBrainVision('Identify this fish', 'data:image/jpeg;base64,AAAA');

    expect(result.degraded).toBe(true);
    expect(result.text).toContain('image identification model is temporarily unavailable');
  });
});
