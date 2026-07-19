import axios from 'axios';
import { CONFIG } from '../../config/index.js';

let embeddingAvailable: boolean | null = null;

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

  if (embeddingAvailable === false) return null;

  try {
    const response = await axios.post(
      config.url,
      { input: text, model: config.model },
      { headers: config.headers, timeout: 15000 }
    );

    return response.data.data[0].embedding;
  } catch (error: any) {
    if (embeddingAvailable !== null) {
      console.warn(`Embedding failed (${error?.message || 'unknown'}) — continuing without vectors`);
      embeddingAvailable = false;
    }
    return null;
  }
};
