import { supabase } from '../../db/supabase';
import { generateEmbedding } from './embedder.service';
import { CONFIG } from '../../config';
import { cacheGet, CACHE_TTL } from '../../lib/cache';

export const retrieveContext = async (query: string) => {
  return cacheGet(
    `rag:${query.toLowerCase().trim().substring(0, 100)}`,
    CACHE_TTL.RAG_SEARCH,
    async () => {
      // Try vector search first (requires OpenAI API key)
      const embedding = await generateEmbedding(query);

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

      // Fallback: full-text search using ilike (no API key needed)
      const { data, error } = await supabase
        .from('knowledge_chunks')
        .select('id, document_title, chunk_text, institution, source_name, authors, year, field, source_url')
        .or(`document_title.ilike.%${query}%,chunk_text.ilike.%${query}%`)
        .limit(CONFIG.RAG.TOP_K * 2);

      if (error) {
        return [];
      }

      return data || [];
    },
  );
};
