import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A sign-in token that has run out (or was revoked) ends the session cleanly: the protected
// pages then send the user to /login, instead of every page failing with errors.
api.interceptors.response.use(undefined, (error) => {
  const url = String(error?.config?.url ?? '');
  if (error?.response?.status === 401 && !url.includes('/auth/') && useAuthStore.getState().token) {
    useAuthStore.getState().logout();
  }
  return Promise.reject(error);
});

export default api;
