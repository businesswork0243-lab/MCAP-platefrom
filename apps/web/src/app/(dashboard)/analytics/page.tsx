'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { formatNumber, formatDuration } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewStats {
  total_requests:           string;
  approved:                 string;
  published:                string;
  avg_completion_seconds:   string | null;
  generation_failed:        string;
}

interface ProductivityRow {
  day:               string;
  requests_created:  number;
  completed:         number;
  failed:            number;
}

interface PlatformRow {
  platform:   string;
  count:      string;
  published:  string;
  avg_score:  string | null;
}

interface QualityScores {
  avg_overall:      string | null;
  avg_brand:        string | null;
  avg_readability:  string | null;
  avg_platform_fit: string | null;
  avg_humanization: string | null;
  avg_clarity:      string | null;
  avg_engagement:   string | null;
  avg_cta:          string | null;
  avg_structure:    string | null;
  high_quality_count: string;
  total_scored:     string;
}

interface TeamMember {
  id:               string;
  name:             string;
  email:            string;
  role:             string;
  requests_created: string;
  approved:         string;
  failed:           string;
  tokens_used:      string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = {
  linkedin_post:      '💼',
  linkedin_article:   '📰',
  twitter_thread:     '🐦',
  x_thread:           '🐦',
  blog_post:          '✍️',
  newsletter:         '📧',
  instagram_caption:  '📸',
  youtube_script:     '🎬',
  podcast_notes:      '🎙️',
};

const SCORE_DIMENSIONS = [
  { key: 'avg_overall',      label: 'Overall',       weight: '—'   },
  { key: 'avg_brand',        label: 'Brand Voice',   weight: '20%' },
  { key: 'avg_readability',  label: 'Readability',   weight: '15%' },
  { key: 'avg_platform_fit', label: 'Platform Fit',  weight: '15%' },
  { key: 'avg_structure',    label: 'Structure',     weight: '10%' },
  { key: 'avg_humanization', label: 'Humanization',  weight: '10%' },
  { key: 'avg_clarity',      label: 'Clarity',       weight: '10%' },
  { key: 'avg_engagement',   label: 'Engagement',    weight: '5%'  },
  { key: 'avg_cta',          label: 'CTA',           weight: '5%'  },
];

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
    <div className={`p-5 rounded-2xl border ${color}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {value ?? '—'}
          </p>
          {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

// Mini bar chart — no external library needed
function MiniBarChart({
  data,
  valueKey,
  label,
}: {
  data:     ProductivityRow[];
  valueKey: keyof ProductivityRow;
  label:    string;
}) {
  if (!data.length) return (
    <div className="h-32 flex items-center justify-center text-gray-600 text-sm">
      No data
    </div>
  );

  const values  = data.map(d => Number(d[valueKey]));
  const maxVal  = Math.max(...values, 1);
  const recent14 = data.slice(-14); // Show last 14 days

  return (
    <div>
      <div className="flex items-end gap-1 h-24">
        {recent14.map((row, i) => {
          const val    = Number(row[valueKey]);
          const height = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 group"
            >
              <div className="relative w-full flex items-end" style={{ height: '80px' }}>
                <div
                  className="w-full bg-violet-500/60 hover:bg-violet-500 rounded-t transition-all"
                  style={{ height: `${height}%` }}
                  title={`${row.day}: ${val}`}
                />
              </div>
              {/* Tooltip on hover */}
              <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors">
                {val}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-xs text-gray-700">
          {recent14[0]?.day.slice(5)}
        </span>
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs text-gray-700">
          {recent14[recent14.length - 1]?.day.slice(5)}
        </span>
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  weight,
}: {
  label:  string;
  value:  number | null;
  weight: string;
}) {
  const val   = value ?? 0;
  const color =
    val >= 80 ? 'bg-green-500' :
    val >= 60 ? 'bg-amber-500' :
    val > 0   ? 'bg-red-500'   :
    'bg-white/10';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{label}</span>
          {weight !== '—' && (
            <span className="text-xs text-gray-700">{weight}</span>
          )}
        </div>
        <span className={`text-xs font-bold ${
          val >= 80 ? 'text-green-400' :
          val >= 60 ? 'text-amber-400' :
          val > 0   ? 'text-red-400'   :
          'text-gray-600'
        }`}>
          {value !== null ? `${value}` : '—'}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${val}%` }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function PlatformRowComponent({
  platform,
  count,
  avgScore,
}: {
  platform: string;
  count:    number;
  avgScore: number | null;
}) {
  const icon  = PLATFORM_ICONS[platform] ?? '📄';
  const label = platform.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-lg">{icon}</span>
      <span className="flex-1 text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-4">
        {avgScore !== null && (
          <span className={`text-xs font-medium ${
            avgScore >= 80 ? 'text-green-400' :
            avgScore >= 60 ? 'text-amber-400' :
            'text-gray-500'
          }`}>
            {avgScore}
          </span>
        )}
        <span className="text-sm font-bold text-white w-8 text-right">
          {count}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DAY_OPTIONS = [
  { value: 7,  label: '7D' },
  { value: 14, label: '14D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const queryOpts = { staleTime: 2 * 60 * 1000 };

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview', days],
    queryFn:  () => api.get(`/analytics/overview?days=${days}`).then(r => r.data),
    ...queryOpts,
  });

  const { data: productivity } = useQuery({
    queryKey: ['analytics-productivity', days],
    queryFn:  () => api.get(`/analytics/productivity?days=${days}`).then(r => r.data),
    ...queryOpts,
  });

  const { data: platformsData } = useQuery({
    queryKey: ['analytics-platforms', days],
    queryFn:  () => api.get(`/analytics/platforms?days=${days}`).then(r => r.data),
    ...queryOpts,
  });

  const { data: qualityData } = useQuery({
    queryKey: ['analytics-quality', days],
    queryFn:  () => api.get(`/analytics/quality?days=${days}`).then(r => r.data),
    ...queryOpts,
  });

  const { data: teamData } = useQuery({
    queryKey: ['analytics-team', days],
    queryFn:  () => api.get(`/analytics/team-activity?days=${days}`).then(r => r.data),
    ...queryOpts,
  });

  const stats: OverviewStats | undefined    = overview?.content;
  const prodData: ProductivityRow[]         = productivity?.data ?? [];
  const platforms: PlatformRow[]            = platformsData?.platforms ?? [];
  const quality: QualityScores | undefined  = qualityData?.scores;
  const team: TeamMember[]                  = teamData?.team ?? [];

  const approvalRate = stats?.total_requests && parseInt(stats.total_requests) > 0
    ? Math.round((parseInt(stats.approved) / parseInt(stats.total_requests)) * 100)
    : null;

  return (
    <div className="min-h-screen bg-[#080809] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-gray-500 text-sm mt-1">
              Content performance overview
            </p>
          </div>

          {/* Day selector */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
            {DAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  days === opt.value
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 bg-white/3 border border-white/10 rounded-2xl animate-pulse" />
            ))
          ) : (
            <>
              <StatCard
                label="Total Generated"
                value={stats?.total_requests ? formatNumber(parseInt(stats.total_requests)) : null}
                icon="✦"
                color="bg-violet-500/10 border-violet-500/20"
              />
              <StatCard
                label="Approval Rate"
                value={approvalRate !== null ? `${approvalRate}%` : null}
                icon="✓"
                color="bg-green-500/10 border-green-500/20"
                sub={stats?.approved ? `${stats.approved} approved` : undefined}
              />
              <StatCard
                label="Published"
                value={stats?.published ? formatNumber(parseInt(stats.published)) : null}
                icon="↗"
                color="bg-blue-500/10 border-blue-500/20"
              />
              <StatCard
                label="Avg. Gen Time"
                value={stats?.avg_completion_seconds
                  ? formatDuration(parseInt(stats.avg_completion_seconds))
                  : null
                }
                icon="⏱"
                color="bg-amber-500/10 border-amber-500/20"
              />
            </>
          )}
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-3 gap-5">

