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
    return localStorage.getItem(TOKEN_KEY);
  },
  
  set: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  },
};

// ── Token Refresh Queue ───────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

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
        _retryCount?: number;
        _retry?:      boolean;
      };
      const apiError = error.response?.data as { error?: string; code?: string; message?: string };

      // ── 401 Token Expired — Auto Refresh ─────────────────────────────────────
      if (
        status === 401 &&
        apiError?.code === 'TOKEN_EXPIRED' &&
        !originalRequest._retry
      ) {
        if (isRefreshing) {
          // Queue this request until refresh completes
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return instance(originalRequest);
          }).catch(err => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Import here to avoid circular dep
          const { useAuthStore } = await import('@/store/auth');
          const refreshed = await useAuthStore.getState().refreshToken();

          if (refreshed) {
            const newToken = tokenManager.get()!;
            processQueue(null, newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return instance(originalRequest);
          } else {
            processQueue(new Error('Refresh failed'));
            if (typeof window !== 'undefined') {
              window.location.href = '/login?reason=session_expired';
            }
            return Promise.reject(error);
          }
        } catch (refreshError) {
          processQueue(refreshError);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // ── Regular 401 — Not expired, just invalid ───────────────────────────────
      if (status === 401 && !originalRequest._retry) {
        tokenManager.clear();
        if (typeof window !== 'undefined') {
          const returnTo = window.location.pathname;
          window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
        }
        return Promise.reject(error);
      }

      // ── 429 - Rate limit
      if (status === 429) {
        const retryAfter = error.response?.headers['retry-after'];
        return Promise.reject(
          new Error(`Rate limit exceeded. Retry after ${retryAfter || 60} seconds`)
        );
      }

      // ── 5xx - Server error, retry karo (max 2 baar)
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
