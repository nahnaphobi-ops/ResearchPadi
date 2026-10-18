import type { NextFunction, Request, Response } from 'express';
import { CONFIG } from '../config/index.js';
import { auditLog } from '../lib/audit.js';
import { childLogger } from '../lib/logger.js';
import * as reviews from '../services/reviews/review.service.js';
import { SOURCE_TYPES, SPECIALTIES, type SourceType } from '../services/reviews/review-sources.js';

const log = childLogger('reviews-controller');
const userOf = (req: Request) => (req as any).user?.id as string;
const param = (req: Request, name: string) => req.params[name] as string;

function handle(res: Response, err: unknown, fallback: string) {
  if (err instanceof reviews.ReviewError) return res.status(err.status).json({ error: err.message });
  log.error({ err: (err as Error)?.message }, fallback);
  return res.status(500).json({ error: fallback });
}

/** Only active reviewers reach the review desk. */
export async function requireReviewer(req: Request, res: Response, next: NextFunction) {
  if (await reviews.isActiveReviewer(userOf(req))) return next();
  return res.status(403).json({ error: 'Only approved reviewers can open the review desk.' });
}

// ── Student ───────────────────────────────────────────────────────────────

export const pricing = (_req: Request, res: Response) => {
  res.json({
    excerpt: reviews.priceFor('excerpt'),
    full: reviews.priceFor('full'),
    turnaroundHours: CONFIG.PRICING.REVIEW.TURNAROUND_HOURS,
    rubric: reviews.RUBRIC,
    specialties: SPECIALTIES,
  });
};

/** Chapters or sections a student can pick from when reviewing a paper or care study. */
export const sourceOptions = async (req: Request, res: Response) => {
  const sourceType = req.query.sourceType as SourceType;
  const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : '';
  if (!SOURCE_TYPES.includes(sourceType) || !sourceId) return res.status(400).json({ error: 'Choose a paper or a care study.' });
  try {
    res.json(await reviews.sourceOptions(userOf(req), sourceType, sourceId));
  } catch (err) {
    handle(res, err, 'Could not load the review options');
  }
};

export const create = async (req: Request, res: Response) => {
  const { sourceType = 'workspace', sessionId, sourceId, scope, excerptHtml, part, notes } = req.body ?? {};
  const hasSource = sourceType === 'workspace' ? typeof sessionId === 'string' : typeof sourceId === 'string';
  if (!SOURCE_TYPES.includes(sourceType) || !hasSource || (scope !== 'excerpt' && scope !== 'full')) {
    return res.status(400).json({ error: 'Choose what to have reviewed.' });
  }
  try {
    const request = await reviews.createRequest(userOf(req), {
      sourceType, sessionId, sourceId, scope, excerptHtml, part: typeof part === 'string' ? part : undefined, notes,
    });
    void auditLog({ event: 'REVIEW_REQUESTED', actorId: userOf(req), targetType: 'review', targetId: request.id, metadata: { scope, sourceType, price: request.price_ghs }, ip: req.ip });
    res.status(201).json({ request });
  } catch (err) {
    handle(res, err, 'Could not request the review');
  }
};

export const listMine = async (req: Request, res: Response) => {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    res.json({ requests: await reviews.listMine(userOf(req), sessionId) });
  } catch (err) {
    handle(res, err, 'Could not load your reviews');
  }
};

export const getMine = async (req: Request, res: Response) => {
  try {
    res.json({ request: await reviews.getMine(userOf(req), param(req, 'id')) });
  } catch (err) {
    handle(res, err, 'Could not load the review');
  }
};

