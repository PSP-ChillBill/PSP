import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const envApi = (import.meta.env.VITE_API_URL as string) || '';
const normalizedBase = envApi
  ? envApi.replace(/\/+$/, '') + (envApi.endsWith('/api') ? '' : '/api')
  : '/api';

const api = axios.create({
  baseURL: normalizedBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token from Zustand store
api.interceptors.request.use(
  (config) => {
    try {
      let token = useAuthStore.getState().token;

      // If the Zustand store hasn't rehydrated yet, fall back to persisted localStorage value
      if (!token && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            // persisted structure may be { token, user } or { state: { token, user } }
            token = parsed?.token ?? parsed?.state?.token ?? token;
          } catch (e) {
            // ignore parse errors
          }
        }
      }

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // noop
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        useAuthStore.getState().logout();
      } catch (e) {
        // fallback: remove legacy token
        localStorage.removeItem('token');
      }
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
