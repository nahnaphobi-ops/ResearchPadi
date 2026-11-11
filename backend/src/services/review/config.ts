import { REVIEW_MODEL_DEFAULTS } from '../ai/models.js';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: ReadonlySet<string> = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

export interface ReviewConfig {
  /** Queue a review automatically when a paper finishes (REVIEW_ENABLED, default on). */
  enabled: boolean;
  readerModel: string;
  supervisorModel: string;
  /** Second supervisor for the admin compare mode. */
  compareModel: string;
  /** Supervisor passes per run; later passes only add suggestions that don't overlap earlier ones. */
  maxPasses: number;
  supervisorMaxTokens: number;
  readerMaxTokens: number;
  /** Most suggestions kept per run, highest severity first. */
  maxSuggestions: number;
  /**
   * Largest reader prompt, in tokens. Haiku 5.5 prices a whole request at 5x
   * once its prompt passes 100K tokens, so this stays below with headroom.
   */
  readerTokenBudget: number;
  usdToGhs: number;
  /** Unset: the model's own default effort. */
  readerEffort?: Effort;
  supervisorEffort?: Effort;
  /** Attempts per API call on 429 / overloaded / connection errors. */
  retryAttempts: number;
}

function int(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const n = parseInt(env[name] ?? '', 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

function num(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const n = parseFloat(env[name] ?? '');
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function effort(env: NodeJS.ProcessEnv, name: string): Effort | undefined {
  const v = env[name]?.trim();
  return v && EFFORTS.has(v) ? (v as Effort) : undefined;
}

/** Read at call time so the dry-run script and tests can change env first. */
export function reviewConfig(env: NodeJS.ProcessEnv = process.env): ReviewConfig {
  return {
    enabled: env.REVIEW_ENABLED !== 'false',
    readerModel: env.REVIEW_READER_MODEL?.trim() || REVIEW_MODEL_DEFAULTS.reader,
    supervisorModel: env.REVIEW_SUPERVISOR_MODEL?.trim() || REVIEW_MODEL_DEFAULTS.supervisor,
    compareModel: env.REVIEW_COMPARE_MODEL?.trim() || REVIEW_MODEL_DEFAULTS.compare,
    maxPasses: int(env, 'REVIEW_MAX_PASSES', 1, 1),
    supervisorMaxTokens: int(env, 'REVIEW_SUPERVISOR_MAX_TOKENS', 8000, 1024),
    readerMaxTokens: int(env, 'REVIEW_READER_MAX_TOKENS', 16000, 1024),
    maxSuggestions: int(env, 'REVIEW_MAX_SUGGESTIONS', 40, 1),
    readerTokenBudget: int(env, 'REVIEW_READER_TOKEN_BUDGET', 90_000, 10_000),
    usdToGhs: num(env, 'USD_TO_GHS', 12.5),
    readerEffort: effort(env, 'REVIEW_READER_EFFORT'),
    supervisorEffort: effort(env, 'REVIEW_SUPERVISOR_EFFORT'),
    retryAttempts: int(env, 'REVIEW_RETRY_ATTEMPTS', 4, 1),
  };
}
