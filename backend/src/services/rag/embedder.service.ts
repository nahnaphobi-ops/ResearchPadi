import axios from 'axios';
import { CONFIG } from '../../config/index.js';

let embeddingAvailable: boolean | null = null;
let embeddingRetryAt = 0;
const EMBEDDING_RETRY_MS = 60_000;
let lastProblem: string | null = null;

/** Why the last embedding attempt gave no vectors (null when it worked), e.g. a rejected key. */
export function embeddingProblem(): string | null {
  return lastProblem;
}

/** "HTTP 401 from openrouter.ai: <provider's message>" rather than axios's bare status line. */
function describeFailure(error: any): string {
  const status = error?.response?.status;
  if (!status) return error?.message || 'unknown error';
  let host = 'the embedding provider';
  try { host = new URL(error.config?.url).host; } catch { /* keep the generic name */ }
  const body = error.response.data;
  const detail = String(body?.error?.message ?? body?.message ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
  return `HTTP ${status} from ${host}${detail ? `: ${detail}` : ''}`;
}

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
      model: `openai/${CONFIG.RAG.EMBEDDING_MODEL}`,
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
    lastProblem = null;
    return response.data.data[0].embedding;
  } catch (error: any) {
    lastProblem = describeFailure(error);
    console.warn(`Embedding failed (${lastProblem}) — continuing without vectors`);
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
  if (!config) lastProblem = 'OPENAI_API_KEY is not set';
  if (!config || !texts.length) return texts.map(() => null);
  // lastProblem still holds the failure that started this pause.
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
      lastProblem = null;
    } catch (error: any) {
      lastProblem = describeFailure(error);
      console.warn(`Batch embedding failed (${lastProblem}) — continuing without vectors`);
      embeddingAvailable = false;
      embeddingRetryAt = Date.now() + EMBEDDING_RETRY_MS;
      while (out.length < texts.length) out.push(null);
      return out;
    }
  }
  return out;
};
