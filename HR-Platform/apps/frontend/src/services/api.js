import axios from 'axios';

/**
 * Axios Instance Configuration
 * Centralized API client with interceptors
 */

// Nisbiy manzil — so'rovlar nginx (prod) yoki Vite (dev) proxy orqali backendga boradi.
// Shu tufayli sayt qaysi manzildan ochilsa ham (localhost, LAN IP, domen) API ishlayveradi.
const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Appends the current access token as a `?token=` query parameter — for
 * URLs handed straight to `<img src>`/`<a href>` (employee photos, resumes,
 * fine/appeal evidence), which can't attach an Authorization header the
 * way axios requests do. The backend routes these hit now require auth
 * (see app.js) instead of being world-readable static files, and accept
 * this query-param form the same way the pre-existing EJM download route
 * already did — see auth.middleware.js#authenticateFromQuery.
 */
export function withAuthToken(url) {
  if (!url) return url;
  const token = localStorage.getItem('accessToken');
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies with requests
});

/**
 * Request Interceptor
 * Attaches access token to every request
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Every request that loads at once when a page mounts (dashboard stats,
 * lists, etc.) can hit a 401 in the same instant once the access token has
 * expired. Without the dedup below, each one independently POSTed
 * /auth/refresh — and now that the backend rotates+revokes refresh tokens
 * on every use (see auth.service.js#refreshAccessToken), only the FIRST
 * of those concurrent calls succeeds; every other one presents a token
 * the first call has already revoked and gets rejected as invalid,
 * logging the user out even though their session was perfectly valid a
 * moment ago. `refreshPromise` makes every 401 that arrives while a
 * refresh is already in flight await that same call instead of starting
 * its own.
 */
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => data.data.accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Response Interceptor
 * Handles token refresh and global error handling
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        localStorage.setItem('accessToken', accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
