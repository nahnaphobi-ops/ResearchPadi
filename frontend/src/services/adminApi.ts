import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

// Admin endpoints take the same token as the rest of the app; the API checks
// that the signed-in phone is on the admin list.
const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    } else if (status === 403) {
      window.location.href = '/dashboard';
    }
    return Promise.reject(error);
  }
);

export default adminApi;
