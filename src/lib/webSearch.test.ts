import { afterEach, describe, expect, it, vi } from 'vitest';

import { searchDuckDuckGo, searchFishingInfo } from './webSearch';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockFetchOnce(payload: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
}

describe('searchDuckDuckGo', () => {
  it('maps instant answers from the Answer/AnswerType fields', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({
      Answer: '42',
      AnswerType: 'calc',
      AbstractText: 'some abstract',
      RelatedTopics: [],
    }));

    const result = await searchDuckDuckGo('what is the answer');

    expect(result?.answer).toBe('42');
    expect(result?.answer_type).toBe('calc');
  });

  it('maps related topic links from the FirstURL field', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({
      RelatedTopics: [
        { Text: 'Largemouth bass', FirstURL: 'https://example.com/bass' },
      ],
    }));

    const result = await searchDuckDuckGo('bass');

    expect(result?.related_topics[0]).toEqual({
      text: 'Largemouth bass',
      url: 'https://example.com/bass',
    });
  });

  it('returns null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(searchDuckDuckGo('bass')).resolves.toBeNull();
  });
});

describe('searchFishingInfo', () => {
  it('surfaces the direct answer in the search-derived summary', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({
      Answer: 'Use topwater at dawn.',
      Abstract: 'Bass feed in warm water.',
    }));

    const out = await searchFishingInfo('bass');

    expect(out?.source).toBe('web');
    expect(out?.result?.answer).toBe('Use topwater at dawn.');
  });
});
