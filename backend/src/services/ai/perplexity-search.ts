import axios from 'axios';

/**
 * Perplexity Search API: ranked web pages with extracted page text. It returns
 * what is published, not model-written text, so it does not go through the
 * gateway. About $5 per 1,000 requests.
 * https://docs.perplexity.ai/api-reference/search-post
 */
const SEARCH_URL = 'https://api.perplexity.ai/search';

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchWeb(apiKey: string, query: string, maxResults = 5): Promise<WebResult[]> {
  const { data } = await axios.post(
    SEARCH_URL,
    { query, max_results: maxResults, max_tokens_per_page: 2048 },
    { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 15_000 },
  );
  return ((data?.results ?? []) as { title?: string; url?: string; snippet?: string }[])
    .filter((r) => r.url && r.snippet)
    .map((r) => ({ title: r.title || r.url!, url: r.url!, snippet: r.snippet! }));
}
