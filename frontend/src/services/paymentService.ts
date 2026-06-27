import api from './api';

export const paymentService = {
  initiate: (amount: number, email: string) => api.post('/payments/initiate', { amount, email }),
  verify: (reference: string) => api.get(`/payments/verify/${reference}`),
  getWallet: () => api.get('/payments/wallet'),
  getHistory: () => api.get('/payments/history'),
};
