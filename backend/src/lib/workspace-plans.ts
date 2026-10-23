import { CONFIG } from '../config/index.js';

/**
 * What each Workspace plan includes. Free lets anyone try the Workspace before
 * paying: two documents, the quick AI edits, the checks that cost nothing to
 * run, citation search, a few sources and ten autocompletes a day. Its AI
 * spend is capped separately (CONFIG.AI_BUDGET.FREE_DAILY_USD).
 */
export type WorkspacePlan = 'free' | 'standard' | 'premium';

export interface PlanLimits {
  documents: number;
  sourcesPerDocument: number;
  autocompletesPerDay: number;
}

export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  free: { documents: 2, sourcesPerDocument: 3, autocompletesPerDay: 10 },
  standard: { documents: 5, sourcesPerDocument: 10, autocompletesPerDay: Infinity },
  premium: { documents: Infinity, sourcesPerDocument: 20, autocompletesPerDay: Infinity },
};

export const PLAN_NAMES: Record<WorkspacePlan, string> = { free: 'Free', standard: 'Standard', premium: 'Premium' };

/**
 * Coach answers a day. The coach only works on a study draft the student
 * bought, so it is prepaid on every plan (not counted toward the AI allowance);
 * this cap stops runaway use.
 */
export const COACH_ANSWERS_PER_DAY = 40;

/** Advanced checks open to the Free plan: they run without an AI model or search. */
export const FREE_CHECKS = new Set(['grammar', 'ai-detect', 'suggest-citations']);

/** The limits as JSON for the app: null means unlimited. */
export function limitsJson(plan: WorkspacePlan): Record<keyof PlanLimits, number | null> {
  const limits = PLAN_LIMITS[plan];
  const value = (n: number) => (Number.isFinite(n) ? n : null);
  return {
    documents: value(limits.documents),
    sourcesPerDocument: value(limits.sourcesPerDocument),
    autocompletesPerDay: value(limits.autocompletesPerDay),
  };
}

/**
 * Local development treats everyone as Premium. DEV_PLAN=free or DEV_PLAN=standard
 * tries the app as that plan instead. Null in production, where the real
 * subscription decides.
 */
export function devPlan(): WorkspacePlan | null {
  if (CONFIG.NODE_ENV === 'production') return null;
  const plan = process.env.DEV_PLAN;
  return plan === 'free' || plan === 'standard' ? plan : 'premium';
}

export const asPlan = (value: unknown): WorkspacePlan =>
  value === 'premium' ? 'premium' : value === 'standard' ? 'standard' : 'free';
