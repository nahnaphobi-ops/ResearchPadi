import { randomUUID } from 'node:crypto';
import { supabase } from '../../db/supabase.js';
import { childLogger } from '../../lib/logger.js';
import { reviewQueue } from '../../lib/queue.js';
import type { PaperSource } from '../pipeline/paper-source.js';
import { reviewConfig, type ReviewConfig } from './config.js';
import { runReviewPipeline, shortError, type Spend } from './pipeline.js';
import { hasPricing } from './pricing.js';
import { guardSuggestions, suggestionKey } from './spans.js';

/**
 * AI review runs in the database: creating them, the background job that
 * fills them, and what students and admins read. The paper itself is only
 * changed by acceptSuggestion, when the student accepts one suggestion.
 */

const log = childLogger('ai-review');

export type RunKind = 'auto' | 'manual' | 'compare';
export interface ReviewJobData {
  runIds: string[];
}

/** A run still queued or running after this long had its worker die; it is marked failed. */
const STALE_AFTER_MS = 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

function assertPriced(models: string[]) {
  const missing = models.filter((m) => !hasPricing(m));
  if (missing.length) throw httpError(500, `No price for ${missing.join(', ')} in services/review/pricing.json`);
}

async function markFailed(runIds: string[], error: string) {
  if (!runIds.length) return;
  const { error: dbError } = await supabase
    .from('review_runs')
    .update({ status: 'failed', error, completed_at: new Date().toISOString() })
    .in('id', runIds);
  if (dbError) log.error({ runIds, err: dbError.message }, 'Could not mark review runs failed');
}

/** Insert a queued run. Returns null when the same review is already queued or running. */
async function insertRun(row: {
  paper_id: string;
  kind: RunKind;
  reader_model: string;
  supervisor_model: string;
  usd_to_ghs: number;
  compare_group?: string | null;
  requested_by?: string | null;
}): Promise<string | null> {
  // A run left queued or running by a dead worker would block new ones through
  // the one-active-run index; expire it first.
  await supabase
    .from('review_runs')
    .update({ status: 'failed', error: 'Timed out before finishing', completed_at: new Date().toISOString() })
    .eq('paper_id', row.paper_id)
    .eq('kind', row.kind)
    .eq('supervisor_model', row.supervisor_model)
    .in('status', ['queued', 'running'])
    .lt('created_at', new Date(Date.now() - STALE_AFTER_MS).toISOString());

  const { data, error } = await supabase.from('review_runs').insert(row).select('id').single();
  if (error) {
    if (error.code === '23505') return null;
    throw new Error(`Could not create the review run: ${error.message}`);
  }
  return data.id as string;
}

async function enqueue(runIds: string[]) {
  if (!reviewQueue) throw httpError(503, 'The review queue is unavailable (Redis is not configured).');
  try {
    // One job per run (or per compare pair); the job id stops a duplicate enqueue.
    await reviewQueue.add('review-paper', { runIds } satisfies ReviewJobData, { jobId: `review-${runIds[0]}`, attempts: 1 });
  } catch (err) {
    await markFailed(runIds, `Could not queue: ${shortError(err)}`);
    throw err;
  }
}

/**
 * Queue the automatic review of a just-finished paper. Called by the paper
 * worker after the paper is saved as completed; never throws, so a review
 * problem can't touch the paper or its delivery.
 */
export async function enqueueAutoReview(paperId: string): Promise<void> {
  try {
    const cfg = reviewConfig();
    if (!cfg.enabled) return;
    if (!process.env.ANTHROPIC_API_KEY || !reviewQueue) {
      log.info({ paperId }, 'AI review skipped: no Anthropic key or review queue');
      return;
    }
    assertPriced([cfg.readerModel, cfg.supervisorModel]);
    const id = await insertRun({
      paper_id: paperId,
      kind: 'auto',
      reader_model: cfg.readerModel,
      supervisor_model: cfg.supervisorModel,
      usd_to_ghs: cfg.usdToGhs,
    });
    if (!id) return;
    await enqueue([id]);
    log.info({ paperId, runId: id }, 'AI review queued');
  } catch (err) {
    log.error({ paperId, err: shortError(err) }, 'Could not queue the AI review; the paper is unaffected');
  }
}

/**
 * Admin: run the review again (manual), or compare mode: the default and the
 * compare supervisor on the same reader notes, stored side by side.
 */
