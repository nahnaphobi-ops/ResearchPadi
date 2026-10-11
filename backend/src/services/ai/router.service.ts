import { aiCall, gatewayDraft, gatewaySupervise, type GatewayResponse } from './gateway.service.js';

export interface DraftOptions {
  /**
   * 'light' for short edits and suggestions (Haiku-class, ~20x cheaper);
   * 'drafting' (default) for long-form writing.
   */
  tier?: 'light' | 'drafting';
  /** Stable instructions sent as the system prompt; cached across calls. */
  systemPrompt?: string;
  maxTokens?: number;
}

/**
 * Writing calls through the gateway (failover, budgets, usage logging).
 * Pick the smallest tier that does the job well.
 */
export const routeDrafting = async (prompt: string, context: any, options: DraftOptions = {}): Promise<string> => {
  // `action` / `type` only label the call in usage logs; the rest is real
  // context for the model. Sending labels (or `{}`) as text just costs tokens.
  const { action: _action, type: _type, ...modelContext } = context ?? {};
  const result = await aiCall({
    prompt,
    context: Object.keys(modelContext).length ? modelContext : undefined,
    tier: options.tier ?? 'drafting',
    systemPrompt: options.systemPrompt,
    cachePrompt: Boolean(options.systemPrompt),
    maxTokens: options.maxTokens,
    meta: { action: context?.action || context?.type || 'draft' },
  });
  return result.text;
};

/**
 * One supervision pass on the most capable model (Opus-class, GPT fallback).
 */
export const routeSupervision = async (content: string, instructions: string): Promise<string> => {
  const result = await aiCall({
    prompt: `Review and improve the following academic content based on these instructions:\n\n${instructions}\n\nContent:\n${content}`,
    tier: 'supervision',
    meta: { action: 'supervise' },
  });
  return result.text;
};

// Re-export gateway functions for direct usage
export { gatewayDraft, gatewaySupervise, type GatewayResponse };
