import type { Request, Response } from 'express';
import { auditLog } from '../lib/audit.js';
import { childLogger } from '../lib/logger.js';
import { ReviewError } from '../services/reviews/review.service.js';
import * as applications from '../services/reviews/application.service.js';
import { SPECIALTIES } from '../services/reviews/review-sources.js';

const log = childLogger('reviewer-applications-controller');
const userOf = (req: Request) => (req as any).user?.id as string;

function handle(res: Response, err: unknown, fallback: string) {
  if (err instanceof ReviewError) return res.status(err.status).json({ error: err.message });
  log.error({ err: (err as Error)?.message }, fallback);
  return res.status(500).json({ error: fallback });
}

// ── Applicant ─────────────────────────────────────────────────────────────

export const mine = async (req: Request, res: Response) => {
  try {
    res.json({ ...(await applications.myApplication(userOf(req))), specialties: SPECIALTIES });
  } catch (err) {
    handle(res, err, 'Could not load your application');
  }
};

export const apply = async (req: Request, res: Response) => {
  try {
    const application = await applications.submitApplication(userOf(req), req.body);
    void auditLog({ event: 'REVIEWER_APPLIED', actorId: userOf(req), targetType: 'reviewer_application', targetId: application.id, ip: req.ip });
    res.status(201).json({ application });
  } catch (err) {
    handle(res, err, 'Could not send your application');
  }
};

// ── Admin ─────────────────────────────────────────────────────────────────

export const adminList = async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({ applications: await applications.adminListApplications(status), specialties: SPECIALTIES });
  } catch (err) {
    handle(res, err, 'Could not load applications');
  }
};

const decide = (decision: 'approve' | 'reject') => async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await applications.decideApplication(userOf(req), id, decision, req.body?.notes, { specialties: req.body?.specialties });
    void auditLog({
      event: decision === 'approve' ? 'REVIEWER_APPROVED' : 'REVIEWER_REJECTED',
      actorId: userOf(req),
      targetType: 'reviewer_application',
      targetId: id,
      metadata: { applicant: result.userId },
      ip: req.ip,
    });
    res.json({ ok: true });
  } catch (err) {
    handle(res, err, 'Could not save the decision');
  }
};

export const adminApprove = decide('approve');
export const adminReject = decide('reject');