export async function startAdminReview(paperId: string, adminUserId: string, compare: boolean): Promise<{ runIds: string[]; compareGroup: string | null }> {
  const cfg = reviewConfig();
  // '*': document_type is missing on databases that predate it (papers.controller OPTIONAL_PAPER_COLUMNS).
  const { data: paper } = await supabase.from('papers').select('*').eq('id', paperId).maybeSingle();
  if (!paper) throw httpError(404, 'Paper not found');
  if (paper.status !== 'completed' || !paper.final_content) throw httpError(400, 'Only completed papers can be reviewed');
  if (paper.document_type === 'care_study') throw httpError(400, 'Care studies are not AI-reviewed: a wording suggestion could change a clinical fact');

  const models = compare ? [cfg.supervisorModel, cfg.compareModel] : [cfg.supervisorModel];
  if (compare && models[0] === models[1]) throw httpError(400, 'REVIEW_COMPARE_MODEL must differ from REVIEW_SUPERVISOR_MODEL');
  assertPriced([cfg.readerModel, ...models]);
  if (!process.env.ANTHROPIC_API_KEY) throw httpError(503, 'ANTHROPIC_API_KEY is not configured');
  if (!reviewQueue) throw httpError(503, 'The review queue is unavailable (Redis is not configured).');

  const compareGroup = compare ? randomUUID() : null;
  const runIds: string[] = [];
  for (const model of models) {
    const id = await insertRun({
      paper_id: paperId,
      kind: compare ? 'compare' : 'manual',
      reader_model: cfg.readerModel,
      supervisor_model: model,
      usd_to_ghs: cfg.usdToGhs,
      compare_group: compareGroup,
      requested_by: adminUserId,
    });
    if (!id) {
      await markFailed(runIds, 'Cancelled: another review of this paper was already running');
      throw httpError(409, `A ${compare ? 'compare' : 'manual'} review of this paper with ${model} is already running`);
    }
    runIds.push(id);
  }
  await enqueue(runIds);
  log.info({ paperId, runIds, compare }, 'Admin AI review queued');
  return { runIds, compareGroup };
}

const spendColumns = (prefix: 'reader' | 'supervisor', spend: Spend) => ({
  [`${prefix}_input_tokens`]: spend.usage.inputTokens,
  [`${prefix}_output_tokens`]: spend.usage.outputTokens,
  [`${prefix}_cache_read_tokens`]: spend.usage.cacheReadTokens,
  [`${prefix}_cache_write_tokens`]: spend.usage.cacheWriteTokens,
  [`${prefix}_cost_usd`]: spend.cost.usd,
  [`${prefix}_cost_ghs`]: spend.cost.ghs,
});

/** The background job (workers/review.worker). Writes only review tables. */
export async function processReviewJob(job: ReviewJobData, cfg: ReviewConfig = reviewConfig()): Promise<void> {
  const { data: runs, error } = await supabase
    .from('review_runs')
    .select('id, paper_id, status, reader_model, supervisor_model')
    .in('id', job.runIds);
  if (error) throw new Error(`Could not load review runs: ${error.message}`);
  // Already finished (a re-delivered job): nothing to do, nothing duplicated.
  const active = (runs ?? []).filter((r) => r.status === 'queued' || r.status === 'running');
  if (!active.length) return;
  // Keep the job's order: in compare mode the default supervisor is first.
  active.sort((a, b) => job.runIds.indexOf(a.id) - job.runIds.indexOf(b.id));
  const ids = active.map((r) => r.id as string);
  const paperId = active[0].paper_id as string;
  const meta = { paperId, runIds: ids };

  try {
    const { data: paper } = await supabase.from('papers').select('id, user_id, final_content, sources_used').eq('id', paperId).maybeSingle();
    if (!paper?.final_content) {
      await markFailed(ids, 'The paper has no finished text');
      return;
    }
    await supabase.from('review_runs').update({ status: 'running', started_at: new Date().toISOString() }).in('id', ids);

    const outcome = await runReviewPipeline({
      paper: paper.final_content,
      sources: Array.isArray(paper.sources_used) ? (paper.sources_used as PaperSource[]) : [],
      // The models recorded on the run, even if the env changed since it was queued.
      supervisorModels: active.map((r) => r.supervisor_model as string),
      cfg: { ...cfg, readerModel: active[0].reader_model as string },
      userId: paper.user_id ?? undefined,
      meta,
    });

    // Check against the paper as it is now: the student may have changed it while this ran.
    const { data: current } = await supabase.from('papers').select('final_content').eq('id', paperId).maybeSingle();
    const text: string = current?.final_content ?? '';

    for (let i = 0; i < active.length; i++) {
      const runId = active[i].id as string;
      const sup = outcome.supervisors[i];
      const base = {
        passes: sup.result?.passes ?? 0,
        reader_strategy: outcome.reader?.strategy ?? 'skipped',
        reader_prompt_tokens: outcome.reader?.promptTokens ?? null,
        reader_notes: outcome.reader?.notes ?? null,
        ...spendColumns('reader', outcome.readerSpend),
        ...spendColumns('supervisor', sup.spend),
        completed_at: new Date().toISOString(),
      };

      if (!sup.result) {
        await supabase.from('review_runs').update({ ...base, status: 'failed', error: `Supervisor failed: ${sup.error}` }).eq('id', runId);
        continue;
      }

      const { kept, drops } = guardSuggestions(text, sup.result.items, cfg.maxSuggestions);
      const rows = kept.map((s, rank) => ({
        run_id: runId,
        suggestion_key: suggestionKey(s),
        model_ref: s.id,
        rank,
        section: s.section,
        type: s.type,
        severity: s.severity,
        original: s.original,
        suggested: s.suggested,
        reason: s.reason,
      }));
      if (rows.length) {
        const { error: insertError } = await supabase
          .from('review_suggestions')
          .upsert(rows, { onConflict: 'run_id,suggestion_key', ignoreDuplicates: true });
        if (insertError) {
          await supabase.from('review_runs').update({ ...base, status: 'failed', error: `Could not save suggestions: ${insertError.message}` }).eq('id', runId);
          continue;
        }
      }

      const status = outcome.readerError ? 'degraded' : 'completed';
      await supabase.from('review_runs').update({
        ...base,
        status,
        error: outcome.readerError ? `Reader failed, so the supervisor read the paper alone: ${outcome.readerError}` : null,
        suggestions_count: rows.length,
        // Suggestions whose original was not in the paper exactly once (spans.ts).
        dropped_suggestions_count: drops.not_found + drops.ambiguous,
        drop_details: { ...drops, returned: sup.result.items.length, truncated: sup.result.truncated, salvaged: sup.result.salvaged },
      }).eq('id', runId);

      log.info(
        { ...meta, runId, status, supervisor: sup.model, kept: rows.length, drops, readerUsd: outcome.readerSpend.cost.usd, supervisorUsd: sup.spend.cost.usd },
        'AI review finished',
      );
    }
  } catch (err) {
    log.error({ ...meta, err: shortError(err) }, 'AI review job failed');
    await markFailed(ids, shortError(err));
  }
}

