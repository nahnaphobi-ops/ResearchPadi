import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabase } from '../../db/supabase.js';
import { childLogger } from '../../lib/logger.js';
import { getReadyRedis } from '../../lib/redis.js';
import { aiCircuitBreaker } from '../../lib/circuit-breaker.js';
import { assertBudget, recordSpend, getBudget } from '../../lib/ai-budget.js';
import { callPerplexityAgent, type AgentSource } from './perplexity-agent.js';
import { isOfflineMode, offlineResponse } from './offline.service.js';
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
// Global per-provider ceiling protects the shared API key / provider RPM.
const RATE_LIMITS: Record<Provider, { max: number; windowMs: number }> = {
  anthropic: { max: 40, windowMs: 60_000 },
  openai: { max: 50, windowMs: 60_000 },
  perplexity: { max: 20, windowMs: 60_000 },
};

// Per-user fairness cap so one heavy user can't consume the whole bucket.
const PER_USER_AI_MAX = parseInt(process.env.AI_RATE_LIMIT_MAX || '20', 10);

async function checkRateLimit(provider: Provider, userId?: string): Promise<boolean> {
  const limit = RATE_LIMITS[provider];
  const window = Math.floor(Date.now() / limit.windowMs);
  const redis = getReadyRedis();
  if (!redis) return true;

  try {
    // Global provider ceiling
    const globalKey = `rl:ai:${provider}:g:${window}`;
    const globalCount = await redis.incr(globalKey);
    if (globalCount === 1) await redis.pexpire(globalKey, limit.windowMs);
    if (globalCount > limit.max) return false;

    // Per-user cap
    if (userId) {
      const userKey = `rl:ai:${provider}:u:${userId}:${window}`;
      const userCount = await redis.incr(userKey);
      if (userCount === 1) await redis.pexpire(userKey, limit.windowMs);
      if (userCount > PER_USER_AI_MAX) return false;
    }
    return true;
  } catch {
    // Fallback to allow if Redis is down
    return true;
  }
}

// --- Core call function ---
/**
 * Every model in the chain failed. Report a 502 rather than passing a provider's
 * own status through: an upstream 401 (bad API key) would look like the user's
 * session expired, and some clients log out on 401.
 */
function providersUnavailable(cause: Error | null): Error {
  if (cause) log.error({ err: cause.message }, 'All AI providers failed');
  return Object.assign(new Error('The AI service is unavailable right now. Please try again shortly.'), { status: 502, cause });
}

export interface GatewayRequest {
  prompt: string;
  context?: Record<string, any>;
  tier: ModelTier;
  preferredModel?: string;
  userId?: string;
  maxTokens?: number;
  systemPrompt?: string;
  /** Cache systemPrompt with Anthropic (only worth it when the same system prompt repeats). */
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
  /** The model stopped at maxTokens: the text is cut off. */
  truncated: boolean;
  /** Web sources behind the answer (research tier). */
  sources?: AgentSource[];
}

/**
 * Central AI gateway. Routes through failover chain,
 * tracks tokens, costs, rate limits, and budgets.
 * Uses Redis for distributed state + circuit breaker for resilience.
 */
export async function aiCall(req: GatewayRequest): Promise<GatewayResponse> {
  const { tier, userId, prompt, context, systemPrompt, maxTokens, cachePrompt, meta } = req;
  if (isOfflineMode()) return offlineResponse(req);

  // Per-user daily spend cap (throws AiBudgetError → 429)
  await assertBudget(userId);

  // Build chain
  const names = req.preferredModel
    ? [req.preferredModel, ...FAILOVER_CHAINS[tier].filter(m => m !== req.preferredModel)]
    : FAILOVER_CHAINS[tier];
  const chain = names.map(n => MODELS[n]).filter(Boolean);

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

    if (!(await checkRateLimit(model.provider, userId))) {
      log.warn({ provider: model.provider }, 'Rate limit hit, trying next provider');
      continue;
    }

    try {
      const start = Date.now();
      const result = await callProvider(model, prompt, context, systemPrompt, maxTokens, cachePrompt);
      const latencyMs = Date.now() - start;

      aiCircuitBreaker.recordSuccess(circuitKey);

      const cost = estimateCost(result.inputTokens, result.outputTokens, model);
      await recordSpend(userId, cost);
      if (result.truncated) {
        log.warn({ model: model.model, tier, outputTokens: result.outputTokens, meta }, 'AI output hit maxTokens and was cut off');
      }

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
        truncated: result.truncated,
        sources: result.sources,
      };
    } catch (err: any) {
      lastError = err;
      aiCircuitBreaker.recordFailure(circuitKey);
      log.warn({ provider: model.provider, model: model.model, err: err.message }, 'AI call failed, trying next');
    }
  }

  throw providersUnavailable(lastError);
}

/**
 * Streaming version of aiCall for live, in-editor AI. `onDelta` receives text as
 * it arrives. Fails over to the next model only if nothing has been streamed yet
 * (switching mid-answer would garble it). Same budget, logging and cost rules.
 */
