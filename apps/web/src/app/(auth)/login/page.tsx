'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { tokenManager } from '@/lib/api';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const returnTo     = searchParams.get('returnTo') ?? '/dashboard';
  const reason       = searchParams.get('reason');

  const login     = useAuthStore(s => s.login);
  const isLoading = useAuthStore(s => s.isLoading);
  const user      = useAuthStore(s => s.user);

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [showPwd,  setShowPwd]  = useState(false);

  // Already logged in
  useEffect(() => {
    if (user && tokenManager.get()) {
      router.replace(returnTo);
    }
  }, [user, router, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.replace(returnTo);
    } catch (err) {
      // Store already extracts the message
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <>
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-xl font-bold">M</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-gray-500 text-sm mt-1">Sign in to M-CAP</p>
      </div>

      {/* Session expired notice */}
      {reason === 'session_expired' && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300 text-center">
          Your session expired. Please sign in again.
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 text-center"
          >
            {error}
          </motion.div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoComplete="email"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">Password</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors text-sm"
            >
              {showPwd ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Sign up free
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-sm"
    >
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </motion.div>
  );
}