// --- Students ---

const STUDENT_SUGGESTION_COLUMNS = 'id, section, type, severity, original, suggested, reason, status, rank';

async function ownsPaper(paperId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('papers').select('id').eq('id', paperId).eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

/** The newest finished review of the student's paper, plus whether a newer one is still running. */
export async function getStudentReview(paperId: string, userId: string) {
  if (!(await ownsPaper(paperId, userId))) throw httpError(404, 'Paper not found');
  const { data: runs, error } = await supabase
    .from('review_runs')
    .select('id, status, suggestions_count, created_at, completed_at')
    .eq('paper_id', paperId)
    .neq('kind', 'compare')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw httpError(500, 'Could not load the review');

  const latest = runs?.[0] ?? null;
  const shown = runs?.find((r) => r.status === 'completed' || r.status === 'degraded') ?? null;
  let suggestions: unknown[] = [];
  if (shown) {
    const { data, error: sErr } = await supabase
      .from('review_suggestions')
      .select(STUDENT_SUGGESTION_COLUMNS)
      .eq('run_id', shown.id)
      .order('rank', { ascending: true });
    if (sErr) throw httpError(500, 'Could not load the suggestions');
    suggestions = data ?? [];
  }
  return {
    // queued | running | completed | degraded | failed | null (never reviewed)
    latestStatus: latest?.status ?? null,
    run: shown ? { id: shown.id, status: shown.status, createdAt: shown.created_at, completedAt: shown.completed_at } : null,
    suggestions,
  };
}

/** The suggestion, if it belongs to a student-visible run of this paper. */
async function suggestionOfPaper(paperId: string, suggestionId: string) {
  const { data } = await supabase
    .from('review_suggestions')
    .select('id, status, review_runs!inner(paper_id, kind)')
    .eq('id', suggestionId)
    .maybeSingle();
  const run = (data as any)?.review_runs;
  if (!data || !run || run.paper_id !== paperId || run.kind === 'compare') return null;
  return data;
}

export type AcceptOutcome = 'accepted' | 'not_found' | 'not_pending' | 'stale' | 'ambiguous';

/**
 * Apply one suggestion to the paper, only if its original text still appears
 * exactly once. apply_review_suggestion does the check and the change under a
 * row lock, so two accepts can't overwrite each other.
 */
export async function acceptSuggestion(paperId: string, suggestionId: string, userId: string): Promise<AcceptOutcome> {
  if (!(await ownsPaper(paperId, userId)) || !(await suggestionOfPaper(paperId, suggestionId))) return 'not_found';
  const { data, error } = await supabase.rpc('apply_review_suggestion', { p_suggestion: suggestionId, p_user: userId });
  if (error) throw httpError(500, 'Could not apply the suggestion');
  return data as AcceptOutcome;
}

export async function rejectSuggestion(paperId: string, suggestionId: string, userId: string): Promise<'rejected' | 'not_found' | 'not_pending'> {
  if (!(await ownsPaper(paperId, userId)) || !(await suggestionOfPaper(paperId, suggestionId))) return 'not_found';
  const { data, error } = await supabase
    .from('review_suggestions')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) throw httpError(500, 'Could not reject the suggestion');
  return data ? 'rejected' : 'not_pending';
}

