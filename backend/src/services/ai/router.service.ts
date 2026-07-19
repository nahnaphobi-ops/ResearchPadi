import { childLogger } from '../../lib/logger.js';
import { aiCall, gatewayDraft, gatewaySupervise, type GatewayResponse } from './gateway.service.js';

const log = childLogger('ai-router');

/**
 * Route drafting to primary (Sonnet) with GPT fallback via gateway.
 * Preserves existing API for backward compatibility.
 */
export const routeDrafting = async (prompt: string, context: any): Promise<string> => {
  const result = await aiCall({
    prompt,
    context,
    tier: 'drafting',
    cachePrompt: true,
    meta: { action: context?.action || 'draft' },
  });
  return result.text;
};

/**
 * Route supervision to primary (Opus) with GPT fallback via gateway.
 * Preserves existing API for backward compatibility.
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
