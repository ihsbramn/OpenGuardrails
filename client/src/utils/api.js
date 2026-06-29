import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Enrich error with parsed fields
      error.friendlyMessage = data?.error || 'Something went wrong.';
      error.code = data?.code || 'UNKNOWN';
      error.fieldErrors = data?.details || [];
      error.help = data?.help || null;

      // Auto-redirect on auth failures
      if (status === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } else if (error.request) {
      error.friendlyMessage = 'Cannot reach the server. Check your network connection.';
      error.code = 'NETWORK_ERROR';
      error.fieldErrors = [{ field: 'connection', message: 'Server is unreachable — check if it is running' }];
    }
    return Promise.reject(error);
  }
);

export default api;