// --- Admins ---

const RUN_COLUMNS = '*';
const ADMIN_SUGGESTION_COLUMNS = 'id, rank, section, type, severity, original, suggested, reason, status';

/** Every run of a paper (compare runs included) with its suggestions and costs. */
export async function adminPaperReviews(paperId: string) {
  const { data: runs, error } = await supabase
    .from('review_runs')
    .select(RUN_COLUMNS)
    .eq('paper_id', paperId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw httpError(500, 'Could not load reviews');
  return withSuggestions(runs ?? []);
}

async function withSuggestions(runs: any[]) {
  if (!runs.length) return [];
  const { data: all, error } = await supabase
    .from('review_suggestions')
    .select(`run_id, ${ADMIN_SUGGESTION_COLUMNS}`)
    .in('run_id', runs.map((r) => r.id))
    .order('rank', { ascending: true });
  if (error) throw httpError(500, 'Could not load suggestions');
  return runs.map((r) => ({ ...r, suggestions: (all ?? []).filter((s: any) => s.run_id === r.id) }));
}

/** One compare pair: both runs and their suggestions, plus what the pair really cost (reader counted once). */
export async function adminCompareGroup(group: string) {
  const { data: runs, error } = await supabase
    .from('review_runs')
    .select(RUN_COLUMNS)
    .eq('compare_group', group)
    .order('created_at', { ascending: true });
  if (error) throw httpError(500, 'Could not load the comparison');
  if (!runs?.length) throw httpError(404, 'Comparison not found');
  return { group, paperId: runs[0].paper_id, spend: pairSpend(runs), runs: await withSuggestions(runs) };
}

/** Recent compare pairs with each side's numbers, for testing supervisors across papers. */
export async function adminCompareList(limit = 20) {
  const { data: runs, error } = await supabase
    .from('review_runs')
    .select('id, paper_id, compare_group, status, reader_model, supervisor_model, reader_strategy, suggestions_count, dropped_suggestions_count, drop_details, reader_cost_usd, reader_cost_ghs, supervisor_input_tokens, supervisor_output_tokens, supervisor_cost_usd, supervisor_cost_ghs, started_at, completed_at, created_at')
    .eq('kind', 'compare')
    .order('created_at', { ascending: false })
    .limit(limit * 2);
  if (error) throw httpError(500, 'Could not load comparisons');

  const groups = new Map<string, any[]>();
  for (const r of runs ?? []) {
    const list = groups.get(r.compare_group) ?? [];
    list.push(r);
    groups.set(r.compare_group, list);
  }
  return [...groups.entries()].map(([group, list]) => ({
    group,
    paperId: list[0].paper_id,
    createdAt: list[list.length - 1].created_at,
    spend: pairSpend(list),
    runs: list.map((r) => ({
      id: r.id,
      supervisorModel: r.supervisor_model,
      status: r.status,
      suggestions: r.suggestions_count,
      droppedNotVerbatim: r.dropped_suggestions_count,
      dropDetails: r.drop_details,
      supervisorTokens: { input: r.supervisor_input_tokens, output: r.supervisor_output_tokens },
      supervisorCostUsd: Number(r.supervisor_cost_usd),
      supervisorCostGhs: Number(r.supervisor_cost_ghs),
      seconds: r.started_at && r.completed_at ? Math.round((Date.parse(r.completed_at) - Date.parse(r.started_at)) / 1000) : null,
    })),
  }));
}

/** Both runs of a pair record the shared reader call; count it once. */
function pairSpend(runs: any[]) {
  const readerUsd = Number(runs[0]?.reader_cost_usd ?? 0);
  const readerGhs = Number(runs[0]?.reader_cost_ghs ?? 0);
  const supUsd = runs.reduce((sum, r) => sum + Number(r.supervisor_cost_usd ?? 0), 0);
  const supGhs = runs.reduce((sum, r) => sum + Number(r.supervisor_cost_ghs ?? 0), 0);
  return { readerUsd, readerGhs, supervisorsUsd: supUsd, supervisorsGhs: supGhs, totalUsd: readerUsd + supUsd, totalGhs: readerGhs + supGhs };
}