export const cancelMine = async (req: Request, res: Response) => {
  try {
    await reviews.cancelMine(userOf(req), param(req, 'id'));
    void auditLog({ event: 'REVIEW_CANCELLED', actorId: userOf(req), targetType: 'review', targetId: param(req, 'id'), ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not cancel the review');
  }
};

export const setCommentStatus = async (req: Request, res: Response) => {
  try {
    await reviews.setCommentStatus(userOf(req), param(req, 'id'), param(req, 'commentId'), req.body?.status);
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not update the comment');
  }
};

// ── Reviewer ──────────────────────────────────────────────────────────────

export const queue = async (req: Request, res: Response) => {
  try {
    res.json(await reviews.reviewerQueue(userOf(req)));
  } catch (err) {
    handle(res, err, 'Could not load the queue');
  }
};

export const claim = async (req: Request, res: Response) => {
  try {
    await reviews.claim(userOf(req), param(req, 'id'));
    void auditLog({ event: 'REVIEW_CLAIMED', actorId: userOf(req), targetType: 'review', targetId: param(req, 'id'), ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not claim the request');
  }
};

export const release = async (req: Request, res: Response) => {
  try {
    await reviews.release(userOf(req), param(req, 'id'));
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not release the request');
  }
};

export const getForReviewer = async (req: Request, res: Response) => {
  try {
    const request = await reviews.getForReviewer(userOf(req), param(req, 'id'));
    // Every time a reviewer opens a student's work is logged.
    void auditLog({ event: 'REVIEW_VIEWED', actorId: userOf(req), targetType: 'review', targetId: param(req, 'id'), ip: req.ip });
    res.json({ request });
  } catch (err) {
    handle(res, err, 'Could not load the review');
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    res.status(201).json({ comment: await reviews.addComment(userOf(req), param(req, 'id'), req.body ?? {}) });
  } catch (err) {
    handle(res, err, 'Could not save the comment');
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  try {
    await reviews.deleteComment(userOf(req), param(req, 'id'), param(req, 'commentId'));
    res.status(204).end();
  } catch (err) {
    handle(res, err, 'Could not delete the comment');
  }
};

export const returnReview = async (req: Request, res: Response) => {
  try {
    await reviews.returnReview(userOf(req), param(req, 'id'), req.body ?? {});
    void auditLog({ event: 'REVIEW_RETURNED', actorId: userOf(req), targetType: 'review', targetId: param(req, 'id'), ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not return the review');
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────

export const adminList = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const [requests, reviewersList] = await Promise.all([reviews.adminList(status), reviews.adminReviewers()]);
    res.json({ requests, reviewers: reviewersList, reviewerShare: CONFIG.PRICING.REVIEW.REVIEWER_SHARE });
  } catch (err) {
    handle(res, err, 'Could not load reviews');
  }
};

export const adminAddReviewer = async (req: Request, res: Response) => {
  try {
    const { phone, displayName, bio, specialties } = req.body ?? {};
    await reviews.adminAddReviewer(String(phone ?? ''), String(displayName ?? ''), typeof bio === 'string' ? bio : undefined, userOf(req), specialties);
    void auditLog({ event: 'ADMIN_ACTION', actorId: userOf(req), targetType: 'reviewer', metadata: { action: 'add_reviewer' }, ip: req.ip });
    res.status(201).json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not add the reviewer');
  }
};

export const adminSetReviewerActive = async (req: Request, res: Response) => {
  try {
    await reviews.adminSetReviewerActive(param(req, 'userId'), Boolean(req.body?.active));
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not update the reviewer');
  }
};

export const adminSetReviewerSpecialties = async (req: Request, res: Response) => {
  try {
    await reviews.adminSetReviewerSpecialties(param(req, 'userId'), req.body?.specialties);
    void auditLog({ event: 'ADMIN_ACTION', actorId: userOf(req), targetType: 'reviewer', targetId: param(req, 'userId'), metadata: { action: 'set_specialties' }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not update the reviewer');
  }
};

export const adminAssign = async (req: Request, res: Response) => {
  try {
    const reviewerId = typeof req.body?.reviewerId === 'string' && req.body.reviewerId ? req.body.reviewerId : null;
    await reviews.adminAssign(param(req, 'id'), reviewerId);
    void auditLog({ event: 'ADMIN_ACTION', actorId: userOf(req), targetType: 'review', targetId: param(req, 'id'), metadata: { action: 'assign', reviewerId }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not assign the review');
  }
};

export const adminCancel = async (req: Request, res: Response) => {
  try {
    await reviews.adminCancel(param(req, 'id'));
    void auditLog({ event: 'ADMIN_ACTION', actorId: userOf(req), targetType: 'review', targetId: param(req, 'id'), metadata: { action: 'cancel_refund' }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not cancel the review');
  }
};
