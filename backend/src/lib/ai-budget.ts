import { supabase } from '../db/supabase.js';
import { CONFIG } from '../config/index.js';
import { childLogger } from './logger.js';
import { getReadyRedis } from './redis.js';
import { devPlan } from './workspace-plans.js';

const log = childLogger('ai-budget');

/** Thrown when a user has used up today's AI allowance; controllers answer 429. */
export class AiBudgetError extends Error {
  status = 429;
  constructor(public limitUsd: number) {
    super("You've reached today's AI limit for your plan. It resets at midnight (GMT).");
  }
}

export type BudgetPlan = 'free' | 'standard' | 'premium';

const PLAN_TTL_MS = 5 * 60_000;
const planCache = new Map<string, { plan: BudgetPlan; expires: number }>();

// Spend is kept in micro-dollars so Redis can use integer INCRBY.
const MICRO = 1_000_000;
// Without Redis (single instance): today's spend per user, seeded from the DB once.
const memorySpend = new Map<string, number>();

const today = () => new Date().toISOString().slice(0, 10);
const spendKey = (userId: string) => `aispend:${userId}:${today()}`;

export function dailyLimitUsd(plan: BudgetPlan): number {
  if (plan === 'premium') return CONFIG.AI_BUDGET.PREMIUM_DAILY_USD;
  if (plan === 'standard') return CONFIG.AI_BUDGET.STANDARD_DAILY_USD;
  return CONFIG.AI_BUDGET.FREE_DAILY_USD;
}

export async function planFor(userId: string): Promise<BudgetPlan> {
  // Local development: everyone is premium unless DEV_PLAN says otherwise, like the subscription middleware.
  const dev = devPlan();
  if (dev) return dev;

  const cached = planCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.plan;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) log.warn({ err: error.message }, 'Plan lookup failed; using the free allowance');
  const plan: BudgetPlan = data?.plan === 'premium' ? 'premium' : data?.plan === 'standard' ? 'standard' : 'free';
  planCache.set(userId, { plan, expires: Date.now() + PLAN_TTL_MS });
  return plan;
}

async function spentTodayMicro(userId: string): Promise<number> {
  const redis = getReadyRedis();
  if (redis) {
    try {
      return parseInt((await redis.get(spendKey(userId))) || '0', 10);
    } catch {
      // fall through to memory
    }
  }

  const key = spendKey(userId);
  const known = memorySpend.get(key);
  if (known !== undefined) return known;

  // First check today on this instance: start from what the usage log already has.
  let seeded = 0;
  try {
    const { data } = await supabase
      .from('ai_usage_logs')
      .select('cost_usd')
      .eq('user_id', userId)
      .gte('created_at', `${today()}T00:00:00Z`);
    seeded = Math.round((data ?? []).reduce((sum, r) => sum + Number(r.cost_usd || 0), 0) * MICRO);
  } catch (err: any) {
    log.warn({ err: err?.message }, 'Could not read today\'s AI spend; starting from zero');
  }
  memorySpend.set(key, seeded);
  return seeded;
}

export async function getBudget(userId: string) {
  const plan = await planFor(userId);
  const limitUsd = dailyLimitUsd(plan);
  const spentUsd = (await spentTodayMicro(userId)) / MICRO;
  const resetAt = new Date(`${today()}T00:00:00Z`).getTime() + 86_400_000;
  return { plan, limitUsd, spentUsd, remainingUsd: Math.max(0, limitUsd - spentUsd), resetAt };
}

/** Throws AiBudgetError when the user has no allowance left today. */
export async function assertBudget(userId: string | undefined): Promise<void> {
  if (!userId) return; // system jobs (prepaid papers) are not metered here
  const { remainingUsd, limitUsd } = await getBudget(userId);
  if (remainingUsd <= 0) throw new AiBudgetError(limitUsd);
}

export async function recordSpend(userId: string | undefined, usd: number): Promise<void> {
  if (!userId || !(usd > 0)) return;
  const micro = Math.round(usd * MICRO);
  const redis = getReadyRedis();
  if (redis) {
    try {
      const key = spendKey(userId);
      await redis.pipeline().incrby(key, micro).pexpire(key, 2 * 86_400_000).exec();
      return;
    } catch {
      // fall through to memory
    }
  }
  const key = spendKey(userId);
  memorySpend.set(key, (await spentTodayMicro(userId)) + micro);
  if (memorySpend.size > 10_000) {
    // Drop previous days' entries.
    const suffix = `:${today()}`;
    for (const k of memorySpend.keys()) if (!k.endsWith(suffix)) memorySpend.delete(k);
  }
}
