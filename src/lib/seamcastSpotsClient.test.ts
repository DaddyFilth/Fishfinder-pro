import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchSeamcastResponse } from './seamcastSpotsClient';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchSeamcastResponse', () => {
  it('uses a fresh timeout for each endpoint attempt', async () => {
    vi.stubEnv('SPOTS_API', 'https://primary.example/api/spots');

    const timeoutControllers = [new AbortController(), new AbortController()];
    let timeoutIndex = 0;
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => timeoutControllers[timeoutIndex++].signal);
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => {
        timeoutControllers[0].abort();
        return Promise.reject(new Error('The primary endpoint timed out'));
      })
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchSeamcastResponse(new URLSearchParams(), undefined, 100);

    expect(response?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(timeoutSpy).toHaveBeenCalledTimes(2);
    expect(timeoutSpy).toHaveBeenCalledWith(100);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(false);
  });
});
