import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase.js';

export const requireSubscription = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  // DEV OVERRIDE: skip subscription check
  if (process.env.NODE_ENV !== 'production') {
    (req as any).subscription = { plan: 'premium', status: 'active' };
    return next();
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  if (!data) return res.status(403).json({ error: 'Active subscription required. Please subscribe to use the workspace.' });

  (req as any).subscription = data;
  next();
};

export const enforceSessionLimit = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id;
  const subscription = (req as any).subscription;

  if (process.env.NODE_ENV !== 'production') return next();
  if (subscription?.plan === 'premium') return next();

  // Standard plan: max 5 active sessions
  const { count, error } = await supabase
    .from('workspace_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  if (count && count >= 5) {
    return res.status(403).json({ error: 'Standard plan limit reached (5 sessions). Upgrade to Premium for unlimited.' });
  }

  next();
};

/**
 * Premium-only features (inline AI, notebook sources, human review). Runs after
 * requireSubscription, which puts the active subscription on the request.
 */
export const requirePremium = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).subscription?.plan === 'premium') return next();
  return res.status(403).json({
    error: 'This is a Premium feature. Upgrade to Premium to use it.',
    code: 'PREMIUM_REQUIRED',
  });
};
