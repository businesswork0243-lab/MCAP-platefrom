'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import api from '@/lib/api';

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token');

  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [showPwd,      setShowPwd]      = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid reset link');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain an uppercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain a number');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      setSuccess(true);
      setTimeout(() => router.replace('/login?reason=password_reset'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full max-w-[400px] text-center space-y-4">
        <div className="w-14 h-14 bg-red-500/20 border-2 border-red-500/40 rounded-full flex items-center justify-center mx-auto">
          <span className="text-2xl">✗</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Invalid Reset Link</h1>
        <p className="text-sm text-gray-500">
          This link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-all"
        >
          Request New Link →
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[400px]"
    >
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-violet-600/30">
          <span className="text-white text-2xl font-bold">M</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">
          {success ? 'Password Reset!' : 'Set new password'}
        </h1>
        <p className="text-gray-500 text-sm text-center">
          {success
            ? 'Redirecting to sign in...'
            : 'Choose a strong password for your account'
          }
        </p>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-sm">

        {success ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-white font-medium">Password updated</p>
            <p className="text-sm text-gray-500 mt-1">
              You can now sign in with your new password
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
                >
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">
                Confirm Password
              </label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                required
                autoComplete="new-password"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-all text-sm"
              />
              {confirm && password !== confirm && (
                <p className="text-xs text-red-400">Passwords don&apos;t match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link
          href="/login"
          className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
        >
          ← Back to Sign In
        </Link>
      </p>
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-[400px] text-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
