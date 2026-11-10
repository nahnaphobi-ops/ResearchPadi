import Anthropic from '@anthropic-ai/sdk';
import { childLogger } from '../../lib/logger.js';
import { checkRateLimit, logUsage } from '../ai/gateway.service.js';
import type { ModelTier } from '../ai/models.js';
import type { Effort } from './config.js';
import { costOf, hasPricing, usageFromApi, type Cost, type TokenUsage } from './pricing.js';
import { withRetry } from './retry.js';

const log = childLogger('review-client');

// Retries are done by withRetry (429 / overloaded / connection), so the SDK's own are off.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 10 * 60 * 1000 });
  }
  return client;
}

/** The model declined (stop_reason "refusal"). */
export class ReviewRefusalError extends Error {}

export interface StructuredCall {
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  effort?: Effort;
  /** Logged and counted against the shared per-user AI rate limit. */
  userId?: string;
  stage: 'reader' | 'supervisor';
  usdToGhs: number;
  retryAttempts: number;
  /** false for the dry run: no ai_usage_logs row. */
  logUsage?: boolean;
  meta?: Record<string, unknown>;
}

export interface StructuredResult {
  text: string;
  usage: TokenUsage;
  cost: Cost;
  stopReason: string | null;
  /** The model that served the request, as the API reported it. */
  model: string;
  latencyMs: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wait for room under the gateway's Redis rate limits (global Anthropic ceiling
 * and the per-user cap) instead of failing: a review is background work.
 */
async function waitForRateLimit(userId: string | undefined, meta: Record<string, unknown> | undefined) {
  for (let i = 0; i < 6; i++) {
    if (await checkRateLimit('anthropic', userId)) return;
    const wait = 60_000 - (Date.now() % 60_000) + Math.floor(Math.random() * 2000);
    log.info({ ...meta, waitMs: wait }, 'AI rate limit full; review waiting for the next window');
    await sleep(wait);
  }
  throw Object.assign(new Error('AI rate limit stayed full for 6 minutes'), { status: 429 });
}

function tierFor(stage: StructuredCall['stage']): ModelTier {
  return stage === 'reader' ? 'light' : 'supervision';
}

/** One structured-output call with retries, rate limiting and real usage. */
export async function callStructured(call: StructuredCall): Promise<StructuredResult> {
  const anthropic = getClient();
  const start = Date.now();
  const response = await withRetry(
    async () => {
      await waitForRateLimit(call.userId, call.meta);
      return anthropic.messages.create({
        model: call.model,
        max_tokens: call.maxTokens,
        system: call.system,
        messages: [{ role: 'user', content: call.user }],
        output_config: {
          format: { type: 'json_schema', schema: call.schema },
          ...(call.effort ? { effort: call.effort } : {}),
        },
      });
    },
    {
      attempts: call.retryAttempts,
      onRetry: ({ attempt, delayMs, status }) =>
        log.warn({ ...call.meta, stage: call.stage, model: call.model, attempt, delayMs, status }, 'Review call failed; retrying'),
    },
  );
  const latencyMs = Date.now() - start;

  const usage = usageFromApi(response.usage);
  const servedBy = response.model || call.model;
  const cost = costOf(hasPricing(servedBy) ? servedBy : call.model, usage, call.usdToGhs);

  if (call.logUsage !== false) {
    logUsage({
      userId: call.userId,
      provider: 'anthropic',
      model: servedBy,
      tier: tierFor(call.stage),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: cost.usd,
      latencyMs,
      cached: usage.cacheReadTokens > 0,
      meta: {
        action: 'ai-review',
        stage: call.stage,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        stopReason: response.stop_reason,
        ...call.meta,
      },
    }).catch((err) => log.debug({ err: err.message }, 'Usage log failed'));
  }

  if (response.stop_reason === 'refusal') {
    throw Object.assign(new ReviewRefusalError(`The ${call.stage} model declined the request`), { usage, cost });
  }

  const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return { text, usage, cost, stopReason: response.stop_reason, model: servedBy, latencyMs };
}

/** Prompt size from the free token-count endpoint, for the reader's 100K guard. */
export async function countPromptTokens(args: {
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  retryAttempts: number;
}): Promise<number> {
  const res = await withRetry(
    () =>
      getClient().messages.countTokens({
        model: args.model,
        system: args.system,
        messages: [{ role: 'user', content: args.user }],
        output_config: { format: { type: 'json_schema', schema: args.schema } },
      }),
    { attempts: args.retryAttempts },
  );
  return res.input_tokens;
}
