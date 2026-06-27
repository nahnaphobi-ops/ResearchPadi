export type Provider = 'anthropic' | 'openai' | 'perplexity';
export type ModelTier = 'drafting' | 'supervision' | 'research';

export interface ModelConfig {
  provider: Provider;
  model: string;
  tier: ModelTier;
  maxTokens: number;
  inputPricePer1M: number;   // USD per 1M input tokens
  outputPricePer1M: number;  // USD per 1M output tokens
  supportsCaching: boolean;  // Anthropic prompt caching
}

export const MODELS: Record<string, ModelConfig> = {
  // Anthropic models
  'claude-sonnet-4-6': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    tier: 'drafting',
    maxTokens: 8192,
    inputPricePer1M: 3.0,
    outputPricePer1M: 15.0,
    supportsCaching: true,
  },
  'claude-opus-4-8': {
    provider: 'anthropic',
    model: 'claude-opus-4-8',
    tier: 'supervision',
    maxTokens: 4096,
    inputPricePer1M: 15.0,
    outputPricePer1M: 75.0,
    supportsCaching: true,
  },
  // OpenAI models
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    tier: 'drafting',
    maxTokens: 4096,
    inputPricePer1M: 2.5,
    outputPricePer1M: 10.0,
    supportsCaching: false,
  },
  'gpt-5.4': {
    provider: 'openai',
    model: 'gpt-5.4',
    tier: 'drafting',
    maxTokens: 4096,
    inputPricePer1M: 5.0,
    outputPricePer1M: 20.0,
    supportsCaching: false,
  },
  'gpt-5.5': {
    provider: 'openai',
    model: 'gpt-5.5',
    tier: 'supervision',
    maxTokens: 4096,
    inputPricePer1M: 10.0,
    outputPricePer1M: 40.0,
    supportsCaching: false,
  },
  // Perplexity models
  'sonar': {
    provider: 'perplexity',
    model: 'sonar',
    tier: 'research',
    maxTokens: 2048,
    inputPricePer1M: 0.5,
    outputPricePer1M: 2.0,
    supportsCaching: false,
  },
};

// Failover chains: primary → fallback → fallback
export const FAILOVER_CHAINS: Record<ModelTier, string[]> = {
  drafting: ['claude-sonnet-4-6', 'gpt-4o', 'gpt-5.4'],
  supervision: ['claude-opus-4-8', 'gpt-5.5'],
  research: ['sonar'],
};

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
    (outputTokens / 1_000_000) * config.outputPricePer1M
  );
}
