import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase.js';
import { PLAN_LIMITS, PLAN_NAMES, asPlan, devPlan, type WorkspacePlan } from '../lib/workspace-plans.js';

/** The user's active paid subscription, or null (Free). In development, DEV_PLAN decides. */
async function activeSubscription(userId: string): Promise<{ data: any; error?: string }> {
  const dev = devPlan();
  if (dev) return { data: dev === 'free' ? null : { plan: dev, status: 'active' } };

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') return { data: null, error: error.message };
  return { data };
}

export const requireSubscription = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await activeSubscription(userId);
  if (error) return res.status(500).json({ error });
  if (!data) return res.status(403).json({ error: 'Active subscription required. Please subscribe to use the workspace.' });

  (req as any).subscription = data;
  next();
};

/**
 * Puts the user's Workspace plan on the request (req.plan), with the active
 * subscription if there is one. Everyone gets in: without a subscription the
 * plan is Free.
 */
export const attachPlan = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await activeSubscription(userId);
  if (error) return res.status(500).json({ error });

  (req as any).subscription = data;
  (req as any).plan = data ? asPlan(data.plan) : 'free';
  next();
};

export const planOf = (req: Request): WorkspacePlan => (req as any).plan ?? asPlan((req as any).subscription?.plan);

/** The answer when a Free user asks for a paid feature. */
export function paidPlanRequired(res: Response) {
  return res.status(403).json({
    error: 'This is part of the Standard and Premium plans. Upgrade to use it.',
    code: 'PLAN_REQUIRED',
  });
}

/** Standard or Premium features. Runs after attachPlan. */
export const requirePaidPlan = (req: Request, res: Response, next: NextFunction) => {
  if (planOf(req) !== 'free') return next();
  return paidPlanRequired(res);
};

/** Why this user can't open another document on their plan, or null if they can. */
export async function documentLimitError(userId: string, plan: WorkspacePlan): Promise<string | null> {
  const limit = PLAN_LIMITS[plan].documents;
  if (!Number.isFinite(limit)) return null;

  const { count, error } = await supabase
    .from('workspace_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) < limit) return null;
  return plan === 'free'
    ? `The Free plan holds ${limit} documents. Delete one, or upgrade to Standard or Premium for more.`
    : `${PLAN_NAMES[plan]} plan limit reached (${limit} documents). Upgrade to Premium for unlimited.`;
}

export const enforceSessionLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const message = await documentLimitError((req as any).user?.id, planOf(req));
    if (message) return res.status(403).json({ error: message, code: 'PLAN_LIMIT' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
  next();
};

/**
 * Premium-only features (inline AI, chat with sources, human review). Runs after
 * requireSubscription or attachPlan, which put the active subscription on the request.
 */
export const requirePremium = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).subscription?.plan === 'premium') return next();
  return res.status(403).json({
    error: 'This is a Premium feature. Upgrade to Premium to use it.',
    code: 'PREMIUM_REQUIRED',
  });
};
