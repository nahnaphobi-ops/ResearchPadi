import api from './api';

/** Free is the Workspace without a subscription. */
export type WorkspacePlan = 'free' | 'standard' | 'premium';

/** What the plan includes; null means unlimited. */
export interface PlanLimits {
  documents: number | null;
  sourcesPerDocument: number | null;
  autocompletesPerDay: number | null;
}

export interface ActiveSubscription {
  subscription: { plan: string; status: string; expires_at: string } | null;
  isActive: boolean;
  workspacePlan: WorkspacePlan;
  limits: PlanLimits;
}

export const subscriptionService = {
  subscribe: (plan: string) => api.post('/subscriptions/subscribe', { plan }),
  getActive: () => api.get<ActiveSubscription>('/subscriptions/active'),
  cancel: () => api.post('/subscriptions/cancel'),
};
