export type PlanKey = 'paper' | 'standard' | 'premium';

const PLAN_KEYS: PlanKey[] = ['paper', 'standard', 'premium'];

export function parsePlan(value: string | null): PlanKey | null {
  return PLAN_KEYS.includes(value as PlanKey) ? (value as PlanKey) : null;
}

/** Where to send a user after sign-in, based on the plan they picked on the landing page. */
export function planDestination(plan: PlanKey | null): string {
  if (plan === 'paper') return '/new-paper/full';
  if (plan === 'standard' || plan === 'premium') return `/subscribe?plan=${plan}`;
  return '/dashboard';
}

export function withPlan(path: string, plan: PlanKey | null): string {
  return plan ? `${path}?plan=${plan}` : path;
}
