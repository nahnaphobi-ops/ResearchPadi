import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import axios from 'axios';
import { supabase } from '../../db/supabase.js';
import { childLogger } from '../../lib/logger.js';
import { getRedis } from '../../lib/redis.js';
import { aiCircuitBreaker } from '../../lib/circuit-breaker.js';
import {
  MODELS,
  FAILOVER_CHAINS,
  type ModelConfig,
  type Provider,
  type ModelTier,
  estimateCost,
} from './models.js';

const log = childLogger('ai-gateway');

// --- Singleton clients ---
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (!anthropicClient) throw new Error('ANTHROPIC_API_KEY not configured');
  return anthropicClient;
}

function getOpenAI(): OpenAI {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (!openaiClient) throw new Error('OPENAI_API_KEY not configured');
  return openaiClient;
}

function hasProvider(provider: Provider): boolean {
  switch (provider) {
    case 'anthropic': return !!process.env.ANTHROPIC_API_KEY;
    case 'openai': return !!process.env.OPENAI_API_KEY;
    case 'perplexity': return !!process.env.PERPLEXITY_API_KEY;
    default: return false;
  }
}

// --- Rate limiting (Redis-backed, works across pods) ---
const RATE_LIMITS: Record<Provider, { max: number; windowMs: number }> = {
  anthropic: { max: 40, windowMs: 60_000 },
  openai: { max: 50, windowMs: 60_000 },
  perplexity: { max: 20, windowMs: 60_000 },
};

async function checkRateLimit(provider: Provider): Promise<boolean> {
  const limit = RATE_LIMITS[provider];
  const key = `rl:ai:${provider}:${Math.floor(Date.now() / limit.windowMs)}`;

  try {
    const redis = getRedis();
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, limit.windowMs);
    }
    return current <= limit.max;
  } catch {
    // Fallback to allow if Redis is down
    return true;
  }
}

// --- Token budget tracking (Redis-backed) ---
const DEFAULT_DAILY_LIMIT = parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '500000', 10);

async function checkBudget(userId: string | undefined): Promise<{ allowed: boolean; remaining: number }> {
  if (!userId) return { allowed: true, remaining: Infinity };

  const now = Date.now();
  const dayKey = new Date().toISOString().split('T')[0];
  const budgetKey = `budget:${userId}:${dayKey}`;

  try {
    const redis = getRedis();
    const used = parseInt((await redis.get(budgetKey)) || '0', 10);
    const remaining = DEFAULT_DAILY_LIMIT - used;
    return { allowed: remaining > 0, remaining };
  } catch {
    return { allowed: true, remaining: DEFAULT_DAILY_LIMIT };
  }
}

async function deductTokens(userId: string | undefined, tokens: number): Promise<void> {
  if (!userId) return;

  const dayKey = new Date().toISOString().split('T')[0];
  const budgetKey = `budget:${userId}:${dayKey}`;

  try {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    pipeline.incrby(budgetKey, tokens);
    pipeline.pexpire(budgetKey, 86_400_000);
    await pipeline.exec();
  } catch {
    // ignore
  }
}

// --- Core call function ---
export interface GatewayRequest {
  prompt: string;
  context?: Record<string, any>;
  tier: ModelTier;
  preferredModel?: string;
  userId?: string;
  maxTokens?: number;
  systemPrompt?: string;
  /** Enable Anthropic prompt caching for long prompts */
  cachePrompt?: boolean;
  /** Metadata for logging */
  meta?: Record<string, any>;
}

export interface GatewayResponse {
  text: string;
  model: string;
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  cached: boolean;
  latencyMs: number;
  attempts: number;
}

/**
 * Central AI gateway. Routes through failover chain,
 * tracks tokens, costs, rate limits, and budgets.
 * Uses Redis for distributed state + circuit breaker for resilience.
 */
