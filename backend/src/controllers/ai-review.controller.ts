import type { Request, Response } from 'express';
import { auditLog } from '../lib/audit.js';
import { childLogger } from '../lib/logger.js';
import * as aiReview from '../services/review/review.service.js';

/**
 * AI review suggestions. Students read and decide on the suggestions for their
 * own papers; admins re-run reviews and compare supervisor models.
 * Not to be confused with reviews.controller (human supervisor reviews).
 */

const log = childLogger('ai-review-controller');
const userOf = (req: Request) => (req as any).user?.id as string;
const adminOf = (req: Request) => ((req as any).admin?.id ?? userOf(req)) as string;
const param = (req: Request, name: string) => req.params[name] as string;

function handle(res: Response, err: unknown, fallback: string) {
  const status = (err as { status?: number })?.status;
  if (status && status < 500) return res.status(status).json({ error: (err as Error).message });
  log.error({ err: (err as Error)?.message }, fallback);
  return res.status(status ?? 500).json({ error: fallback });
}

function badIds(res: Response, ...ids: string[]) {
  if (ids.every(aiReview.isUuid)) return false;
  res.status(404).json({ error: 'Not found' });
  return true;
}

// ── Student ───────────────────────────────────────────────────────────────

export const getForPaper = async (req: Request, res: Response) => {
  const paperId = param(req, 'id');
  if (badIds(res, paperId)) return;
  try {
    res.json(await aiReview.getStudentReview(paperId, userOf(req)));
  } catch (err) {
    handle(res, err, 'Could not load the review suggestions');
  }
};

const ACCEPT_REPLIES: Record<aiReview.AcceptOutcome, [number, string]> = {
  accepted: [200, 'Suggestion applied to your paper.'],
  not_found: [404, 'Suggestion not found'],
  not_pending: [409, 'This suggestion was already accepted or rejected.'],
  stale: [409, 'That passage has changed since the review, so the suggestion was not applied.'],
  ambiguous: [409, 'That passage now appears more than once, so the suggestion was not applied.'],
};

export const accept = async (req: Request, res: Response) => {
  const paperId = param(req, 'id');
  const suggestionId = param(req, 'suggestionId');
  if (badIds(res, paperId, suggestionId)) return;
  try {
    const outcome = await aiReview.acceptSuggestion(paperId, suggestionId, userOf(req));
    const [status, message] = ACCEPT_REPLIES[outcome] ?? [500, 'Could not apply the suggestion'];
    if (status === 200) return res.json({ outcome, message });
    res.status(status).json({ outcome, error: message });
  } catch (err) {
    handle(res, err, 'Could not apply the suggestion');
  }
};

export const reject = async (req: Request, res: Response) => {
  const paperId = param(req, 'id');
  const suggestionId = param(req, 'suggestionId');
  if (badIds(res, paperId, suggestionId)) return;
  try {
    const outcome = await aiReview.rejectSuggestion(paperId, suggestionId, userOf(req));
    if (outcome === 'not_found') return res.status(404).json({ outcome, error: 'Suggestion not found' });
    if (outcome === 'not_pending') return res.status(409).json({ outcome, error: 'This suggestion was already accepted or rejected.' });
    res.json({ outcome });
  } catch (err) {
    handle(res, err, 'Could not reject the suggestion');
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────

/** Body { compare?: boolean }. compare runs the default and the compare supervisor side by side. */
export const adminStart = async (req: Request, res: Response) => {
  const paperId = param(req, 'id');
  if (badIds(res, paperId)) return;
  const compare = req.body?.compare === true;
  try {
    const started = await aiReview.startAdminReview(paperId, adminOf(req), compare);
    void auditLog({ event: 'ADMIN_ACTION', actorId: adminOf(req), targetType: 'paper', targetId: paperId, metadata: { action: compare ? 'ai_review_compare' : 'ai_review', runIds: started.runIds }, ip: req.ip });
    res.status(202).json(started);
  } catch (err) {
    handle(res, err, 'Could not start the review');
  }
};

export const adminForPaper = async (req: Request, res: Response) => {
  const paperId = param(req, 'id');
  if (badIds(res, paperId)) return;
  try {
    res.json({ runs: await aiReview.adminPaperReviews(paperId) });
  } catch (err) {
    handle(res, err, 'Could not load reviews');
  }
};

export const adminCompareList = async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
  try {
    res.json({ comparisons: await aiReview.adminCompareList(limit) });
  } catch (err) {
    handle(res, err, 'Could not load comparisons');
  }
};

export const adminCompareGroup = async (req: Request, res: Response) => {
  const group = param(req, 'group');
  if (badIds(res, group)) return;
  try {
    res.json(await aiReview.adminCompareGroup(group));
  } catch (err) {
    handle(res, err, 'Could not load the comparison');
  }
};
