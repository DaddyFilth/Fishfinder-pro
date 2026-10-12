const DUCKDUCKGO_API = 'https://api.duckduckgo.com/';

export interface WebSearchResult {
  abstract: string | null;
  abstract_truncated: boolean;
  answer: string | null;
  answer_type: string | null;
  related_topics: Array<{ text: string; url: string } | null>;
  defined_by: string | null;
  image_url: string | null;
  redirect: string | null;
  icon: { url: string };
  shared_total_results: string | null;
  meta: {
    api_status: number;
    api_results: number;
    execution_time: number;
    score: number;
    generated_at: string;
  };
}

export interface WebSearchQuery {
  query: string;
  format?: 'json';
  no_redirect?: boolean;
  timeout?: number;
}

/**
 * Performs a free web search using DuckDuckGo Instant Answers API.
 * No API key required - completely free to use.
 * Results are labeled as "search-derived" per Fishbot rules.
 */
export async function searchDuckDuckGo(query: string, timeoutMs = 8_000): Promise<WebSearchResult | null> {
  try {
    const url = new URL(DUCKDUCKGO_API);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_redirect', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Fishfinder-Pro/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try without no_redirect as fallback
      const fallbackUrl = new URL(DUCKDUCKGO_API);
      fallbackUrl.searchParams.set('q', query);
      fallbackUrl.searchParams.set('format', 'json');

      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), timeoutMs);

      const fallbackRes = await fetch(fallbackUrl.toString(), {
        signal: fallbackController.signal,
        headers: { 'Accept': 'application/json', 'User-Agent': 'Fishfinder-Pro/1.0' },
      });
      if (!fallbackRes.ok) return null;
      const data = await fallbackRes.json();
      return formatDuckDuckGoResult(data);
    }

    const data = await response.json();
    return formatDuckDuckGoResult(data);
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    return null;
  }
}

function formatDuckDuckGoResult(data: any): WebSearchResult | null {
  if (!data) return null;

  const result: WebSearchResult = {
    abstract: data.Abstract || null,
    abstract_truncated: !!data.AbstractTruncated,
    answer: data.AbstractText || null,
    answer_type: data.AbstractType || null,
    related_topics: (data.RelatedTopics || []).map((topic: any) => ({
      text: typeof topic === 'object' && topic !== null ? (topic as any).Text : String(topic),
      url: typeof topic === 'object' && topic !== null ? (topic as any).Url : null,
    })).filter((t: any) => t.text),
    defined_by: data.DefinedBy || null,
    image_url: data.ImageURL || null,
    redirect: data.Redirect || null,
    icon: data.Icon || { url: '' },
    shared_total_results: data.ResponseHeader?.Status || null,
    meta: data.AbstractMeaning?.meta || {
      api_status: 0,
      api_results: 0,
      execution_time: 0,
      score: 0,
      generated_at: new Date().toISOString(),
    },
  };

  return result;
}

/**
 * Searches for fishing-related information using DuckDuckGo.
 * Returns formatted information labeled as search-derived.
 */
export async function searchFishingInfo(query: string, timeoutMs = 8_000): Promise<{ result: WebSearchResult | null; source: 'web' } | null> {
  const searchResult = await searchDuckDuckGo(query, timeoutMs);
  if (!searchResult) return null;

  // Format a human-readable summary from the DuckDuckGo result
  let formatted = '';

  if (searchResult.answer) {
    formatted += `Answer: ${searchResult.answer}\n\n`;
  }
  if (searchResult.abstract) {
    formatted += `Summary: ${searchResult.abstract}${searchResult.abstract_truncated ? ' (truncated)' : ''}\n\n`;
  }
  if (searchResult.related_topics?.length) {
    formatted += 'Related topics:\n';
    searchResult.related_topics.slice(0, 3).forEach((topic: any) => {
      if (topic.text) {
        formatted += `- ${topic.text}`;
        if (topic.url) formatted += ` (${topic.url})`;
        formatted += '\n';
      }
    });
  }

  if (!formatted) {
    formatted = `DuckDuckGo search for: "${query}" - returned basic results. No specific answer found.`;
  }

  return {
    result: searchResult,
    source: 'web',
  };
}