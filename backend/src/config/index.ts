import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  HUBTEL: {
    CLIENT_ID: process.env.HUBTEL_CLIENT_ID,
    CLIENT_SECRET: process.env.HUBTEL_CLIENT_SECRET,
    SENDER_ID: process.env.HUBTEL_SENDER_ID || 'ResearchPadi',
  },
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-for-dev-only',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  AI: {
    ANTHROPIC_SONNET_MODEL: process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-4-6',
    ANTHROPIC_OPUS_MODEL: process.env.ANTHROPIC_OPUS_MODEL || 'claude-opus-4-8',
    OPENAI_DRAFTING_MODEL: process.env.OPENAI_DRAFTING_MODEL || 'gpt-5.4',
    OPENAI_SUPERVISION_MODEL: process.env.OPENAI_SUPERVISION_MODEL || 'gpt-5.5',
  },
  RAG: {
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    CHUNK_SIZE: parseInt(process.env.RAG_CHUNK_SIZE || '500'),
    CHUNK_OVERLAP: parseInt(process.env.RAG_CHUNK_OVERLAP || '50'),
    TOP_K: parseInt(process.env.RAG_TOP_K || '5'),
  },
  QUEUE: {
    PAPER_CONCURRENCY: parseInt(process.env.PAPER_CONCURRENCY || '3', 10),
    AI_RATE_LIMIT_MAX: parseInt(process.env.AI_RATE_LIMIT_MAX || '5', 10),
    AI_RATE_LIMIT_WINDOW: parseInt(process.env.AI_RATE_LIMIT_WINDOW || '60000', 10),
  },
  AI_GATEWAY: {
    DAILY_TOKEN_LIMIT: parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '500000', 10),
    ENABLE_PROMPT_CACHING: process.env.ENABLE_PROMPT_CACHING !== 'false',
  },
  STORAGE: {
    PROVIDER: (process.env.STORAGE_PROVIDER as any) || 'supabase',
    BUCKET: process.env.STORAGE_BUCKET || 'papers',
    LOCAL_DIR: process.env.STORAGE_LOCAL_DIR || './storage',
  },
  CITATION_VERIFY: {
    // Similarity thresholds (0..1). Conservative on purpose — false "verified" is worse.
    TITLE_SIMILARITY_VERIFIED: parseFloat(process.env.CV_TITLE_SIM_VERIFIED || '0.90'),
    TITLE_SIMILARITY_PARTIAL: parseFloat(process.env.CV_TITLE_SIM_PARTIAL || '0.75'),
    YEAR_TOLERANCE: parseInt(process.env.CV_YEAR_TOLERANCE || '1', 10),
    // Policy: block auto-delivery if unverified ratio exceeds this (0..1).
    UNVERIFIED_BLOCK_RATIO: parseFloat(process.env.CV_UNVERIFIED_BLOCK_RATIO || '0.25'),
    // Rate limiting for external APIs (requests per window).
    EXTERNAL_RATE_LIMIT_MAX: parseInt(process.env.CV_EXT_RATE_MAX || '5', 10),
    EXTERNAL_RATE_LIMIT_WINDOW: parseInt(process.env.CV_EXT_RATE_WINDOW || '1000', 10),
    EXTERNAL_PER_REQUEST_TIMEOUT_MS: parseInt(process.env.CV_EXT_TIMEOUT || '8000', 10),
    // How many candidate matches to fetch from each source for scoring.
    CANDIDATE_LIMIT: parseInt(process.env.CV_CANDIDATE_LIMIT || '8', 10),
  },
};

export const AI_CONFIG = {
  drafting: {
    primary: {
      provider: 'anthropic',
      model: CONFIG.AI.ANTHROPIC_SONNET_MODEL
    },
    fallback: {
      provider: 'openai',
      model: CONFIG.AI.OPENAI_DRAFTING_MODEL
    }
  },
  supervision: {
    primary: {
      provider: 'anthropic',
      model: CONFIG.AI.ANTHROPIC_OPUS_MODEL
    },
    fallback: {
      provider: 'openai',
      model: CONFIG.AI.OPENAI_SUPERVISION_MODEL
    }
  }
};
