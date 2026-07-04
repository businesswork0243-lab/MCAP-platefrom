// apps/web/src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { tokenManager } from '@/lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:  60_000,      // 1 minute
      retry:      1,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Auth Initializer ─────────────────────────────────────────────────────────

function AuthInitializer() {
  const fetchMe    = useAuthStore(s => s.fetchMe)
  const user       = useAuthStore(s => s.user)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Sync token from sessionStorage
    const token = tokenManager.get()

    if (token) {
      // Token exists — verify it's still valid
      fetchMe()
    } else if (user) {
      // User in localStorage but no token
      // Try refresh (refresh token might be in sessionStorage)
      useAuthStore.getState().refreshToken().then(success => {
        if (success) fetchMe()
      })
    }
  }, [])

  return null
}

// ─── Providers ────────────────────────────────────────────────────────────────

export function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
    </QueryClientProvider>
  )
}
