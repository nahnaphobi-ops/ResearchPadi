import { supabase } from '../../db/supabase.js';
import { generateEmbedding } from './embedder.service.js';
import { CONFIG } from '../../config/index.js';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { childLogger } from '../../lib/logger.js';

const log = childLogger('retriever');

export interface KnowledgeHit {
  id: string;
  document_title: string;
  chunk_text: string;
  authors: string | null;
  year: number | null;
  institution: string | null;
  source_name: string | null;
  source_url: string | null;
  field: string | null;
  doi: string | null;
  journal: string | null;
  publisher: string | null;
  document_type: string | null;
  keyword_rank: number | null;
  vector_similarity: number | null;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  field?: string;
  institution?: string;
  yearFrom?: number;
}

/**
 * Hybrid search over the Ghanaian knowledge base (see search_knowledge in the
 * 20261010010000 migration). Keyword ranking always runs; vector similarity is
 * fused in when an embedding provider is configured.
 */
export async function searchKnowledge(query: string, opts: SearchOptions = {}): Promise<KnowledgeHit[]> {
  const text = query.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!text) return [];
  const limit = Math.min(Math.max(opts.limit ?? CONFIG.RAG.TOP_K, 1), 50);
  const cacheKey = `rag2:${limit}:${opts.field ?? ''}:${opts.institution ?? ''}:${opts.yearFrom ?? ''}:${text.toLowerCase()}`;

  return cacheGet(cacheKey, CACHE_TTL.RAG_SEARCH, async () => {
    const embedding = await generateEmbedding(text.slice(0, 2000));
    const { data, error } = await supabase.rpc('search_knowledge', {
      p_query: text,
      p_embedding: embedding,
      p_limit: limit,
      p_field: opts.field ?? null,
      p_institution: opts.institution ?? null,
      p_year_from: opts.yearFrom ?? null,
    });
    if (error) {
      log.error({ err: error.message }, 'Knowledge search failed');
      return [];
    }
    return (data ?? []) as KnowledgeHit[];
  });
}

/**
 * Backwards-compatible entry point used by the paper pipeline, claim checks and
 * local citation search. Returns the same row shape as before, now with full
 * citation metadata and a fused relevance score.
 */
export const retrieveContext = async (query: string, opts: SearchOptions = {}) => {
  const hits = await searchKnowledge(query, opts);
  return hits.map((h) => ({ ...h, similarity: h.vector_similarity ?? h.score }));
};
