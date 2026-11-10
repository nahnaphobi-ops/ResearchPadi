import { childLogger } from '../../lib/logger.js';
import type { PaperSource } from '../pipeline/paper-source.js';
import { callStructured, countPromptTokens } from './client.js';
import type { ReviewConfig } from './config.js';
import { addCost, addUsage, ZERO_COST, ZERO_USAGE, type Cost, type TokenUsage } from './pricing.js';
import { buildReaderUser, READER_SYSTEM } from './prompts.js';
import { mergeReaderNotes, parseReaderNotes, READER_NOTES_SCHEMA, type ReaderNotes } from './schema.js';
import { planReaderInput, rankSources, type CountTokens, type ReaderStrategy } from './tokens.js';

const log = childLogger('review-reader');

export interface ReaderResult {
  notes: ReaderNotes;
  usage: TokenUsage;
  cost: Cost;
  strategy: ReaderStrategy;
  /** Counted before the calls, summed over them. */
  promptTokens: number;
  calls: number;
  sourcesSent: number;
  sourcesTotal: number;
}

/** Thrown when the reader fails part-way: carries what the calls that did run cost. */
export interface PartialSpend {
  usage: TokenUsage;
  cost: Cost;
}

export async function runReader(args: {
  paper: string;
  sources: PaperSource[];
  cfg: ReviewConfig;
  userId?: string;
  meta?: Record<string, unknown>;
  logUsage?: boolean;
  /** Tests pass a fake; otherwise the API's token-count endpoint. */
  count?: CountTokens;
}): Promise<ReaderResult> {
  const { paper, cfg, meta } = args;
  const ranked = rankSources(paper, args.sources);

  let fullPromptTokens: number | null = null;
  const baseCount: CountTokens = args.count ?? ((part, sources) =>
    countPromptTokens({ model: cfg.readerModel, system: READER_SYSTEM, user: buildReaderUser(part, sources), schema: READER_NOTES_SCHEMA, retryAttempts: cfg.retryAttempts }));
  const count: CountTokens = async (part, sources) => {
    const n = await baseCount(part, sources);
    if (fullPromptTokens === null) fullPromptTokens = n;
    return n;
  };

  const plan = await planReaderInput(paper, ranked, cfg.readerTokenBudget, count);
  const sourcesSent = new Set(plan.chunks.flatMap((c) => c.sources.map((s) => s.key))).size;
  if (plan.strategy !== 'full') {
    log.warn(
      { ...meta, strategy: plan.strategy, fullPromptTokens, budget: cfg.readerTokenBudget, chunks: plan.chunks.length, sourcesSent, sourcesTotal: plan.sourcesTotal },
      'Reader input over the token budget; reduced it before calling the model',
    );
  }

  let usage = ZERO_USAGE;
  let cost = ZERO_COST;
  const parts: ReaderNotes[] = [];
  for (const chunk of plan.chunks) {
    try {
      const res = await callStructured({
        model: cfg.readerModel,
        system: READER_SYSTEM,
        user: buildReaderUser(chunk.text, chunk.sources, chunk),
        schema: READER_NOTES_SCHEMA,
        maxTokens: cfg.readerMaxTokens,
        effort: cfg.readerEffort,
        userId: args.userId,
        stage: 'reader',
        usdToGhs: cfg.usdToGhs,
        retryAttempts: cfg.retryAttempts,
        logUsage: args.logUsage,
        meta: { ...meta, part: chunk.part, parts: chunk.parts },
      });
      usage = addUsage(usage, res.usage);
      cost = addCost(cost, res.cost);
      if (res.stopReason === 'max_tokens') {
        log.warn({ ...meta, part: chunk.part, outputTokens: res.usage.outputTokens }, 'Reader notes hit max_tokens');
      }
      parts.push(parseReaderNotes(res.text));
    } catch (err: any) {
      // A refused call is still billed: count it, then report what was spent.
      if (err?.usage) {
        usage = addUsage(usage, err.usage);
        cost = addCost(cost, err.cost);
      }
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), { partial: { usage, cost } satisfies PartialSpend });
    }
  }

  return {
    notes: mergeReaderNotes(parts),
    usage,
    cost,
    strategy: plan.strategy,
    promptTokens: plan.chunks.reduce((sum, c) => sum + c.promptTokens, 0),
    calls: plan.chunks.length,
    sourcesSent,
    sourcesTotal: plan.sourcesTotal,
  };
}
