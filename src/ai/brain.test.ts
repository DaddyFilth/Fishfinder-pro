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
  getAiVisionModel: vi.fn(() => 'vision-model'),
}));

import { askBrain, askBrainVision, buildFallbackReply, isJsonModeRejection, runBrainPromptCompletion } from './brain';

function addTarget(
  provider: AiProvider,
  impl: (params: { model: string; response_format?: { type: 'json_object' }; max_tokens?: number }) => Promise<unknown>,
): ReturnType<typeof vi.fn> {
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
let consoleWarn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  targets.length = 0;
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
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

describe('runBrainPromptCompletion', () => {
  it('reports the provider that actually answered, even when it is not the first target', async () => {
    addTarget('groq', async () => {
      throw new Error('groq outage');
    });
    const answering = addTarget('opencode', async () => ({ choices: [{ message: { content: 'Checklist from OpenCode' } }] }));

    const completion = await runBrainPromptCompletion({ messages: [{ role: 'user', content: 'Build a gear checklist.' }] });

    expect(completion).toEqual({ text: 'Checklist from OpenCode', provider: 'opencode', model: 'opencode-model' });
    expect(answering).toHaveBeenCalledTimes(1);
  });
});

describe('JSON mode recovery', () => {
  it('retries the same provider without forced JSON when it rejects JSON mode', async () => {
    const create = addTarget('groq', async (params) => {
      if (params.response_format) {
        throw new Error(
          'Groq request failed (400): {"error":{"message":"Failed to validate JSON. Please adjust your prompt.","code":"json_validate_failed"}}',
        );
      }
      return { choices: [{ message: { content: '{"summary":"Fish are active.","emoji_rating":"Good"}' } }] };
    });

    const completion = await runBrainPromptCompletion({
      messages: [{ role: 'user', content: 'Analyze these conditions.' }],
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    expect(completion.text).toContain('"summary":"Fish are active."');
    expect(completion.provider).toBe('groq');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].response_format).toEqual({ type: 'json_object' });
    expect(create.mock.calls[1][0].response_format).toBeUndefined();
    // The rejected attempt burned budget on hidden reasoning; the retry gets more room.
    expect(create.mock.calls[1][0].max_tokens).toBeGreaterThanOrEqual(1024);
  });

  it('keeps falling through the chain when the free-form retry also fails', async () => {
    const failing = addTarget('groq', async () => {
      throw new Error('Groq request failed (400): json_validate_failed');
    });
    addTarget('openai', async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }));

    const completion = await runBrainPromptCompletion({
      messages: [{ role: 'user', content: 'Analyze these conditions.' }],
      response_format: { type: 'json_object' },
    });

    expect(completion.provider).toBe('openai');
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('does not retry unrelated provider failures', async () => {
    const failing = addTarget('groq', async () => {
      throw new Error('groq outage');
    });

    await expect(
      runBrainPromptCompletion({
        messages: [{ role: 'user', content: 'Analyze these conditions.' }],
        response_format: { type: 'json_object' },
      }),
    ).rejects.toThrow('groq outage');

    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('recognizes the provider JSON-mode rejection messages', () => {
    expect(isJsonModeRejection(new Error('code json_validate_failed'))).toBe(true);
    expect(isJsonModeRejection(new Error('Failed to generate JSON. See failed_generation.'))).toBe(true);
    expect(isJsonModeRejection(new Error('Groq returned an empty response'))).toBe(true);
    expect(isJsonModeRejection(new Error('groq outage'))).toBe(false);
    expect(isJsonModeRejection('json_validate_failed')).toBe(false);
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