export async function aiCall(req: GatewayRequest): Promise<GatewayResponse> {
  const { tier, userId, prompt, context, systemPrompt, maxTokens, cachePrompt, meta } = req;

  // Budget check
  const budget = await checkBudget(userId);
  if (!budget.allowed) {
    throw new Error('Daily AI token budget exceeded. Please try again tomorrow.');
  }

  // Build chain
  const chain = req.preferredModel
    ? [MODELS[req.preferredModel], ...FAILOVER_CHAINS[tier].filter(m => m !== req.preferredModel)]
        .map(n => MODELS[n as string])
        .filter(Boolean)
    : FAILOVER_CHAINS[tier].map(n => MODELS[n]).filter(Boolean);

  let lastError: Error | null = null;
  let attempts = 0;

  for (const model of chain) {
    attempts++;
    const circuitKey = `ai:${model.provider}`;

    if (!hasProvider(model.provider)) {
      log.debug({ provider: model.provider, model: model.model }, 'Provider not configured, skipping');
      continue;
    }

    if (!aiCircuitBreaker.canExecute(circuitKey)) {
      log.warn({ provider: model.provider }, 'Circuit open, skipping provider');
      continue;
    }

    if (!(await checkRateLimit(model.provider))) {
      log.warn({ provider: model.provider }, 'Rate limit hit, trying next provider');
      continue;
    }

    try {
      const start = Date.now();
      const result = await callProvider(model, prompt, context, systemPrompt, maxTokens, cachePrompt);
      const latencyMs = Date.now() - start;

      aiCircuitBreaker.recordSuccess(circuitKey);

      const cost = estimateCost(result.inputTokens, result.outputTokens, model);
      await deductTokens(userId, result.inputTokens + result.outputTokens);

      // Log to DB (fire and forget)
      logUsage({
        userId,
        provider: model.provider,
        model: model.model,
        tier,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: cost,
        latencyMs,
        cached: result.cached,
        meta,
      }).catch(err => log.debug({ err: err.message }, 'Usage log failed'));

      return {
        text: result.text,
        model: model.model,
        provider: model.provider,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens,
        costUsd: cost,
        cached: result.cached,
        latencyMs,
        attempts,
      };
    } catch (err: any) {
      lastError = err;
      aiCircuitBreaker.recordFailure(circuitKey);
      log.warn({ provider: model.provider, model: model.model, err: err.message }, 'AI call failed, trying next');
    }
  }

  throw lastError || new Error('All AI providers failed');
}

// --- Provider-specific calls ---

interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

async function callProvider(
  model: ModelConfig,
  prompt: string,
  context?: Record<string, any>,
  systemPrompt?: string,
  maxTokens?: number,
  cachePrompt?: boolean,
): Promise<ProviderResult> {
  switch (model.provider) {
    case 'anthropic':
      return callAnthropic(model, prompt, context, systemPrompt, maxTokens, cachePrompt);
    case 'openai':
      return callOpenAI(model, prompt, context, systemPrompt, maxTokens);
    case 'perplexity':
      return callPerplexity(model, prompt, systemPrompt, maxTokens);
    default:
      throw new Error(`Unknown provider: ${model.provider}`);
  }
}

async function callAnthropic(
  model: ModelConfig,
  prompt: string,
  context?: Record<string, any>,
  systemPrompt?: string,
  maxTokens?: number,
  cachePrompt?: boolean,
): Promise<ProviderResult> {
  const client = getAnthropic();

  const userContent = context
    ? `${prompt}\n\nContext: ${JSON.stringify(context)}`
    : prompt;

  const userMessage: Anthropic.MessageParam = {
    role: 'user',
    content: cachePrompt
      ? [{ type: 'text', text: userContent, cache_control: { type: 'ephemeral' } }]
      : userContent,
  };

  const messages = [userMessage];

  const response = await client.messages.create({
    model: model.model,
    max_tokens: maxTokens || model.maxTokens,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages,
  });

  const text = (response.content[0] as any).text || '';
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const cached = (response.usage?.cache_read_input_tokens || 0) > 0;

  return { text, inputTokens, outputTokens, cached };
}

async function callOpenAI(
  model: ModelConfig,
  prompt: string,
  context?: Record<string, any>,
  systemPrompt?: string,
  maxTokens?: number,
): Promise<ProviderResult> {
  const client = getOpenAI();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  const userContent = context
    ? `${prompt}\n\nContext: ${JSON.stringify(context)}`
    : prompt;
  messages.push({ role: 'user', content: userContent });

  const response = await client.chat.completions.create({
    model: model.model,
    max_tokens: maxTokens || model.maxTokens,
    messages,
  });

  const text = response.choices[0]?.message?.content || '';
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;

  return { text, inputTokens, outputTokens, cached: false };
}