          {/* Productivity Chart */}
          <div className="col-span-2 p-5 bg-white/3 border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Content Created</h3>
              <span className="text-xs text-gray-600">Last {days} days</span>
            </div>
            <MiniBarChart
              data={prodData}
              valueKey="requests_created"
              label="pieces"
            />
          </div>

          {/* Platform Breakdown */}
          <div className="p-5 bg-white/3 border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Platforms</h3>
              <span className="text-xs text-gray-600">
                {platforms.length} used
              </span>
            </div>

            {platforms.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
                No data yet
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {platforms.slice(0, 6).map(p => (
                  <PlatformRowComponent
                    key={p.platform}
                    platform={p.platform}
                    count={parseInt(p.count)}
                    avgScore={p.avg_score ? parseFloat(p.avg_score) : null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Quality Scores ── */}
        <div className="grid grid-cols-2 gap-5">
          <div className="p-5 bg-white/3 border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">Quality Scores</h3>
              {quality?.total_scored && (
                <span className="text-xs text-gray-600">
                  {quality.total_scored} artifacts scored
                </span>
              )}
            </div>

            <div className="space-y-4">
              {SCORE_DIMENSIONS.map(({ key, label, weight }) => (
                <ScoreBar
                  key={key}
                  label={label}
                  value={quality?.[key as keyof QualityScores] !== null
                    ? parseFloat(quality?.[key as keyof QualityScores] as string ?? '0')
                    : null
                  }
                  weight={weight}
                />
              ))}
            </div>
          </div>

          {/* Team Activity */}
          <div className="p-5 bg-white/3 border border-white/10 rounded-2xl">
            <h3 className="text-sm font-semibold text-white mb-5">
              Team Activity
            </h3>

            {team.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
                No team activity
              </div>
            ) : (
              <div className="space-y-3">
                {team.map(member => {
                  const created = parseInt(member.requests_created);
                  const maxCreated = Math.max(
                    ...team.map(m => parseInt(m.requests_created)), 1
                  );
                  const barWidth = maxCreated > 0
                    ? (created / maxCreated) * 100
                    : 0;

                  const initials = member.name
                    .split(' ')
                    .slice(0, 2)
                    .map(n => n[0])
                    .join('')
                    .toUpperCase();

                  return (
                    <div key={member.id} className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-violet-400">
                            {initials}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-white truncate">
                              {member.name}
                            </span>
                            <span className="text-xs text-gray-500 ml-2 shrink-0">
                              {created} pieces
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-9 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-violet-500/50 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
