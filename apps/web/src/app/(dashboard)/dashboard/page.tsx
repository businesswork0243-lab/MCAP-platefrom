'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { formatRelative, formatDuration, formatNumber } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentStats {
  total_requests:         string;
  approved:               string;
  published:              string;
  avg_completion_seconds: string | null;
}

interface ContentRequest {
  id:              string;
  topic:           string;
  status:          string;
  target_platform: string;
  created_at:      string;
  platforms:       string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  approved:        { label: 'Ready',        color: 'text-green-400 bg-green-500/15 border-green-500/30'  },
  published:       { label: 'Published',    color: 'text-blue-400 bg-blue-500/15 border-blue-500/30'    },
  awaiting_review: { label: 'Review',       color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' },
  running:         { label: 'Generating',   color: 'text-violet-400 bg-violet-500/15 border-violet-500/30'},
  queued:          { label: 'Queued',       color: 'text-gray-400 bg-gray-500/15 border-gray-500/30'    },
  generation_failed: { label: 'Failed',     color: 'text-red-400 bg-red-500/15 border-red-500/30'      },
};

const PLATFORM_ICONS: Record<string, string> = {
  linkedin_post:     '💼',
  linkedin_article:  '📰',
  twitter_thread:    '🐦',
  x_thread:         '🐦',
  blog_post:        '✍️',
  newsletter:       '📧',
  instagram_caption:'📸',
  youtube_script:   '🎬',
};

// ─── Sub Components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string | number | null | undefined;
  icon:  string;
  color: string;
  sub?:  string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 bg-white/3 border border-white/10 rounded-2xl hover:border-white/15 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {value !== null && value !== undefined ? value : '—'}
          </p>
          {sub && (
            <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <span className="text-lg">{icon}</span>
        </div>
      </div>
    </motion.div>
  );
}

function RecentContentRow({ item }: { item: ContentRequest }) {
  const status  = STATUS_CONFIG[item.status] ?? {
    label: item.status.replace(/_/g, ' '),
    color: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  };

  const platforms: string[] = (() => {
    if (Array.isArray(item.platforms)) return item.platforms;
    try { return JSON.parse(item.platforms as unknown as string); } catch { return []; }
  })();

  return (
    <Link
      href={`/content/${item.id}`}
      className="flex items-center gap-4 py-3.5 px-4 rounded-xl hover:bg-white/5 transition-all group"
    >
      {/* Platform icons */}
      <div className="flex -space-x-1 shrink-0">
        {platforms.slice(0, 3).map((p, i) => (
          <span key={i} className="text-sm" title={p}>
            {PLATFORM_ICONS[p] ?? '📄'}
          </span>
        ))}
        {platforms.length > 3 && (
          <span className="text-xs text-gray-600">+{platforms.length - 3}</span>
        )}
      </div>

      {/* Topic */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">
          {item.topic}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          {formatRelative(item.created_at)}
        </p>
      </div>

      {/* Status */}
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${status.color}`}>
        {status.label}
      </span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">✦</div>
      <h3 className="text-white font-medium">No content yet</h3>
      <p className="text-gray-500 text-sm mt-1 mb-6">
        Create your first content piece to get started
      </p>
      <Link
        href="/content/new"
        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-all"
      >
        Create Content →
      </Link>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="p-5 bg-white/3 border border-white/10 rounded-2xl animate-pulse">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-white/10 rounded" />
          <div className="h-7 w-12 bg-white/10 rounded" />
        </div>
        <div className="w-10 h-10 bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn:  () => api.get('/analytics/overview').then(r => r.data),
    staleTime: 2 * 60 * 1000, // 2 min
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['recent-content'],
    queryFn:  () => api.get('/content?limit=8').then(r => r.data),
    staleTime: 30 * 1000, // 30 sec
  });

  const stats: ContentStats | undefined = overview?.content;
  const recent: ContentRequest[]        = recentData?.requests ?? [];

  // Greeting based on time
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // Computed stats
  const avgTime = stats?.avg_completion_seconds
    ? formatDuration(parseInt(stats.avg_completion_seconds))
    : null;

  const approvalRate = stats?.total_requests && parseInt(stats.total_requests) > 0
    ? Math.round((parseInt(stats.approved) / parseInt(stats.total_requests)) * 100)
    : null;

  return (
    <div className="min-h-screen bg-[#080809] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {user?.organizationName && (
                <span className="text-gray-600">{user.organizationName} · </span>
              )}
              Last 30 days
            </p>
          </div>
          <Link
            href="/content/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20"
          >
            <span>✦</span>
            New Content
          </Link>
        </motion.div>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                label="Total Generated"
                value={stats?.total_requests ? formatNumber(parseInt(stats.total_requests)) : null}
                icon="✦"
                color="bg-violet-500/20"
              />
              <StatCard
                label="Approved"
                value={stats?.approved ? formatNumber(parseInt(stats.approved)) : null}
                icon="✓"
                color="bg-green-500/20"
                sub={approvalRate !== null ? `${approvalRate}% approval rate` : undefined}
              />
              <StatCard
                label="Published"
                value={stats?.published ? formatNumber(parseInt(stats.published)) : null}
                icon="↗"
                color="bg-blue-500/20"
              />
              <StatCard
                label="Avg. Time"
                value={avgTime}
                icon="⏱"
                color="bg-amber-500/20"
                sub="per generation"
              />
            </>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                href:  '/content/new',
                icon:  '✦',
                label: 'New Content',
                desc:  'Start generating',
                color: 'border-violet-500/30 hover:bg-violet-500/10',
              },
              {
                href:  '/brand',
                icon:  '◉',
                label: 'Brand Profiles',
                desc:  'Manage voice & ICPs',
                color: 'border-white/10 hover:bg-white/5',
              },
              {
                href:  '/templates',
                icon:  '❐',
                label: 'Templates',
                desc:  'Saved configurations',
                color: 'border-white/10 hover:bg-white/5',
              },
              {
                href:  '/analytics',
                icon:  '◎',
                label: 'Analytics',
                desc:  'Performance overview',
                color: 'border-white/10 hover:bg-white/5',
              },
            ].map(action => (
              <Link
                key={action.href}
                href={action.href}
                className={`
                  p-4 rounded-xl border transition-all group
                  ${action.color}
                `}
              >
                <span className="text-xl">{action.icon}</span>
                <p className="text-sm font-medium text-white mt-2 group-hover:text-violet-300 transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{action.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent Content ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
              Recent Content
            </h2>
            <Link
              href="/content"
              className="text-xs text-gray-500 hover:text-white transition-colors"
            >
              View all →
            </Link>
          </div>

          <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
            {recentLoading ? (
              <div className="divide-y divide-white/5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                    <div className="w-6 h-4 bg-white/10 rounded" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-white/10 rounded w-3/4" />
                      <div className="h-2.5 bg-white/10 rounded w-1/4" />
                    </div>
                    <div className="w-16 h-5 bg-white/10 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="divide-y divide-white/5">
                {recent.map(item => (
                  <RecentContentRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
