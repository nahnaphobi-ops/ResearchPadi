import { searchOpenAlex } from '../citations/openalex.service.js';
import { searchSemanticScholar } from '../citations/semantic.service.js';
import { searchPerplexity } from '../ai/perplexity.service.js';
import { retrieveContext } from '../rag/retriever.service.js';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { parseAuthors, serializeAuthors } from '../../lib/authors.js';
import { sourceKey, type Source } from '../citations/source.types.js';
import { searchGhanaRepositories } from '../rag/dspace.service.js';

/** The drafting prompts expect flat citation records with authors as a string. */
function toPromptCitation(s: Source) {
  return {
    title: s.title,
    authors: serializeAuthors(s.authors) || 'Unknown',
    author_surname: s.authors[0]?.family,
    year: s.year,
    venue: s.containerTitle,
    doi: s.doi,
    url: s.url,
    abstract: s.snippet,
    source: s.origin === 'openalex' ? 'OpenAlex' : 'Semantic Scholar',
    ghanaian: s.ghanaian,
  };
}

export const performResearch = async (topic: string) => {
  return cacheGet(
    `research2:${topic.toLowerCase().trim().substring(0, 100)}`,
    CACHE_TTL.CITATIONS_EXTERNAL,
    async () => {
      const [ghanaWorks, globalWorks, semanticResults, perplexityData, ragResults, repositoryItems] = await Promise.all([
        searchOpenAlex(topic, { ghanaOnly: true, perPage: 10 }),
        searchOpenAlex(topic, { perPage: 10 }),
        searchSemanticScholar(topic),
        searchPerplexity(topic),
        retrieveContext(topic, { limit: 8 }),
        searchGhanaRepositories(topic, { perRepo: 3 }),
      ]);

      // Live repository hits (with abstracts) join the knowledge-base excerpts, without duplicates.
      const knownUrls = new Set((ragResults || []).map((r) => r.source_url));
      const liveGhanaian = repositoryItems
        .filter((it) => it.abstract && !knownUrls.has(it.url))
        .slice(0, 8)
        .map((it) => ({
          document_title: it.title,
          authors: serializeAuthors(parseAuthors(it.authorsRaw)) || null,
          year: it.year,
          institution: it.repo.institution,
          chunk_text: it.abstract.slice(0, 1200),
          source_url: it.url,
          doi: it.doi ?? null,
        }));

      // Ghana-affiliated research first, then global; drop duplicates across APIs.
      const seen = new Set<string>();
      const citations = [...ghanaWorks, ...globalWorks, ...semanticResults]
        .filter((s) => {
          const key = sourceKey(s);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map(toPromptCitation);

      return {
        citations,
        ghanaianSources: [...(ragResults || []), ...liveGhanaian],
        webData: perplexityData,
        summary: `Research completed for topic: ${topic}`,
      };
    },
  );
};
