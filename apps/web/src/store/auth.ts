// apps/web/src/store/auth.ts
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import api, { tokenManager } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  id:               string;
  name:             string;
  email:            string;
  role:             string;
  organizationId:   string;
  organizationName: string;
}

interface AuthState {
  user:      User | null;
  token:     string | null;
  isLoading: boolean;
  error:     string | null;

  // Actions
  login:        (email: string, password: string) => Promise<void>;
  register:     (data: RegisterData) => Promise<void>;
  logout:       () => Promise<void>;
  fetchMe:      () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError:   () => void;
}

interface RegisterData {
  name:        string;
  email:       string;
  password:    string;
  companyName: string;
}

interface AuthResponse {
  accessToken:  string;
  refreshToken: string;
  token:        string; // backward compat
  user:         User;
}

// ─── Token Storage Keys ───────────────────────────────────────────────────────
// Note: HttpOnly cookies would be ideal for production
// Using sessionStorage for access token (cleared on tab close)
// Refresh token in memory only (most secure without HttpOnly cookies)

const REFRESH_TOKEN_KEY = 'mcap_refresh_token'

const refreshTokenStorage = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(REFRESH_TOKEN_KEY)
  },
  set: (token: string): void => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  },
  clear: (): void => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    // Also clear old localStorage tokens
    localStorage.removeItem('mcap_token')
    localStorage.removeItem('mcap_refresh_token')
  },
}

// ─── Auth Store ───────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user:      null,
      token:     null,
      isLoading: false,
      error:     null,

      clearError: () => set({ error: null }),

      // ── Login ───────────────────────────────────────────────────────────────
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })

        try {
          const { data } = await api.post<AuthResponse>('/auth/login', {
            email,
            password,
          })

          // Store tokens
          tokenManager.set(data.accessToken || data.token)
          refreshTokenStorage.set(data.refreshToken)

          set({
            user:      data.user,
            token:     data.accessToken || data.token,
            isLoading: false,
            error:     null,
          })

        } catch (err) {
          const message = err instanceof Error
            ? err.message
            : 'Login failed. Check your credentials.'

          set({ isLoading: false, error: message, user: null, token: null })
          throw err // Re-throw so UI can handle
        }
      },

      // ── Register ─────────────────────────────────────────────────────────────
      register: async (formData: RegisterData) => {
        set({ isLoading: true, error: null })

        try {
          const { data } = await api.post<AuthResponse>('/auth/register', formData)

          tokenManager.set(data.accessToken || data.token)
          refreshTokenStorage.set(data.refreshToken)

          set({
            user:      data.user,
            token:     data.accessToken || data.token,
            isLoading: false,
            error:     null,
          })

        } catch (err) {
          const message = err instanceof Error
            ? err.message
            : 'Registration failed'

          set({ isLoading: false, error: message })
          throw err
        }
      },

      // ── Logout ───────────────────────────────────────────────────────────────
      logout: async () => {
        try {
          // Tell server to invalidate refresh token
          await api.post('/auth/logout')
        } catch {
          // Even if server call fails, clear local state
        } finally {
          tokenManager.clear()
          refreshTokenStorage.clear()
          set({ user: null, token: null, error: null })
        }
      },

      // ── Fetch Me ──────────────────────────────────────────────────────────────
      fetchMe: async () => {
        // No token = skip
        const currentToken = tokenManager.get()
        if (!currentToken) return

        try {
          const { data } = await api.get<User>('/auth/me')
          set({ user: data })

        } catch (err: unknown) {
          const errObj = err as { message?: string }

          // TOKEN_EXPIRED — try refresh
          if (errObj?.message?.includes('TOKEN_EXPIRED') ||
              errObj?.message?.includes('expired')) {
            const refreshed = await get().refreshToken()
            if (refreshed) {
              // Retry fetchMe after refresh
              const { data } = await api.get<User>('/auth/me')
              set({ user: data })
              return
            }
          }

          // Any other error — clear auth state
          tokenManager.clear()
          refreshTokenStorage.clear()
          set({ user: null, token: null })
        }
      },

      // ── Refresh Token ─────────────────────────────────────────────────────────
      refreshToken: async (): Promise<boolean> => {
        const storedRefreshToken = refreshTokenStorage.get()

        if (!storedRefreshToken) {
          set({ user: null, token: null })
          return false
        }

        try {
          const { data } = await api.post<AuthResponse>('/auth/refresh', {
            refreshToken: storedRefreshToken,
          })

          // Update tokens
          tokenManager.set(data.accessToken || data.token)
          refreshTokenStorage.set(data.refreshToken)

          set({
            user:  data.user,
            token: data.accessToken || data.token,
          })

          return true

        } catch {
          // Refresh failed — full logout
          tokenManager.clear()
          refreshTokenStorage.clear()
          set({ user: null, token: null })
          return false
        }
      },
    }),

    {
      name:    'mcap-auth',
      storage: createJSONStorage(() => ({
        // Custom storage — only persist user (not token)
        // Tokens are in sessionStorage, user info in localStorage for UX
        getItem: (key: string) => {
          if (typeof window === 'undefined') return null
          return localStorage.getItem(key)
        },
        setItem: (key: string, value: string) => {
          if (typeof window === 'undefined') return
          localStorage.setItem(key, value)
        },
        removeItem: (key: string) => {
          if (typeof window === 'undefined') return
          localStorage.removeItem(key)
        },
      })),
      // Only persist user info, NOT tokens
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
)
