const DUCKDUCKGO_API = 'https://api.duckduckgo.com/';

export interface WebSearchResult {
  abstract: string | null;
  abstract_truncated: boolean;
  answer: string | null;
  answer_type: string | null;
  related_topics: Array<{ text: string; url: string | null } | null>;
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

      let fallbackRes: Response;
      try {
        fallbackRes = await fetch(fallbackUrl.toString(), {
          signal: fallbackController.signal,
          headers: { 'Accept': 'application/json', 'User-Agent': 'Fishfinder-Pro/1.0' },
        });
      } finally {
        clearTimeout(fallbackTimeoutId);
      }
      if (!fallbackRes.ok) return null;
      const data: unknown = await fallbackRes.json();
      return formatDuckDuckGoResult(data);
    }

    const data: unknown = await response.json();
    return formatDuckDuckGoResult(data);
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatDuckDuckGoResult(value: unknown): WebSearchResult | null {
  if (!isRecord(value)) return null;

  const abstractMeaning = isRecord(value.AbstractMeaning) ? value.AbstractMeaning : null;
  const meta = abstractMeaning && isRecord(abstractMeaning.meta) ? abstractMeaning.meta : null;
  const responseHeader = isRecord(value.ResponseHeader) ? value.ResponseHeader : null;
  const icon = isRecord(value.Icon) ? value.Icon : null;
  const relatedTopics = Array.isArray(value.RelatedTopics)
    ? value.RelatedTopics.map((topic): WebSearchResult['related_topics'][number] => {
        if (!isRecord(topic)) {
          return typeof topic === 'string' ? { text: topic, url: null } : null;
        }

        return {
          text: typeof topic.Text === 'string' ? topic.Text : '',
          url: typeof topic.FirstURL === 'string' ? topic.FirstURL : null,
        };
      }).filter((topic) => topic?.text)
    : [];
  const numericMeta = (key: string): number =>
    typeof meta?.[key] === 'number' ? meta[key] : 0;

  const result: WebSearchResult = {
    abstract: typeof value.Abstract === 'string' ? value.Abstract : null,
    abstract_truncated: Boolean(value.AbstractTruncated),
    answer: typeof value.Answer === 'string'
      ? value.Answer
      : typeof value.AbstractText === 'string' ? value.AbstractText : null,
    answer_type: typeof value.AnswerType === 'string'
      ? value.AnswerType
      : typeof value.AbstractType === 'string' ? value.AbstractType : null,
    related_topics: relatedTopics,
    defined_by: typeof value.DefinedBy === 'string' ? value.DefinedBy : null,
    image_url: typeof value.ImageURL === 'string' ? value.ImageURL : null,
    redirect: typeof value.Redirect === 'string' ? value.Redirect : null,
    icon: { url: typeof icon?.url === 'string' ? icon.url : typeof icon?.URL === 'string' ? icon.URL : '' },
    shared_total_results: typeof responseHeader?.Status === 'string' ? responseHeader.Status : null,
    meta: {
      api_status: numericMeta('api_status'),
      api_results: numericMeta('api_results'),
      execution_time: numericMeta('execution_time'),
      score: numericMeta('score'),
      generated_at: typeof meta?.generated_at === 'string' ? meta.generated_at : new Date().toISOString(),
    },
  };

  return result;
}

/**
 * Formats a DuckDuckGo result into a short, human-readable summary.
 * Callers must label the output as search-derived; it is research, not an observation.
 */
export function formatSearchSummary(result: WebSearchResult): string {
  let formatted = '';

  if (result.answer) {
    formatted += `Answer: ${result.answer}\n\n`;
  }
  if (result.abstract) {
    formatted += `Summary: ${result.abstract}${result.abstract_truncated ? ' (truncated)' : ''}\n\n`;
  }
  if (result.related_topics?.length) {
    formatted += 'Related topics:\n';
    result.related_topics.slice(0, 3).forEach((topic) => {
      if (topic?.text) {
        formatted += `- ${topic.text}`;
        if (topic.url) formatted += ` (${topic.url})`;
        formatted += '\n';
      }
    });
  }

  if (!formatted) {
    formatted = `DuckDuckGo search returned no specific answer for this query.`;
  }

  return formatted;
}

/**
 * Searches for fishing-related information using DuckDuckGo.
 * Returns formatted information labeled as search-derived.
 */
export async function searchFishingInfo(query: string, timeoutMs = 8_000): Promise<{ result: WebSearchResult | null; source: 'web' } | null> {
  const searchResult = await searchDuckDuckGo(query, timeoutMs);
  if (!searchResult) return null;

  return {
    result: searchResult,
    source: 'web',
  };
}
