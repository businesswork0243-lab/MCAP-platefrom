'use client';

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosInstance } from 'axios';

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mcap-api.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const aiApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180_000, // 3 minutes timeout for AI processes
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Token Management ──────────────────────────────────────────────────────────

const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const tokenManager = {
  get: getAccessToken,
  set: setTokens,
  clear: clearTokens,
};

// ── Refresh Token Queue (prevent multiple simultaneous refreshes) ─────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// ── Setup Interceptors Helper ─────────────────────────────────────────────────

function registerInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // Not 401 → just reject
      if (error.response?.status !== 401 || !originalRequest) {
        return Promise.reject(error);
      }

      // Auth endpoints → don't try to refresh
      if (originalRequest.url?.includes('/auth/login') ||
          originalRequest.url?.includes('/auth/register') ||
          originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      // Already retried → reject
      if (originalRequest._retry) {
        clearTokens();
        redirectToLogin();
        return Promise.reject(error);
      }

      const refreshToken = getRefreshToken();

      // No refresh token → redirect to login
      if (!refreshToken) {
        clearTokens();
        redirectToLogin();
        return Promise.reject(error);
      }

      // Wait if refresh already in progress
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(instance(originalRequest));
          });
        });
      }

      // Start refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('🔄 Refreshing access token...');

        const { data } = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          {
            timeout: 15_000,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const newAccessToken = data.accessToken || data.token;
        const newRefreshToken = data.refreshToken;

        if (!newAccessToken) {
          throw new Error('No access token in refresh response');
        }

        setTokens(newAccessToken, newRefreshToken);
        isRefreshing = false;
        onTokenRefreshed(newAccessToken);

        console.log('✅ Token refreshed');

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return instance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        clearTokens();

        console.error('❌ Refresh failed:', refreshError);
        redirectToLogin();

        return Promise.reject(refreshError);
      }
    }
  );
}

// Register interceptors for both instances
registerInterceptors(api);
registerInterceptors(aiApi);

// ── Redirect Helper ───────────────────────────────────────────────────────────

function redirectToLogin() {
  if (typeof window === 'undefined') return;

  // Don't redirect if already on login page
  const currentPath = window.location.pathname;
  if (currentPath.includes('/login') || currentPath.includes('/register')) {
    return;
  }

  // Store current path for redirect after login
  sessionStorage.setItem('redirectAfterLogin', currentPath);
  window.location.href = '/login';
}

// ── Exports ───────────────────────────────────────────────────────────────────

export default api;
export { api, aiApi, getAccessToken, getRefreshToken, setTokens, clearTokens };
