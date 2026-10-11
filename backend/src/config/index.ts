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
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-for-dev-only',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  PRICING: {
    FULL_PAPER_GHS: 250,
    PLANS: {
      standard: 120,
      premium: 200,
    } as Record<string, number>,
  },
  ARKESEL: {
    API_KEY: process.env.ARKESEL_API_KEY,
    // Must be approved in the Arkesel dashboard; max 11 characters.
    SENDER_ID: process.env.ARKESEL_SENDER_ID,
    // Sandbox: Arkesel accepts the request but does not deliver or charge.
    SANDBOX: process.env.ARKESEL_SANDBOX === 'true',
  },
  RAG: {
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    CHUNK_SIZE: parseInt(process.env.RAG_CHUNK_SIZE || '500'),
    CHUNK_OVERLAP: parseInt(process.env.RAG_CHUNK_OVERLAP || '50'),
    TOP_K: parseInt(process.env.RAG_TOP_K || '5'),
  },
  QUEUE: {
    PAPER_CONCURRENCY: parseInt(process.env.PAPER_CONCURRENCY || '6', 10),
    AI_RATE_LIMIT_MAX: parseInt(process.env.AI_RATE_LIMIT_MAX || '20', 10),
    AI_RATE_LIMIT_WINDOW: parseInt(process.env.AI_RATE_LIMIT_WINDOW || '60000', 10),
  },
  AI_GATEWAY: {
    ENABLE_PROMPT_CACHING: process.env.ENABLE_PROMPT_CACHING !== 'false',
  },
  // Daily AI spend per user (USD, resets 00:00 UTC) for workspace and other
  // on-demand AI. Sized so a subscriber who hits the cap every day still costs
  // well under their plan price (standard GHS 120 ≈ $10, premium GHS 200 ≈ $17
  // a month). Paid papers are prepaid and not counted here.
  AI_BUDGET: {
    FREE_DAILY_USD: parseFloat(process.env.AI_BUDGET_FREE_USD || '0.02'),
    STANDARD_DAILY_USD: parseFloat(process.env.AI_BUDGET_STANDARD_USD || '0.12'),
    PREMIUM_DAILY_USD: parseFloat(process.env.AI_BUDGET_PREMIUM_USD || '0.30'),
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

