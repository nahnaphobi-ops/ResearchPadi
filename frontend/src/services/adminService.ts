import adminApi from './adminApi';

export const adminService = {
  login: async (email: string, password: string) => {
    const res = await adminApi.post('/admin/login', { email, password });
    return res.data;
  },

  verifyOtp: async (adminId: string, otp: string) => {
    const res = await adminApi.post('/admin/verify-otp', { admin_id: adminId, otp });
    return res.data;
  },

  refreshToken: async (refreshToken: string) => {
    const res = await adminApi.post('/admin/refresh-token', { refreshToken });
    return res.data;
  },

  logout: async () => {
    const res = await adminApi.post('/admin/logout');
    return res.data;
  },

  getOverview: async () => {
    const res = await adminApi.get('/admin/overview');
    return res.data;
  },

  getUsers: async (params?: { search?: string; institution_type?: string; page?: number; limit?: number }) => {
    const res = await adminApi.get('/admin/users', { params });
    return res.data;
  },

  getUserDetail: async (id: string) => {
    const res = await adminApi.get(`/admin/users/${id}`);
    return res.data;
  },

  getTransactions: async (params?: { status?: string; type?: string; page?: number; limit?: number }) => {
    const res = await adminApi.get('/admin/transactions', { params });
    return res.data;
  },

  getSubscriptions: async () => {
    const res = await adminApi.get('/admin/subscriptions');
    return res.data;
  },

  getPapers: async (params?: { status?: string; page?: number; limit?: number }) => {
    const res = await adminApi.get('/admin/papers', { params });
    return res.data;
  },

  getWorkspaces: async () => {
    const res = await adminApi.get('/admin/workspaces');
    return res.data;
  },

  getKnowledgeBase: async () => {
    const res = await adminApi.get('/admin/knowledge-base');
    return res.data;
  },
};
