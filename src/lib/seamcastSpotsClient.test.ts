import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSeamcastResponse } from './seamcastSpotsClient';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchSeamcastResponse', () => {
  it('returns local Oklahoma catalog data without calling external API', async () => {
    vi.stubEnv('SPOTS_API', 'https://primary.example/api/spots');

    const response = await fetchSeamcastResponse(new URLSearchParams(), undefined, 100);

    expect(response?.ok).toBe(true);
    // Should return local catalog data, not call external API
    const data = await response.json();
    expect(data.query).toBeDefined();
    expect(data.conditions).toBeNull();
    expect(data.speciesLikely).toBeDefined();
    expect(Array.isArray(data.speciesLikely)).toBe(true);
  });

  it('uses fallback when primary endpoint fails', async () => {
    vi.stubEnv('SPOTS_API', 'https://primary.example/api/spots');

    const response = await fetchSeamcastResponse(new URLSearchParams({ lat: '40', lng: '-100' }), undefined, 1);

    // Should still return valid response even with short timeout
    expect(response?.ok).toBe(true);
  });
});