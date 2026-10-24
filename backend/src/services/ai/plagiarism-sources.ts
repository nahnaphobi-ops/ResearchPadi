import axios from 'axios';
import { CONFIG } from '../../config/index.js';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { childLogger } from '../../lib/logger.js';
import { searchKnowledge } from '../rag/retriever.service.js';
import { searchGhanaRepositories } from '../rag/dspace.service.js';
import { searchOpenAlexAbstracts } from '../citations/openalex.service.js';
import { searchSemanticScholarAbstracts } from '../citations/semantic.service.js';
import { isOfflineMode } from './offline.service.js';
import { searchWeb } from './perplexity-search.js';
import { keywordQuery, pickQueries } from './plagiarism-text.js';

const log = childLogger('plagiarism-sources');

/** A piece of published text to compare the student's sentences against. */
export interface Passage {
  title: string;
  url: string;
  text: string;
  /** Where it was found, when more specific than the source's name (e.g. "UGSpace"). */
  where?: string;
}

export interface SourceResult {
  passages: Passage[];
  status: 'checked' | 'skipped' | 'failed';
  note?: string;
}

export interface PlagiarismSource {
  name: string;
  search: (sentences: string[]) => Promise<SourceResult>;
}

const UA = 'ResearchPadi/1.0 (+https://researchpadi.com; hello@researchpadi.com)';
const OFFLINE: SourceResult = { passages: [], status: 'skipped', note: 'offline test mode' };

function reason(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 429) return 'busy, try again later';
  if (status) return `unavailable (HTTP ${status})`;
  return 'could not be reached';
}

/** Run one search per query; the source counts as searched unless every query failed. */
async function searchEach(queries: string[], run: (q: string) => Promise<Passage[]>, limit = queries.length): Promise<SourceResult> {
  const passages: Passage[] = [];
  const errors: unknown[] = [];
  for (let i = 0; i < queries.length; i += limit) {
    const batch = await Promise.allSettled(queries.slice(i, i + limit).map(run));
    for (const r of batch) {
      if (r.status === 'fulfilled') passages.push(...r.value);
      else errors.push(r.reason);
    }
  }
  if (queries.length && errors.length === queries.length) return { passages, status: 'failed', note: reason(errors[0]) };
  return { passages, status: 'checked' };
}

/** ResearchPadi's own library of Ghanaian theses and articles, searched sentence by sentence. */
export const librarySource: PlagiarismSource = {
  name: 'ResearchPadi library',
  search: (sentences) =>
    searchEach(pickQueries(sentences, 20), async (q) =>
      (await searchKnowledge(q, { limit: 6 })).map((h) => ({
        title: h.document_title,
        url: h.source_url || '',
        text: h.chunk_text,
        where: h.source_name || undefined,
      })), 5),
};

/** Live search of the Ghanaian university repositories (UGSpace, KNUSTSpace and others). */
export const ghanaRepositoriesSource: PlagiarismSource = {
  name: 'Ghana university repositories',
  search: async (sentences) => {
    if (isOfflineMode()) return OFFLINE;
    return searchEach(pickQueries(sentences, 3).map((s) => keywordQuery(s)), async (q) =>
      (await searchGhanaRepositories(q, { perRepo: 2 }))
        .filter((item) => item.abstract.length > 100)
        .map((item) => ({ title: item.title, url: item.url, text: item.abstract, where: item.repo.label })));
  },
};

/** OpenAlex: over 250 million scholarly works worldwide (abstracts). */
export const openAlexSource: PlagiarismSource = {
  name: 'OpenAlex',
  search: async (sentences) => {
    if (isOfflineMode()) return OFFLINE;
    return searchEach(pickQueries(sentences, 4).map((s) => keywordQuery(s)), async (q) =>
      (await searchOpenAlexAbstracts(q)).map((w) => ({ title: w.title, url: w.url, text: w.abstract })));
  },
};

