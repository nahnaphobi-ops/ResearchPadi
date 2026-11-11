import { childLogger } from '../../lib/logger.js';
import type { PaperSource } from '../pipeline/paper-source.js';
import type { ReviewConfig } from './config.js';
import { ZERO_COST, ZERO_USAGE, type Cost, type TokenUsage } from './pricing.js';
import { runReader, type ReaderResult } from './reader.js';
import { runSupervisor, type SupervisorResult } from './supervisor.js';

const log = childLogger('review-pipeline');

export interface Spend {
  usage: TokenUsage;
  cost: Cost;
}

export interface SupervisorOutcome {
  model: string;
  result: SupervisorResult | null;
  error: string | null;
  spend: Spend;
}

export interface ReviewOutcome {
  reader: ReaderResult | null;
  /** Set when the reader failed after its retries; the supervisors then ran on the paper alone. */
  readerError: string | null;
  readerSpend: Spend;
  supervisors: SupervisorOutcome[];
}

/** A short, loggable error: type, status and our own message. Never paper or model text. */
export function shortError(err: unknown): string {
  const e = err as { name?: string; status?: number; message?: string } | null;
  const status = e?.status ? ` (${e.status})` : '';
  const message = (e?.message ?? String(err)).replace(/\s+/g, ' ').slice(0, 200);
  return `${e?.name ?? 'Error'}${status}: ${message}`;
}

const partialOf = (err: unknown): Spend => (err as { partial?: Spend } | null)?.partial ?? { usage: ZERO_USAGE, cost: ZERO_COST };

/**
 * Reader once, then each supervisor on the same notes (one for a normal run,
 * two for compare mode). Never throws: each stage's failure is in the outcome.
 * No database access, so the worker and the dry-run script share it.
 */
export async function runReviewPipeline(args: {
  paper: string;
  sources: PaperSource[];
  supervisorModels: string[];
  cfg: ReviewConfig;
  userId?: string;
  meta?: Record<string, unknown>;
  logUsage?: boolean;
}): Promise<ReviewOutcome> {
  const { paper, cfg, meta } = args;

  let reader: ReaderResult | null = null;
  let readerError: string | null = null;
  let readerSpend: Spend = { usage: ZERO_USAGE, cost: ZERO_COST };
  try {
    reader = await runReader({ paper, sources: args.sources, cfg, userId: args.userId, meta, logUsage: args.logUsage });
    readerSpend = { usage: reader.usage, cost: reader.cost };
  } catch (err) {
    readerError = shortError(err);
    readerSpend = partialOf(err);
    log.error({ ...meta, err: readerError }, 'Reader failed after retries; supervisor will read the paper alone');
  }

  const supervisors: SupervisorOutcome[] = [];
  for (const model of args.supervisorModels) {
    try {
      const result = await runSupervisor({
        paper,
        notes: reader?.notes ?? null,
        model,
        cfg,
        userId: args.userId,
        meta: { ...meta, supervisor: model },
        logUsage: args.logUsage,
      });
      supervisors.push({ model, result, error: null, spend: { usage: result.usage, cost: result.cost } });
    } catch (err) {
      const error = shortError(err);
      log.error({ ...meta, supervisor: model, err: error }, 'Supervisor failed');
      supervisors.push({ model, result: null, error, spend: partialOf(err) });
    }
  }

  return { reader, readerError, readerSpend, supervisors };
}
