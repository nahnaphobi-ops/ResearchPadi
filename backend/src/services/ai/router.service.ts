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
  /** Who the call is for, so it counts against their daily AI allowance. */
  userId?: string;
}

/** Output tokens to allow for roughly `words` words of prose, with headroom. */
export const tokensForWords = (words: number) => Math.ceil(words * 1.6) + 1024;

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
    userId: options.userId,
    meta: { action: context?.action || context?.type || 'draft' },
  });
  return result.text;
};

/**
 * One supervision call on the most capable model (Opus-class, GPT fallback).
 * The caller decides what to do when the output was cut off.
 */
export const routeSupervision = async (
  prompt: string,
  options: { systemPrompt: string; maxTokens: number; meta?: Record<string, unknown> },
): Promise<{ text: string; truncated: boolean }> => {
  const result = await aiCall({
    prompt,
    tier: 'supervision',
    systemPrompt: options.systemPrompt,
    cachePrompt: true,
    maxTokens: options.maxTokens,
    meta: { action: 'supervise', ...options.meta },
  });
  return { text: result.text, truncated: result.truncated };
};

// Re-export gateway functions for direct usage
export { gatewayDraft, gatewaySupervise, type GatewayResponse };
