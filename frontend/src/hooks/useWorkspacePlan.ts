import { useEffect, useState } from 'react';
import { subscriptionService, type PlanLimits, type WorkspacePlan } from '../services/subscriptionService';

// Shown until the plan has loaded (and if it can't be): the Free plan's limits.
const FREE_LIMITS: PlanLimits = { documents: 2, sourcesPerDocument: 3, autocompletesPerDay: 10 };

/** The student's Workspace plan and what it includes. The API checks again on every call. */
export function useWorkspacePlan() {
  const [state, setState] = useState<{ plan: WorkspacePlan; limits: PlanLimits; loaded: boolean }>({
    plan: 'free',
    limits: FREE_LIMITS,
    loaded: false,
  });

  useEffect(() => {
    let cancelled = false;
    subscriptionService.getActive()
      .then(({ data }) => {
        if (!cancelled) setState({ plan: data.workspacePlan ?? 'free', limits: data.limits ?? FREE_LIMITS, loaded: true });
      })
      .catch(() => { if (!cancelled) setState((s) => ({ ...s, loaded: true })); });
    return () => { cancelled = true; };
  }, []);

  return state;
}
