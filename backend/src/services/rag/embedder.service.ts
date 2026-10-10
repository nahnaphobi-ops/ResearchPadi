import axios from 'axios';
import { CONFIG } from '../../config/index.js';

let embeddingAvailable: boolean | null = null;
let embeddingRetryAt = 0;
const EMBEDDING_RETRY_MS = 60_000;

function getEmbeddingConfig(): { url: string; headers: Record<string, string>; model: string } | null {
  const key = CONFIG.OPENAI_API_KEY;

  if (!key) return null;

  // OpenRouter uses a compatible API at openrouter.ai
  if (key.startsWith('sk-or-')) {
    return {
      url: 'https://openrouter.ai/api/v1/embeddings',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://researchpadi.com',
        'X-Title': 'ResearchPadi',
      },
      model: 'openai/text-embedding-3-small',
    };
  }

  // Standard OpenAI
  return {
    url: 'https://api.openai.com/v1/embeddings',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    model: CONFIG.RAG.EMBEDDING_MODEL,
  };
}

export const generateEmbedding = async (text: string) => {
  const config = getEmbeddingConfig();

  if (!config) {
    if (embeddingAvailable === null) {
      console.warn('Embedding provider not configured — storing chunks without vectors');
      embeddingAvailable = false;
    }
    return null;
  }

  if (embeddingAvailable === false && Date.now() < embeddingRetryAt) return null;

  try {
    const response = await axios.post(
      config.url,
      { input: text, model: config.model },
      { headers: config.headers, timeout: 15000 }
    );

    embeddingAvailable = true;
    return response.data.data[0].embedding;
  } catch (error: any) {
    console.warn(`Embedding failed (${error?.message || 'unknown'}) — continuing without vectors`);
    embeddingAvailable = false;
    embeddingRetryAt = Date.now() + EMBEDDING_RETRY_MS;
    return null;
  }
};

const EMBED_BATCH = 96;

/**
 * Embed many texts in batched requests. Returns one entry per input, null where
 * embedding isn't available (no provider configured, or the request failed).
 */
export const generateEmbeddings = async (texts: string[]): Promise<(number[] | null)[]> => {
  const config = getEmbeddingConfig();
  if (!config || !texts.length) return texts.map(() => null);
  if (embeddingAvailable === false && Date.now() < embeddingRetryAt) return texts.map(() => null);

  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH).map((t) => t.slice(0, 8000));
    try {
      const response = await axios.post(
        config.url,
        { input: batch, model: config.model },
        { headers: config.headers, timeout: 60_000 }
      );
      const rows = (response.data?.data ?? []) as { index: number; embedding: number[] }[];
      const byIndex = new Map(rows.map((r) => [r.index, r.embedding]));
      batch.forEach((_, j) => out.push(byIndex.get(j) ?? null));
      embeddingAvailable = true;
    } catch (error: any) {
      console.warn(`Batch embedding failed (${error?.message || 'unknown'}) — continuing without vectors`);
      embeddingAvailable = false;
      embeddingRetryAt = Date.now() + EMBEDDING_RETRY_MS;
      while (out.length < texts.length) out.push(null);
      return out;
    }
  }
  return out;
};
