import { childLogger } from '../../lib/logger.js';
import { callStructured } from './client.js';
import type { ReviewConfig } from './config.js';
import { addCost, addUsage, ZERO_COST, ZERO_USAGE, type Cost, type TokenUsage } from './pricing.js';
import { buildSupervisorUser, supervisorSystem } from './prompts.js';
import { parseSuggestions, SUPERVISOR_SCHEMA, type ReaderNotes } from './schema.js';

const log = childLogger('review-supervisor');

export interface SupervisorResult {
  /** Raw suggestions as returned; the quality guard checks them next. */
  items: unknown[];
  usage: TokenUsage;
  cost: Cost;
  passes: number;
  /** A pass hit max_tokens. */
  truncated: boolean;
  /** Complete suggestions were recovered from a cut-off response. */
  salvaged: boolean;
}

/**
 * Suggest-only review. Pass 1 reads the paper (and the reader's notes when
 * there are any); each later pass, up to REVIEW_MAX_PASSES, is shown the
 * passages already covered and asked only for new ones.
 */
export async function runSupervisor(args: {
  paper: string;
  notes: ReaderNotes | null;
  model: string;
  cfg: ReviewConfig;
  userId?: string;
  meta?: Record<string, unknown>;
  logUsage?: boolean;
}): Promise<SupervisorResult> {
  const { cfg, meta } = args;
  const items: unknown[] = [];
  let usage = ZERO_USAGE;
  let cost = ZERO_COST;
  let passes = 0;
  let truncated = false;
  let salvaged = false;

  for (let pass = 1; pass <= cfg.maxPasses; pass++) {
    const remaining = cfg.maxSuggestions - items.length;
    if (remaining <= 0) break;
    const already = items
      .map((s) => (s && typeof s === 'object' ? String((s as Record<string, unknown>).original ?? '') : ''))
      .filter(Boolean);
    try {
      const res = await callStructured({
        model: args.model,
        system: supervisorSystem(remaining),
        user: buildSupervisorUser(args.paper, args.notes, already),
        schema: SUPERVISOR_SCHEMA,
        maxTokens: cfg.supervisorMaxTokens,
        effort: cfg.supervisorEffort,
        userId: args.userId,
        stage: 'supervisor',
        usdToGhs: cfg.usdToGhs,
        retryAttempts: cfg.retryAttempts,
        logUsage: args.logUsage,
        meta: { ...meta, pass },
      });
      usage = addUsage(usage, res.usage);
      cost = addCost(cost, res.cost);
      passes = pass;
      const cut = res.stopReason === 'max_tokens';
      const parsed = parseSuggestions(res.text, cut);
      if (cut) {
        truncated = true;
        log.warn({ ...meta, pass, outputTokens: res.usage.outputTokens, kept: parsed.items.length }, 'Supervisor hit max_tokens; kept the complete suggestions');
      }
      salvaged ||= parsed.salvaged;
      items.push(...parsed.items);
      if (parsed.items.length === 0) break;
    } catch (err: any) {
      if (err?.usage) {
        usage = addUsage(usage, err.usage);
        cost = addCost(cost, err.cost);
      }
      // A later pass failing keeps what the earlier passes found.
      if (pass > 1) {
        log.warn({ ...meta, pass, err: err?.message }, 'Extra supervisor pass failed; keeping earlier suggestions');
        break;
      }
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), { partial: { usage, cost } });
    }
  }

  return { items, usage, cost, passes, truncated, salvaged };
}
