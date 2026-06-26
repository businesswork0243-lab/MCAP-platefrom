'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Copy, Download, RefreshCw, Sparkles, CheckCircle,
  XCircle, ChevronRight, BarChart2, AlertTriangle, Info
} from 'lucide-react';

const PLATFORM_LABELS: Record<string, string> = {
  canonical: '📄 Canonical Draft',
  linkedin_post: '💼 LinkedIn Post',
  linkedin_article: '📰 LinkedIn Article',
  x_post: '🐦 X Post',
  x_thread: '🧵 X Thread',
  blog_post: '📝 Blog Post',
  newsletter: '📧 Newsletter',
};

const STATUS_COLORS: Record<string, any> = {
  approved: 'success', published: 'success',
  awaiting_review: 'warning', awaiting_qa: 'warning', running: 'warning',
  failed: 'destructive', draft: 'secondary',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function ContentWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('canonical');
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['content', id],
    queryFn: () => api.get(`/content/${id}`).then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api.patch(`/content/${id}/status`, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content', id] }),
  });

  const rerunMutation = useMutation({
    mutationFn: (agent: string) => api.post(`/content/${id}/rerun`, { agent }),
    onSuccess: () => router.push(`/content/${id}/generating`),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  const request = data?.request;
  const artifacts = data?.artifacts ?? [];
  const score = request?.metadata?.qualityScore;

  const activeArtifact = artifacts.find(
    (a: any) => a.agent_type === activeTab || (activeTab === 'canonical' && a.agent_type === 'canonical_writer')
  );
  const content = activeArtifact?.content ?? '';

  const copyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformArtifacts = artifacts.filter((a: any) =>
    ['canonical_writer', 'platform_optimizer'].includes(a.agent_type)
  );

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b px-6 flex items-center gap-4 shrink-0">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-semibold flex-1 truncate">{request?.topic}</h1>
        <Badge variant={STATUS_COLORS[request?.status] ?? 'outline'}>
          {request?.status?.replace(/_/g, ' ')}
        </Badge>
        {score && (
          <div className="flex items-center gap-1 text-sm">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{score}/100</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyContent}>
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Platform tabs */}
        <div className="w-48 border-r bg-muted/30 py-3 shrink-0 overflow-y-auto">
          {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm transition-colors',
                activeTab === key
                  ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Center — Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <span className="text-sm font-medium">{PLATFORM_LABELS[activeTab]}</span>
            <Button variant="ghost" size="sm" onClick={copyContent}>
              <Copy className="w-3.5 h-3.5" />
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
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No content for this platform yet
              </div>
            )}
          </div>
          {/* Agent actions */}
          <div className="border-t px-6 py-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">Re-run:</span>
            {[
              { agent: 'canonical_writer', label: 'Regenerate' },
              { agent: 'humanizer', label: 'Re-humanize' },
              { agent: 'brand_optimizer', label: 'Re-brand' },
              { agent: 'qa', label: 'Re-run QA' },
            ].map(({ agent, label }) => (
              <Button
                key={agent}
                variant="outline"
                size="sm"
                onClick={() => rerunMutation.mutate(agent)}
                loading={rerunMutation.isPending}
              >
                <RefreshCw className="w-3 h-3" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Right panel — Intelligence sidebar */}
        <div className="w-64 border-l shrink-0 overflow-y-auto p-4 space-y-5">
          {/* Quality scores — spec weights */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Quality Scores</h3>
            <div className="space-y-2.5">
              <ScoreBar label="Overall" value={request?.metadata?.overallScore ?? 0} />
              <div className="border-t my-2" />
              <ScoreBar label="Brand (20%)" value={request?.metadata?.brandScore ?? 0} />
              <ScoreBar label="Readability (15%)" value={request?.metadata?.readabilityScore ?? 0} />
              <ScoreBar label="Platform (15%)" value={request?.metadata?.platformScore ?? 0} />
              <ScoreBar label="Structure (10%)" value={request?.metadata?.structureScore ?? 0} />
              <ScoreBar label="Humanization (10%)" value={request?.metadata?.humanizationScore ?? 0} />
              <ScoreBar label="Consistency (10%)" value={request?.metadata?.consistencyScore ?? 0} />
              <ScoreBar label="Clarity (10%)" value={request?.metadata?.clarityScore ?? 0} />
              <ScoreBar label="Engagement (5%)" value={request?.metadata?.engagementScore ?? 0} />
              <ScoreBar label="CTA (5%)" value={request?.metadata?.ctaScore ?? 0} />
            </div>
          </div>

          {/* QA flags */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">QA Findings</h3>
            <div className="space-y-1.5">
              {(request?.metadata?.flags ?? []).length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <CheckCircle className="w-3.5 h-3.5" /> No issues found
                </div>
              ) : (
                (request?.metadata?.flags ?? []).map((flag: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-yellow-600">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{flag.replace(/_/g, ' ')}</span>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Approval</h3>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => approveMutation.mutate('approve')}
                loading={approveMutation.isPending}
                disabled={request?.status === 'approved'}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={() => approveMutation.mutate('reject')}
                loading={approveMutation.isPending}
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </Button>
            </div>
          </div>

          {/* Version history */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Version History</h3>
            <div className="space-y-1">
              {artifacts.slice().reverse().map((a: any, i: number) => (
                <div key={a.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/50 last:border-0">
                  <span className="text-muted-foreground">v{artifacts.length - i}</span>
                  <span className="flex-1 truncate">{a.agent_type.replace(/_/g, ' ')}</span>
                  {i === 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">current</Badge>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
