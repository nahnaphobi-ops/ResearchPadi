import api from './api';

export const subscriptionService = {
  subscribe: (plan: string) => api.post('/subscriptions/subscribe', { plan }),
  getActive: () => api.get('/subscriptions/active'),
  cancel: () => api.post('/subscriptions/cancel'),
};
