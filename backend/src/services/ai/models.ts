/**
 * The one place model IDs live. Every AI call goes through the gateway, which
 * picks a tier's failover chain from here (a test fails if a model ID appears
 * anywhere else in src/).
 *
 * Tiers are sized to the job, cheapest first:
 *   light       short edits of a selection, topic/question suggestions
 *   drafting    long-form writing (chapters, abstracts, humanizing)
 *   supervision one review pass per paper, where quality matters most
 *   research    live web research with citations
 *
 * Prices are USD per 1M tokens (list price, Oct 2026) and only feed cost
 * estimates in usage logs. Re-check them when changing a model.
 */
export type Provider = 'anthropic' | 'openai' | 'perplexity';
export type ModelTier = 'light' | 'drafting' | 'supervision' | 'research';

export interface ModelConfig {
  provider: Provider;
  model: string;
  tier: ModelTier;
  maxTokens: number;
  inputPricePer1M: number;   // USD per 1M input tokens
  outputPricePer1M: number;  // USD per 1M output tokens
  supportsCaching: boolean;  // Anthropic prompt caching
  perRequestUsd?: number;    // flat fee per call (Perplexity search fee)
}

export const MODELS: Record<string, ModelConfig> = {
  // Anthropic (primary for every writing tier)
  'claude-haiku-5-5': {
    provider: 'anthropic',
    model: 'claude-haiku-5-5',
    tier: 'light',
    maxTokens: 4096,
    // Prompts over 100K tokens bill at $0.50 / $2.50; light-tier prompts stay far below.
    inputPricePer1M: 0.1,
    outputPricePer1M: 0.5,
    supportsCaching: true,
  },
  'claude-sonnet-5-5': {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    tier: 'drafting',
    maxTokens: 8192,
    inputPricePer1M: 2.0,
    outputPricePer1M: 10.0,
    supportsCaching: true,
  },
  'claude-opus-5-5': {
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    tier: 'supervision',
    maxTokens: 8192,
    inputPricePer1M: 4.0,
    outputPricePer1M: 20.0,
    supportsCaching: true,
  },
  // OpenAI (fallback when Anthropic is unavailable)
  'gpt-5.4-mini': {
    provider: 'openai',
    model: 'gpt-5.4-mini',
    tier: 'light',
    maxTokens: 4096,
    inputPricePer1M: 0.75,
    outputPricePer1M: 4.5,
    supportsCaching: false,
  },
  'gpt-5.4': {
    provider: 'openai',
    model: 'gpt-5.4',
    tier: 'drafting',
    maxTokens: 8192,
    inputPricePer1M: 2.5,
    outputPricePer1M: 15.0,
    supportsCaching: false,
  },
  'gpt-5.5': {
    provider: 'openai',
    model: 'gpt-5.5',
    tier: 'supervision',
    maxTokens: 8192,
    inputPricePer1M: 5.0,
    outputPricePer1M: 30.0,
    supportsCaching: false,
  },
  // Perplexity Agent API preset (`fast` replaced the retired `sonar` model).
  'fast': {
    provider: 'perplexity',
    model: 'fast',
    tier: 'research',
    maxTokens: 2048,
    inputPricePer1M: 1.0,
    outputPricePer1M: 1.0,
    supportsCaching: false,
    perRequestUsd: 0.005,
  },
};

// Failover chains: primary → fallback. Each fallback is the other provider's
// model of the same size, so an outage never silently moves a job up a tier.
export const FAILOVER_CHAINS: Record<ModelTier, string[]> = {
  light: ['claude-haiku-5-5', 'gpt-5.4-mini'],
  drafting: ['claude-sonnet-5-5', 'gpt-5.4'],
  supervision: ['claude-opus-5-5', 'gpt-5.5'],
  research: ['fast'],
};

/** The model a tier uses when its primary provider is up (for callers outside the gateway). */
export function primaryModel(tier: ModelTier): ModelConfig {
  return MODELS[FAILOVER_CHAINS[tier][0]];
}

export function getModelConfig(modelName: string): ModelConfig | undefined {
  return MODELS[modelName];
}

export function getFailoverChain(tier: ModelTier): ModelConfig[] {
  return FAILOVER_CHAINS[tier]
    .map(name => MODELS[name])
    .filter(Boolean);
}

export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  config: ModelConfig
): number {
  return (
    (inputTokens / 1_000_000) * config.inputPricePer1M +
    (outputTokens / 1_000_000) * config.outputPricePer1M +
    (config.perRequestUsd ?? 0)
  );
}
