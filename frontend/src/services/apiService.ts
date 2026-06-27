import api from './api';

export const authService = {
  requestOtp: (phone: string) => api.post('/auth/request-otp', { phone }),
  verifyOtp: (phone: string, otp: string) => api.post('/auth/verify-otp', { phone, otp }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
};

export const paperService = {
  refineTopic: (data: { topic: string; course?: string; institution_type?: string }) =>
    api.post('/papers/refine-topic', data),
  generateQuestions: (data: { topic: string; course?: string; institution_type?: string }) =>
    api.post('/papers/generate-questions', data),
  submitFullPaper: (data: any) => api.post('/papers/full', data),
  listPapers: () => api.get('/papers'),
  getPaperDetails: (id: string) => api.get(`/papers/${id}`),
  supervisePaper: (id: string) => api.post(`/papers/${id}/supervise`),
  acceptSupervision: (id: string, supervised: string) => api.post(`/papers/${id}/accept-review`, { supervised }),
  downloadDocx: (id: string, topic: string) => 
    api.get(`/papers/${id}/download`, { responseType: 'blob' }).then(response => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${topic.replace(/\s+/g, '_')}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }),
  deletePaper: (id: string) => api.delete(`/papers/${id}`),
};
