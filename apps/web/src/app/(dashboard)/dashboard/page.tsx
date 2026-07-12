'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Sparkles, FileText, Users, BarChart3,
  CheckCircle, TrendingUp, Clock, Palette, FileStack,
  Zap, ArrowRight
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { formatRelative, formatDuration, formatNumber } from '@/lib/utils';
import { PlatformIcon, getPlatformConfig } from '@/components/platform-icons';

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
  platforms:       string[] | string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  approved:          { label: 'Ready',      color: 'text-green-400 bg-green-500/15 border-green-500/30'    },
  published:         { label: 'Published',  color: 'text-blue-400 bg-blue-500/15 border-blue-500/30'       },
  awaiting_review:   { label: 'Review',     color: 'text-amber-400 bg-amber-500/15 border-amber-500/30'    },
  running:           { label: 'Generating', color: 'text-violet-400 bg-violet-500/15 border-violet-500/30' },
  processing:        { label: 'Processing', color: 'text-violet-400 bg-violet-500/15 border-violet-500/30' },
  queued:            { label: 'Queued',     color: 'text-gray-400 bg-gray-500/15 border-gray-500/30'       },
  generation_failed: { label: 'Failed',     color: 'text-red-400 bg-red-500/15 border-red-500/30'          },
  failed:            { label: 'Failed',     color: 'text-red-400 bg-red-500/15 border-red-500/30'          },
  completed:         { label: 'Complete',   color: 'text-green-400 bg-green-500/15 border-green-500/30'    },
};

// ─── Safe Helpers ─────────────────────────────────────────────────────────────

function parsePlatforms(raw: string[] | string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStatusConfig(status: string | null | undefined) {
  if (!status || typeof status !== 'string') {
    return { label: 'Unknown', color: 'text-gray-400 bg-gray-500/15 border-gray-500/30' };
  }
  return STATUS_CONFIG[status] ?? {
    label: status.replace(/_/g, ' '),
    color: 'text-gray-400 bg-gray-500/15 border-gray-500/30',
  };
}

// ─── Sub Components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  Icon,
  color,
  bgColor,
  sub,
}: {
  label:   string;
  value:   string | number | null | undefined;
  Icon:    React.ComponentType<{ className?: string }>;
  color:   string;
  bgColor: string;
  sub?:    string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-white/15 transition-all"
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
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </motion.div>
  );
}

function RecentContentRow({ item }: { item: ContentRequest }) {
  const status = getStatusConfig(item.status);
  const platforms = parsePlatforms(item.platforms);

  return (
    <Link
      href={`/content/${item.id}`}
      className="flex items-center gap-4 py-3.5 px-4 rounded-xl hover:bg-white/5 transition-all group"
    >
      {/* Platform icons with real brand icons */}
      <div className="flex items-center gap-1 shrink-0 min-w-[60px]">
        {platforms.length === 0 ? (
          <PlatformIcon platform="canonical" size="sm" className="opacity-50" />
        ) : (
          <>
            {platforms.slice(0, 3).map((p, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0"
                title={getPlatformConfig(p).label}
              >
                <PlatformIcon platform={p} size="sm" />
              </div>
            ))}
            {platforms.length > 3 && (
              <span className="text-xs text-gray-600 font-medium ml-1">
                +{platforms.length - 3}
              </span>
            )}
          </>
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
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-violet-400" />
      </div>
      <h3 className="text-white font-medium">No content yet</h3>
      <p className="text-gray-500 text-sm mt-1 mb-6">
        Create your first content piece to get started
      </p>
      <Link
        href="/content/new"
        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-all"
      >
        <Sparkles className="w-4 h-4" />
        Create Content
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore(s => s.user);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn:  () => api.get('/analytics/overview').then(r => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['recent-content'],
    queryFn:  () => api.get('/content?limit=8').then(r => r.data),
    staleTime: 30 * 1000,
  });

  const stats: ContentStats | undefined = overview?.content;
  const recent: ContentRequest[] = recentData?.requests ?? [];

  // Greeting
  const hour = new Date().getHours();
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

        {/* ═══ Header ═══ */}
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
            <Sparkles className="w-4 h-4" />
            New Content
          </Link>
        </motion.div>

        {/* ═══ Stats Grid ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-3 w-20 bg-white/10 rounded" />
                    <div className="h-7 w-12 bg-white/10 rounded" />
                  </div>
                  <div className="w-10 h-10 bg-white/10 rounded-xl" />
                </div>
              </div>
            ))
          ) : (
            <>
              <StatCard
                label="Total Generated"
                value={stats?.total_requests ? formatNumber(parseInt(stats.total_requests)) : null}
                Icon={Sparkles}
                color="text-violet-400"
                bgColor="bg-violet-500/20"
              />
              <StatCard
                label="Approved"
                value={stats?.approved ? formatNumber(parseInt(stats.approved)) : null}
                Icon={CheckCircle}
                color="text-green-400"
                bgColor="bg-green-500/20"
                sub={approvalRate !== null ? `${approvalRate}% approval rate` : undefined}
              />
              <StatCard
                label="Published"
                value={stats?.published ? formatNumber(parseInt(stats.published)) : null}
                Icon={TrendingUp}
                color="text-blue-400"
                bgColor="bg-blue-500/20"
              />
              <StatCard
                label="Avg. Time"
                value={avgTime}
                Icon={Clock}
                color="text-amber-400"
                bgColor="bg-amber-500/20"
                sub="per generation"
              />
            </>
          )}
        </div>

        {/* ═══ Quick Actions ═══ */}
        <div>
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                href:  '/content/new',
                Icon:  Sparkles,
                label: 'New Content',
                desc:  'Start generating',
                color: 'border-violet-500/30 hover:bg-violet-500/10',
                iconColor: 'text-violet-400',
              },
              {
                href:  '/brand',
                Icon:  Palette,
                label: 'Brand Profiles',
                desc:  'Manage voice & ICPs',
                color: 'border-white/10 hover:bg-white/5',
                iconColor: 'text-blue-400',
              },
              {
                href:  '/templates',
                Icon:  FileStack,
                label: 'Templates',
                desc:  'Saved configurations',
                color: 'border-white/10 hover:bg-white/5',
                iconColor: 'text-emerald-400',
              },
              {
                href:  '/analytics',
                Icon:  BarChart3,
                label: 'Analytics',
                desc:  'Performance overview',
                color: 'border-white/10 hover:bg-white/5',
                iconColor: 'text-amber-400',
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
                <action.Icon className={`w-5 h-5 ${action.iconColor}`} />
                <p className="text-sm font-medium text-white mt-2 group-hover:text-violet-300 transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{action.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══ Recent Content ═══ */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">
              Recent Content
            </h2>
            <Link
              href="/content"
              className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            {recentLoading ? (
              <div className="divide-y divide-white/5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                    <div className="w-16 h-6 bg-white/10 rounded" />
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
