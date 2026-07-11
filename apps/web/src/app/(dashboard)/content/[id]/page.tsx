'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Copy, Download, RefreshCw, CheckCircle,
  XCircle, BarChart2, AlertTriangle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Artifact {
  id: string;
  request_id?: string;
  content_type?: string;
  agent_type?: string;
  body?: string;
  content?: string;
  version?: number;
  status?: string;
  quality_score?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

interface ContentRequest {
  id: string;
  topic?: string;
  status?: string;
  metadata?: {
    qualityScore?: number;
    overallScore?: number;
    brandScore?: number;
    readabilityScore?: number;
    platformScore?: number;
    structureScore?: number;
    humanizationScore?: number;
    consistencyScore?: number;
    clarityScore?: number;
    engagementScore?: number;
    ctaScore?: number;
    flags?: string[];
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  canonical: '📄 Canonical Draft',
  linkedin_post: '💼 LinkedIn Post',
  linkedin_article: '📰 LinkedIn Article',
  x_post: '🐦 X Post',
  x_thread: '🧵 X Thread',
  twitter_thread: '🧵 Twitter Thread',
  twitter_post: '🐦 Twitter Post',
  blog_post: '📝 Blog Post',
  blog: '📝 Blog Post',
  newsletter: '📧 Newsletter',
  instagram_caption: '📸 Instagram Caption',
  instagram_post: '📸 Instagram Post',
  youtube_script: '🎬 YouTube Script',
};

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'> = {
  approved: 'success',
  published: 'success',
  completed: 'success',
  awaiting_review: 'warning',
  awaiting_qa: 'warning',
  running: 'warning',
  processing: 'warning',
  queued: 'secondary',
  failed: 'destructive',
  generation_failed: 'destructive',
  draft: 'secondary',
};

// ─── Safe Helpers ─────────────────────────────────────────────────────────────

function safeReplace(str: string | null | undefined, from: RegExp | string, to: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(from, to);
}

function safeString(val: unknown, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  return String(val);
}

function getArtifactContent(artifact: Artifact | undefined | null): string {
  if (!artifact) return '';
  return artifact.body || artifact.content || '';
}

function getArtifactType(artifact: Artifact | undefined | null): string {
  if (!artifact) return 'unknown';
  return artifact.agent_type || artifact.content_type || 'unknown';
}

// ─── Score Bar Component ──────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, value || 0));
  const color =
    safeValue >= 80 ? 'bg-green-500'
      : safeValue >= 60 ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{safeValue}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContentWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('canonical');
  const [copied, setCopied] = useState(false);

  // Fetch content
  const { data, isLoading, error } = useQuery({
    queryKey: ['content', id],
    queryFn: () => api.get(`/content/${id}`).then((r) => r.data),
    enabled: !!id,
    retry: 2,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') => {
      // Find first artifact to approve
      const artifactId = artifacts[0]?.id;
      if (!artifactId) throw new Error('No artifact to approve');
      const endpoint = action === 'approve' ? 'approve' : 'reject';
      return api.post(`/content/${id}/artifacts/${artifactId}/${endpoint}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content', id] }),
  });

  const rerunMutation = useMutation({
    mutationFn: () => api.post(`/content/${id}/rerun`),
    onSuccess: (response) => {
      const newId = response.data?.requestId || response.data?.contentId;
      if (newId) {
        router.push(`/content/${newId}/generating`);
      }
    },
  });

  const rehumanizeMutation = useMutation({
    mutationFn: () => api.post(`/content/${id}/rehumanize`, { intensity: 'medium' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content', id] }),
  });

  // ── Safe Data Extraction ──────────────────────────────────────────────────
  const request: ContentRequest | undefined = data?.request;
  const artifacts: Artifact[] = useMemo(() => {
    const raw = data?.artifacts ?? [];
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, [data]);

  // Find active artifact safely
  const activeArtifact = useMemo(() => {
    if (artifacts.length === 0) return null;

    // Try to find matching artifact
    const found = artifacts.find((a) => {
      const type = getArtifactType(a);
      // Match various naming patterns
      if (type === activeTab) return true;
      if (activeTab === 'canonical' && (type === 'canonical' || type === 'canonical_writer')) return true;
      return false;
    });

    // Fallback: return latest artifact
    return found || artifacts[artifacts.length - 1];
  }, [artifacts, activeTab]);

  const content = getArtifactContent(activeArtifact);

  const copyContent = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const score = request?.metadata?.overallScore ?? request?.metadata?.qualityScore ?? 0;

  // ── Loading State ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading content...</p>
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────────
  if (error || !request) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center space-y-4 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <div>
            <h2 className="text-lg font-semibold">Content not found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The content you are looking for does not exist or you do not have permission.
            </p>
          </div>
          <Button onClick={() => router.push('/content')} variant="outline">
            ← Back to Content Library
          </Button>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[request.status || ''] || 'outline';
  const statusLabel = safeReplace(request.status, /_/g, ' ') || 'Unknown';

  return (
    <div className="h-full flex flex-col">
      {/* ═══ Top Bar ═══ */}
      <div className="h-14 border-b px-6 flex items-center gap-4 shrink-0">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <h1 className="font-semibold flex-1 truncate">
          {safeString(request.topic, 'Untitled Content')}
        </h1>

        <Badge variant={statusColor as 'default' | 'destructive' | 'outline' | 'secondary' | undefined}>
          {statusLabel}
        </Badge>

        {score > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{score}/100</span>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={copyContent}>
          <Download className="w-3.5 h-3.5 mr-1" />
          Export
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ═══ Left Panel — Platform Tabs ═══ */}
        <div className="w-48 border-r bg-muted/30 py-3 shrink-0 overflow-y-auto">
          {Object.entries(PLATFORM_LABELS).map(([key, label]) => {
            // Check if this platform has content
            const hasContent = artifacts.some((a) => {
              const type = getArtifactType(a);
              return type === key || (key === 'canonical' && type.includes('canonical'));
            });

            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm transition-colors',
                  activeTab === key
                    ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  !hasContent && 'opacity-50'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ═══ Center — Editor ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <span className="text-sm font-medium">
              {PLATFORM_LABELS[activeTab] || activeTab}
            </span>
            <Button variant="ghost" size="sm" onClick={copyContent} disabled={!content}>
              <Copy className="w-3.5 h-3.5 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {content ? (
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {content}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No content for this platform yet</p>
                {artifacts.length > 0 && (
                  <p className="text-xs mt-2">
                    Available: {artifacts.map(a => getArtifactType(a)).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Agent Actions */}
          <div className="border-t px-6 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-2">Re-run:</span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => rerunMutation.mutate()}
              disabled={rerunMutation.isPending}
            >
              <RefreshCw className={cn('w-3 h-3 mr-1', rerunMutation.isPending && 'animate-spin')} />
              Regenerate
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => rehumanizeMutation.mutate()}
              disabled={rehumanizeMutation.isPending}
            >
              <RefreshCw className={cn('w-3 h-3 mr-1', rehumanizeMutation.isPending && 'animate-spin')} />
              Re-humanize
            </Button>
          </div>
        </div>

        {/* ═══ Right Panel — Intelligence Sidebar ═══ */}
        <div className="w-64 border-l shrink-0 overflow-y-auto p-4 space-y-5">
          {/* Quality Scores */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Quality Scores
            </h3>
            <div className="space-y-2.5">
              <ScoreBar label="Overall" value={request.metadata?.overallScore ?? 0} />
              <div className="border-t my-2" />
              <ScoreBar label="Brand (20%)" value={request.metadata?.brandScore ?? 0} />
              <ScoreBar label="Readability (15%)" value={request.metadata?.readabilityScore ?? 0} />
              <ScoreBar label="Platform (15%)" value={request.metadata?.platformScore ?? 0} />
              <ScoreBar label="Structure (10%)" value={request.metadata?.structureScore ?? 0} />
              <ScoreBar label="Humanization (10%)" value={request.metadata?.humanizationScore ?? 0} />
              <ScoreBar label="Consistency (10%)" value={request.metadata?.consistencyScore ?? 0} />
              <ScoreBar label="Clarity (10%)" value={request.metadata?.clarityScore ?? 0} />
              <ScoreBar label="Engagement (5%)" value={request.metadata?.engagementScore ?? 0} />
              <ScoreBar label="CTA (5%)" value={request.metadata?.ctaScore ?? 0} />
            </div>
          </div>

          {/* QA Findings */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              QA Findings
            </h3>
            <div className="space-y-1.5">
              {(request.metadata?.flags ?? []).length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" /> No issues found
                </div>
              ) : (
                (request.metadata?.flags ?? []).map((flag: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-yellow-600">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{safeReplace(flag, /_/g, ' ')}</span>
                  </div>
                ))
              )}
              <div className="flex items-center gap-2 text-xs text-green-600">
                <CheckCircle className="w-3.5 h-3.5" /> Structure validated
              </div>
            </div>
          </div>

          {/* Approval */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Approval
            </h3>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => approveMutation.mutate('approve')}
                disabled={approveMutation.isPending || request.status === 'approved'}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={() => approveMutation.mutate('reject')}
                disabled={approveMutation.isPending}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            </div>
          </div>

          {/* Version History */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Version History
            </h3>
            <div className="space-y-1">
              {artifacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No versions yet</p>
              ) : (
                artifacts.slice().reverse().map((a, i) => {
                  const type = getArtifactType(a);
                  const displayName = safeReplace(type, /_/g, ' ');
                  return (
                    <div
                      key={a.id || i}
                      className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0"
                    >
                      <span className="text-muted-foreground">v{artifacts.length - i}</span>
                      <span className="flex-1 truncate capitalize">
                        {displayName || 'Unknown'}
                      </span>
                      {i === 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          current
                        </Badge>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}