export async function aiStream(
  req: GatewayRequest & { signal?: AbortSignal },
  onDelta: (text: string) => void,
): Promise<GatewayResponse> {
  const { tier, userId, prompt, systemPrompt, maxTokens, cachePrompt, meta, signal } = req;
  if (isOfflineMode()) {
    const result = offlineResponse(req);
    onDelta(result.text);
    return result;
  }
  await assertBudget(userId);

  const chain = FAILOVER_CHAINS[tier].map(n => MODELS[n]).filter(Boolean);
  let lastError: Error | null = null;
  let attempts = 0;

  for (const model of chain) {
    attempts++;
    const circuitKey = `ai:${model.provider}`;
    if (model.provider === 'perplexity' || !hasProvider(model.provider)) continue;
    if (!aiCircuitBreaker.canExecute(circuitKey)) continue;
    if (!(await checkRateLimit(model.provider, userId))) continue;

    let streamed = false;
    const emit = (text: string) => {
      if (!text) return;
      streamed = true;
      onDelta(text);
    };

    try {
      const start = Date.now();
      const result = model.provider === 'anthropic'
        ? await streamAnthropic(model, prompt, systemPrompt, maxTokens, cachePrompt, emit, signal)
        : await streamOpenAI(model, prompt, systemPrompt, maxTokens, emit, signal);
      const latencyMs = Date.now() - start;
      aiCircuitBreaker.recordSuccess(circuitKey);

      const cost = estimateCost(result.inputTokens, result.outputTokens, model);
      await recordSpend(userId, cost);
      logUsage({
        userId, provider: model.provider, model: model.model, tier,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        costUsd: cost, latencyMs, cached: result.cached, meta: { ...meta, stream: true },
      }).catch(err => log.debug({ err: err.message }, 'Usage log failed'));

      return {
        text: result.text, model: model.model, provider: model.provider,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens, costUsd: cost,
        cached: result.cached, latencyMs, attempts, truncated: result.truncated,
      };
    } catch (err: any) {
      if (signal?.aborted) throw err;
      lastError = err;
      aiCircuitBreaker.recordFailure(circuitKey);
      log.warn({ provider: model.provider, model: model.model, err: err.message, streamed }, 'AI stream failed');
      if (streamed) throw err;
    }
  }

  throw providersUnavailable(lastError);
}

async function streamAnthropic(
  model: ModelConfig,
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
  cachePrompt: boolean | undefined,
  emit: (text: string) => void,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const system = systemPrompt
    ? cachePrompt && model.supportsCaching
      ? [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }]
      : systemPrompt
    : undefined;

  const stream = getAnthropic().messages.stream(
    {
      model: model.model,
      max_tokens: maxTokens || model.maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    },
    { signal },
  );
  stream.on('text', emit);
  const final = await stream.finalMessage();

  const text = final.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  return {
    text,
    inputTokens: final.usage?.input_tokens || 0,
    outputTokens: final.usage?.output_tokens || 0,
    cached: (final.usage?.cache_read_input_tokens || 0) > 0,
    truncated: final.stop_reason === 'max_tokens',
  };
}

async function streamOpenAI(
  model: ModelConfig,
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number | undefined,
  emit: (text: string) => void,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const stream = await getOpenAI().chat.completions.create(
    {
      model: model.model,
      max_completion_tokens: maxTokens || model.maxTokens,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal },
  );

  let text = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let finish: string | null = null;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      text += delta;
      emit(delta);
    }
    finish = chunk.choices[0]?.finish_reason ?? finish;
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens || 0;
      outputTokens = chunk.usage.completion_tokens || 0;
    }
  }
  return { text, inputTokens, outputTokens, cached: false, truncated: finish === 'length' };
}

// --- Provider-specific calls ---

interface ProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  truncated: boolean;
  sources?: AgentSource[];
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
      return callPerplexity(model, prompt, systemPrompt);
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

  // Cache only the system prompt: it repeats across calls, so later calls read
  // it at a tenth of the input price. The user message changes every time, and
  // caching it would add the cache-write surcharge with nothing ever read back.
  const system = systemPrompt
    ? cachePrompt && model.supportsCaching
      ? [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }]
      : systemPrompt
    : undefined;

  const response = await client.messages.create({
    model: model.model,
    max_tokens: maxTokens || model.maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const cached = (response.usage?.cache_read_input_tokens || 0) > 0;

  return { text, inputTokens, outputTokens, cached, truncated: response.stop_reason === 'max_tokens' };
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
    // GPT-5-series models reject `max_tokens`.
    max_completion_tokens: maxTokens || model.maxTokens,
    messages,
  });

  const choice = response.choices[0];
  const text = choice?.message?.content || '';
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;

  return { text, inputTokens, outputTokens, cached: false, truncated: choice?.finish_reason === 'length' };
}

async function callPerplexity(
  model: ModelConfig,
  prompt: string,
  systemPrompt?: string,
): Promise<ProviderResult> {
  // The Agent API takes a single input; instructions go in front of the question.
  const input = systemPrompt ? `${systemPrompt}

${prompt}` : prompt;
  const result = await callPerplexityAgent(model.model, input);
  return { ...result, cached: false, truncated: false };
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
 * Today's AI allowance for a user (plan, limit, spent, remaining, reset time).
 */
export async function getRemainingBudget(userId: string) {
  return getBudget(userId);
}
