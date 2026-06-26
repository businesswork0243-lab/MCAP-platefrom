'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/auth';
import { PenSquare, FileUp, FileText, TrendingUp, Clock, CheckCircle, Activity } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value ?? '—'}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, any> = {
  approved: 'success',
  published: 'success',
  running: 'warning',
  awaiting_review: 'warning',
  failed: 'destructive',
  draft: 'secondary',
};

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
  });

  const { data: recentData } = useQuery({
    queryKey: ['recent-content'],
    queryFn: () => api.get('/content?limit=5').then((r) => r.data),
  });

  const stats = overview?.content;
  const recent = recentData?.requests ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {user?.organizationName} · Last 30 days
          </p>
        </div>
        <Link href="/content/new">
          <Button>
            <PenSquare className="w-4 h-4" />
            New Content
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Generated" value={stats?.total_requests} icon={Activity} color="bg-violet-500" />
        <StatCard label="Approved" value={stats?.approved} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Published" value={stats?.published} icon={TrendingUp} color="bg-blue-500" />
        <StatCard label="Avg. Time (min)" value={stats?.avg_completion_seconds ? Math.round(stats.avg_completion_seconds / 60) : null} icon={Clock} color="bg-orange-500" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="flex gap-3">
          <Link href="/content/new">
            <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-start gap-1">
              <PenSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">New Content Request</span>
            </Button>
          </Link>
          <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-start gap-1">
            <FileUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Upload Document</span>
          </Button>
          <Link href="/templates">
            <Button variant="outline" className="h-auto py-3 px-4 flex flex-col items-start gap-1">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Use Template</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Content</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm mb-3">No content yet</p>
              <Link href="/content/new">
                <Button size="sm">Create your first content request →</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((item: any) => (
                <Link key={item.id} href={`/content/${item.id}`} className="flex items-center justify-between py-3 hover:opacity-80 transition-opacity">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.topic}</p>
                    <p className="text-xs text-muted-foreground">{item.target_platform} · {formatRelative(item.created_at)}</p>
                  </div>
                  <Badge variant={STATUS_COLORS[item.status] ?? 'outline'} className="ml-4 shrink-0">
                    {item.status.replace('_', ' ')}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