async function callPerplexity(
  model: ModelConfig,
  prompt: string,
  systemPrompt?: string,
  maxTokens?: number,
): Promise<ProviderResult> {
  if (!process.env.PERPLEXITY_API_KEY) throw new Error('PERPLEXITY_API_KEY not configured');

  const messages = [
    { role: 'system', content: systemPrompt || 'You are a research assistant.' },
    { role: 'user', content: prompt },
  ];

  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    { model: model.model, messages, max_tokens: maxTokens || model.maxTokens },
    {
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    },
  );

  const text = response.data.choices[0]?.message?.content || '';
  const inputTokens = response.data.usage?.prompt_tokens || 0;
  const outputTokens = response.data.usage?.completion_tokens || 0;

  return { text, inputTokens, outputTokens, cached: false };
}

// --- Usage logging ---

interface UsageLogEntry {
  userId?: string;
  provider: Provider;
  model: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  cached: boolean;
  meta?: Record<string, any>;
}

async function logUsage(entry: UsageLogEntry) {
  await supabase.from('ai_usage_logs').insert({
    user_id: entry.userId || null,
    provider: entry.provider,
    model: entry.model,
    tier: entry.tier,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    total_tokens: entry.inputTokens + entry.outputTokens,
    cost_usd: entry.costUsd,
    latency_ms: entry.latencyMs,
    cached: entry.cached,
    metadata: entry.meta || {},
    created_at: new Date().toISOString(),
  });
}

// --- Public helpers for existing services ---

/**
 * Convenience: draft a chapter using the gateway.
 */
export async function gatewayDraft(
  prompt: string,
  context: Record<string, any>,
  userId?: string,
  meta?: Record<string, any>,
): Promise<string> {
  const result = await aiCall({
    prompt,
    context,
    tier: 'drafting',
    userId,
    cachePrompt: true,
    meta,
  });
  return result.text;
}

/**
 * Convenience: supervise/review using the gateway.
 */
export async function gatewaySupervise(
  content: string,
  instructions: string,
  userId?: string,
  meta?: Record<string, any>,
): Promise<string> {
  const result = await aiCall({
    prompt: `Review and improve the following academic content based on these instructions:\n\n${instructions}\n\nContent:\n${content}`,
    tier: 'supervision',
    userId,
    meta,
  });
  return result.text;
}

/**
 * Convenience: research query using the gateway.
 */
export async function gatewayResearch(
  query: string,
  userId?: string,
  meta?: Record<string, any>,
): Promise<string> {
  const result = await aiCall({
    prompt: query,
    tier: 'research',
    userId,
    systemPrompt: 'You are a research assistant. Provide current facts and data about the given topic.',
    meta,
  });
  return result.text;
}

/**
 * Get usage stats for a user (or global if no userId).
 */
export async function getUsageStats(userId?: string, days: number = 30) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  let query = supabase
    .from('ai_usage_logs')
    .select('provider, model, tier, input_tokens, output_tokens, total_tokens, cost_usd, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) throw error;

  // Aggregate
  const totals = (data || []).reduce(
    (acc, row) => {
      acc.totalTokens += row.total_tokens || 0;
      acc.totalCost += row.cost_usd || 0;
      acc.totalCalls += 1;
      acc.byModel[row.model] = (acc.byModel[row.model] || 0) + (row.total_tokens || 0);
      acc.byProvider[row.provider] = (acc.byProvider[row.provider] || 0) + (row.total_tokens || 0);
      return acc;
    },
    {
      totalTokens: 0,
      totalCost: 0,
      totalCalls: 0,
      byModel: {} as Record<string, number>,
      byProvider: {} as Record<string, number>,
    }
  );

  return { ...totals, period: `${days}d`, records: data?.length || 0 };
}

/**
 * Get remaining token budget for a user (Redis-backed).
 */
export async function getRemainingBudget(userId: string): Promise<{ remaining: number; limit: number; resetAt: number }> {
  const dayKey = new Date().toISOString().split('T')[0];
  const budgetKey = `budget:${userId}:${dayKey}`;

  try {
    const redis = getRedis();
    const used = parseInt((await redis.get(budgetKey)) || '0', 10);
    const resetAt = new Date();
    resetAt.setHours(23, 59, 59, 999);
    return {
      remaining: DEFAULT_DAILY_LIMIT - used,
      limit: DEFAULT_DAILY_LIMIT,
      resetAt: resetAt.getTime(),
    };
  } catch {
    const resetAt = new Date();
    resetAt.setHours(23, 59, 59, 999);
    return { remaining: DEFAULT_DAILY_LIMIT, limit: DEFAULT_DAILY_LIMIT, resetAt: resetAt.getTime() };
  }
}