/** Semantic Scholar: over 200 million papers (abstracts). */
export const semanticScholarSource: PlagiarismSource = {
  name: 'Semantic Scholar',
  search: async (sentences) => {
    if (isOfflineMode()) return OFFLINE;
    return searchEach(pickQueries(sentences, 2).map((s) => keywordQuery(s)), async (q) =>
      (await searchSemanticScholarAbstracts(q)).map((p) => ({ title: p.title, url: p.url, text: p.abstract })));
  },
};

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

async function wikipediaTitles(query: string): Promise<string[]> {
  return cacheGet(`plagiarism:wiki-search:${query.toLowerCase()}`, CACHE_TTL.OPENALEX, async () => {
    const { data } = await axios.get(WIKIPEDIA_API, {
      params: { action: 'query', list: 'search', srsearch: query, srlimit: 2, format: 'json', formatversion: 2 },
      headers: { 'User-Agent': UA },
      timeout: 8_000,
    });
    return ((data?.query?.search ?? []) as { title: string }[]).map((s) => s.title);
  });
}

async function wikipediaArticle(title: string): Promise<Passage | null> {
  return cacheGet(`plagiarism:wiki-page:${title}`, CACHE_TTL.OPENALEX, async () => {
    const { data } = await axios.get(WIKIPEDIA_API, {
      params: { action: 'query', prop: 'extracts', explaintext: 1, redirects: 1, titles: title, format: 'json', formatversion: 2 },
      headers: { 'User-Agent': UA },
      timeout: 8_000,
    });
    const page = data?.query?.pages?.[0] as { title?: string; extract?: string } | undefined;
    if (!page?.extract) return null;
    const name = page.title || title;
    return { title: name, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`, text: page.extract.slice(0, 40_000) };
  });
}

/** English Wikipedia: full article text, a common thing to copy from. */
export const wikipediaSource: PlagiarismSource = {
  name: 'Wikipedia',
  search: async (sentences) => {
    if (isOfflineMode()) return OFFLINE;
    const seen = new Set<string>();
    // Wikipedia's search wants every word to match, so ask with few, and fewer if that finds nothing.
    return searchEach(pickQueries(sentences, 3), async (sentence) => {
      let titles = await wikipediaTitles(keywordQuery(sentence, 5));
      if (!titles.length) titles = await wikipediaTitles(keywordQuery(sentence, 3));
      titles = titles.filter((t) => !seen.has(t) && seen.add(t));
      const pages = await Promise.all(titles.map(wikipediaArticle));
      return pages.filter((p): p is Passage => !!p);
    });
  },
};

function hostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

// After the web search is refused (no credit, bad key), skip it for a while
// instead of paying the wait on every check.
const WEB_RETRY_MS = 10 * 60_000;
let webRetryAt = 0;

/**
 * The open web, through Perplexity's Search API (about $5 per 1,000 searches,
 * five searches per check). Skipped, never failing the check, when the key is
 * missing or Perplexity refuses it.
 */
export const webSource: PlagiarismSource = {
  name: 'Open web',
  search: async (sentences) => {
    if (isOfflineMode()) return OFFLINE;
    const key = CONFIG.PERPLEXITY_API_KEY;
    if (!key) return { passages: [], status: 'skipped', note: 'not set up' };
    if (Date.now() < webRetryAt) return { passages: [], status: 'skipped', note: 'unavailable, check the Perplexity key and credit' };

    const result = await searchEach(pickQueries(sentences, 5).map((s) => s.slice(0, 300)), async (q) =>
      cacheGet(`plagiarism:web:${q.toLowerCase()}`, CACHE_TTL.OPENALEX, async () =>
        (await searchWeb(key, q)).map((r) => ({ title: r.title, url: r.url, text: r.snippet, where: hostname(r.url) }))));

    if (result.status === 'failed') {
      webRetryAt = Date.now() + WEB_RETRY_MS;
      log.warn({ note: result.note }, 'Web search refused; skipping it for 10 minutes');
      return { passages: [], status: 'skipped', note: 'unavailable, check the Perplexity key and credit' };
    }
    return result;
  },
};

export const PLAGIARISM_SOURCES: PlagiarismSource[] = [
  librarySource,
  ghanaRepositoriesSource,
  openAlexSource,
  semanticScholarSource,
  wikipediaSource,
  webSource,
];
