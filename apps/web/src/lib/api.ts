import axios, { 
  AxiosInstance, 
  AxiosError, 
  InternalAxiosRequestConfig 
} from 'axios';

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const TIMEOUT_MS = 30_000;        // 30 seconds
const AI_TIMEOUT_MS = 120_000;    // 2 minutes (AI pipeline ke liye)

// ── Token Management ──────────────────────────────────────────────────────────
// Note: HttpOnly cookies use karna better hai for production
// Abhi ke liye sessionStorage use karo (XSS se thoda better than localStorage)

const TOKEN_KEY = 'mcap_token';

export const tokenManager = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    // sessionStorage use karo (tab close hone pe clear hota hai)
    return sessionStorage.getItem(TOKEN_KEY);
  },
  
  set: (token: string): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(TOKEN_KEY, token);
  },
  
  clear: (): void => {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(TOKEN_KEY);
    // Old localStorage token bhi clear karo
    localStorage.removeItem('mcap_token');
  },
};

// ── Axios Instance Factory ────────────────────────────────────────────────────

function createApiInstance(timeout: number = TIMEOUT_MS): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // ── Request Interceptor ───────────────────────────────────────────────────
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = tokenManager.get();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      // Request ID add karo (debugging ke liye)
      config.headers['X-Request-ID'] = 
        `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      return config;
    },
    (error) => Promise.reject(error)
  );

  // ── Response Interceptor ──────────────────────────────────────────────────
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const originalRequest = error.config as InternalAxiosRequestConfig & { 
        _retryCount?: number 
      };

      // 401 - Token expired ya invalid
      if (status === 401) {
        tokenManager.clear();
        if (typeof window !== 'undefined') {
          // Current path save karo redirect ke baad
          const returnTo = window.location.pathname;
          window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
        }
        return Promise.reject(error);
      }

      // 429 - Rate limit
      if (status === 429) {
        const retryAfter = error.response?.headers['retry-after'];
        return Promise.reject(
          new Error(`Rate limit exceeded. Retry after ${retryAfter || 60} seconds`)
        );
      }

      // 5xx - Server error, retry karo (max 2 baar)
      if (status && status >= 500 && status < 600) {
        originalRequest._retryCount = originalRequest._retryCount || 0;
        
        if (originalRequest._retryCount < 2) {
          originalRequest._retryCount++;
          const delay = 1000 * originalRequest._retryCount; // 1s, 2s
          await new Promise(resolve => setTimeout(resolve, delay));
          return instance(originalRequest);
        }
      }

      // Network error
      if (!error.response) {
        return Promise.reject(
          new Error('Network error. Check your internet connection.')
        );
      }

      // API error message extract karo
      const apiError = error.response.data as { error?: string; message?: string };
      const message = apiError?.error || apiError?.message || 'Something went wrong';
      
      return Promise.reject(new Error(message));
    }
  );

  return instance;
}

// ── Exported Instances ────────────────────────────────────────────────────────

// Default API client
const api = createApiInstance(TIMEOUT_MS);

// AI pipeline ke liye (zyada timeout)
export const aiApi = createApiInstance(AI_TIMEOUT_MS);

export default api;

// ── Type-safe API helpers ─────────────────────────────────────────────────────

export async function apiGet<T>(url: string, params?: object): Promise<T> {
  const response = await api.get<T>(url, { params });
  return response.data;
}

export async function apiPost<T>(url: string, data?: object): Promise<T> {
  const response = await api.post<T>(url, data);
  return response.data;
}

export async function apiPut<T>(url: string, data?: object): Promise<T> {
  const response = await api.put<T>(url, data);
  return response.data;
}

export async function apiPatch<T>(url: string, data?: object): Promise<T> {
  const response = await api.patch<T>(url, data);
  return response.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await api.delete<T>(url);
  return response.data;
}
