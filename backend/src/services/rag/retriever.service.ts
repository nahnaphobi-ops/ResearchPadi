import { supabase } from '../../db/supabase.js';
import { generateEmbedding } from './embedder.service.js';
import { CONFIG } from '../../config/index.js';
import { cacheGet, CACHE_TTL } from '../../lib/cache.js';
import { sanitizeIlikeTerm, ilikeContains } from '../../lib/postgrest-filter.js';

export const retrieveContext = async (query: string) => {
  const safeQuery = sanitizeIlikeTerm(query, 120);
  return cacheGet(
    `rag:${safeQuery.toLowerCase().substring(0, 100)}`,
    CACHE_TTL.RAG_SEARCH,
    async () => {
      // Try vector search first (requires OpenAI API key)
      const embedding = await generateEmbedding(query.slice(0, 2000));

      if (embedding) {
        const { data, error } = await supabase.rpc('match_knowledge_chunks', {
          query_embedding: embedding,
          match_threshold: 0.5,
          match_count: CONFIG.RAG.TOP_K,
        });

        if (!error && data && data.length > 0) {
          return data;
        }
      }

      if (!safeQuery) return [];

      // Fallback: full-text search using ilike (no API key needed)
      const pattern = ilikeContains(safeQuery);
      const { data, error } = await supabase
        .from('knowledge_chunks')
        .select('id, document_title, chunk_text, institution, source_name, authors, year, field, source_url')
        .or(`document_title.ilike.${pattern},chunk_text.ilike.${pattern}`)
        .limit(CONFIG.RAG.TOP_K * 2);

      if (error) {
        return [];
      }

      return data || [];
    },
  );
};
