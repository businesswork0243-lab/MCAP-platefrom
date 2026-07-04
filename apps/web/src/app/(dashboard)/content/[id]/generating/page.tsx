'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useContentSocket } from '@/hooks/useContentSocket';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ─── Progress Step Config ─────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { min: 0,  max: 15,  label: 'Initializing pipeline',    icon: '⚙️' },
  { min: 15, max: 30,  label: 'Fetching brand context',   icon: '🏢' },
  { min: 30, max: 50,  label: 'Writing canonical draft',  icon: '✍️' },
  { min: 50, max: 65,  label: 'Platform optimization',    icon: '📱' },
  { min: 65, max: 75,  label: 'Brand alignment',          icon: '🎯' },
  { min: 75, max: 85,  label: 'Humanizing content',       icon: '✦'  },
  { min: 85, max: 95,  label: 'Quality assurance',        icon: '✓'  },
  { min: 95, max: 100, label: 'Saving results',           icon: '💾' },
];

function getCurrentStep(progress: number) {
  return PROGRESS_STEPS.find(s => progress >= s.min && progress < s.max)
    ?? PROGRESS_STEPS[PROGRESS_STEPS.length - 1];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeneratingPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [progress, setProgress]   = useState(0);
  const [step, setStep]           = useState(PROGRESS_STEPS[0]);
  const [status, setStatus]       = useState<'running' | 'done' | 'failed'>('running');
  const [failReason, setFailReason] = useState('');

  // Poll DB status as fallback (if WebSocket misses events)
  const { data } = useQuery({
    queryKey: ['content-generating', id],
    queryFn:  () => api.get(`/content/jobs/${id}`).then(r => r.data),
    refetchInterval: (data) => {
      const s = (data as { request?: { status: string } })?.request?.status;
      if (['approved', 'awaiting_review', 'generation_failed'].includes(s ?? '')) {
        return false; // Stop polling
      }
      return 5_000; // Poll every 5s
    },
    enabled: status === 'running',
  });

  // Check if already done from DB
  useEffect(() => {
    const s = data?.request?.status;
    if (s === 'approved' || s === 'awaiting_review') {
      setProgress(100);
      setStatus('done');
      setTimeout(() => router.replace(`/content/${id}`), 1_500);
    } else if (s === 'generation_failed') {
      setStatus('failed');
      setFailReason('Generation failed. Please try again.');
    }
  }, [data, id, router]);

  // WebSocket for real-time updates
  useContentSocket({
    requestId: id,
    enabled:   status === 'running',

    onProgress: ({ progress: p, step: stepLabel }) => {
      setProgress(p);
      setStep(getCurrentStep(p));
    },

    onCompleted: () => {
      setProgress(100);
      setStatus('done');
      setTimeout(() => router.replace(`/content/${id}`), 1_500);
    },

    onFailed: ({ reason }) => {
      setStatus('failed');
      setFailReason(reason || 'Generation failed');
    },
  });

  const currentStep = getCurrentStep(progress);

  return (
    <div className="min-h-screen bg-[#080809] flex flex-col items-center justify-center gap-10 p-6">

      {/* ── Status Icon ── */}
      <AnimatePresence mode="wait">
        {status === 'running' && (
          <motion.div
            key="running"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative"
          >
            {/* Outer ring */}
            <div className="w-24 h-24 rounded-full border-2 border-violet-500/20 flex items-center justify-center">
              {/* Spinning ring */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
              {/* Icon */}
              <span className="text-3xl">{currentStep.icon}</span>
            </div>
          </motion.div>
        )}

        {status === 'done' && (
          <motion.div
            key="done"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
          >
            <span className="text-4xl">✓</span>
          </motion.div>
        )}

        {status === 'failed' && (
          <motion.div
            key="failed"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center"
          >
            <span className="text-4xl">✗</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Title ── */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.h2
            key={status}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-xl font-semibold text-white"
          >
            {status === 'running' ? 'Generating Content'  :
             status === 'done'    ? 'Content Ready!'       :
             'Generation Failed'}
          </motion.h2>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.p
            key={currentStep.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-gray-500 mt-2"
          >
            {status === 'running' ? currentStep.label :
             status === 'done'    ? 'Redirecting to your content...' :
             failReason}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── Progress Bar ── */}
      {status === 'running' && (
        <div className="w-full max-w-sm space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Progress</span>
            <span className="text-violet-400 font-medium">{progress}%</span>
          </div>

          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>

          {/* Step pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {PROGRESS_STEPS.map((s, i) => {
              const done    = progress >= s.max;
              const current = progress >= s.min && progress < s.max;
              return (
                <div
                  key={i}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                    border transition-all duration-300
                    ${done
                      ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                      : current
                      ? 'bg-violet-600/30 border-violet-500/50 text-white'
                      : 'bg-white/3 border-white/8 text-gray-600'
                    }
                  `}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                  {done && <span className="text-violet-400">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Failed Actions ── */}
      {status === 'failed' && (
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm text-gray-400 border border-white/10 rounded-xl hover:border-white/20 transition-all"
          >
            ← Go Back
          </button>
          <button
            onClick={() => router.replace(`/content/${id}`)}
            className="px-5 py-2.5 text-sm text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-all"
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
