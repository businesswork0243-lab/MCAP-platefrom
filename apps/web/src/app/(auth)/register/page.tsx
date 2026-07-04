'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { tokenManager } from '@/lib/api';

interface FormData {
  name:        string;
  email:       string;
  password:    string;
  companyName: string;
}

// Password strength checker
function getPasswordStrength(pwd: string): {
  score:  number;
  label:  string;
  color:  string;
} {
  let score = 0;
  if (pwd.length >= 8)          score++;
  if (pwd.length >= 12)         score++;
  if (/[A-Z]/.test(pwd))       score++;
  if (/[0-9]/.test(pwd))       score++;
  if (/[^A-Za-z0-9]/.test(pwd))score++;

  if (score <= 1) return { score, label: 'Weak',   color: 'bg-red-500'    };
  if (score <= 2) return { score, label: 'Fair',   color: 'bg-amber-500'  };
  if (score <= 3) return { score, label: 'Good',   color: 'bg-yellow-500' };
  if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500'  };
  return { score, label: 'Very Strong', color: 'bg-emerald-500' };
}

export default function RegisterPage() {
  const router   = useRouter();
  const register = useAuthStore(s => s.register);
  const isLoading = useAuthStore(s => s.isLoading);
  const user     = useAuthStore(s => s.user);

  const [form,   setForm]   = useState<FormData>({
    name: '', email: '', password: '', companyName: '',
  });
  const [error,   setError]   = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // Already logged in
  useEffect(() => {
    if (user && tokenManager.get()) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const update = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const pwdStrength = getPasswordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(form.password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(form.password)) {
      setError('Password must contain at least one number');
      return;
    }

    try {
      await register(form);
      router.replace('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-sm"
    >
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-xl font-bold">M</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Create your account</h1>
        <p className="text-gray-500 text-sm mt-1">
          Start generating content with AI
        </p>
      </div>

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

        {/* Name + Company */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Full Name</label>
            <input
              value={form.name}
              onChange={update('name')}
              placeholder="Jane Smith"
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-300">Company</label>
            <input
              value={form.companyName}
              onChange={update('companyName')}
              placeholder="Acme Inc."
              required
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@company.com"
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">Password</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={form.password}
              onChange={update('password')}
              placeholder="••••••••"
              required
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

          {/* Password strength visual indicator */}
          {form.password && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Password Strength</span>
                <span className="text-gray-400 font-medium">{pwdStrength.label}</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 rounded-full transition-colors ${
                      i < pwdStrength.score ? pwdStrength.color : 'bg-white/5'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !form.email || !form.password || !form.name || !form.companyName}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
