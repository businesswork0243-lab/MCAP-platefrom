'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, CheckCircle, Clock, Layers } from 'lucide-react';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

function Stat({ label, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="p-5">
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

export default function AnalyticsPage() {
  const { data: overview } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
  });
  const { data: productivity } = useQuery({
    queryKey: ['analytics-productivity'],
    queryFn: () => api.get('/analytics/productivity').then((r) => r.data),
  });
  const { data: platforms } = useQuery({
    queryKey: ['analytics-platforms'],
    queryFn: () => api.get('/analytics/platforms').then((r) => r.data),
  });
  const { data: quality } = useQuery({
    queryKey: ['analytics-quality'],
    queryFn: () => api.get('/analytics/quality').then((r) => r.data),
  });

  const stats = overview?.content;
  const prodData = productivity?.data ?? [];
  const platformData = platforms?.platforms ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">Last 30 days</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Content Created" value={stats?.total_requests} icon={Layers} color="bg-violet-500" />
        <Stat label="Approval Rate" value={stats?.approved && stats?.total_requests ? `${Math.round((stats.approved / stats.total_requests) * 100)}%` : null} icon={CheckCircle} color="bg-green-500" />
        <Stat label="Published" value={stats?.published} icon={TrendingUp} color="bg-blue-500" />
        <Stat label="Avg Time (min)" value={stats?.avg_completion_seconds ? Math.round(stats.avg_completion_seconds / 60) : null} icon={Clock} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Productivity chart */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Content Created Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={prodData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="requests_created" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Created" />
                <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={false} name="Completed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Platform breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Platform Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={platformData} dataKey="count" nameKey="target_platform" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {platformData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quality scores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Average Quality Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'Quality Score', value: quality?.avg_quality_score },
              { label: 'Brand Score', value: quality?.avg_brand_score },
              { label: 'Readability Score', value: quality?.avg_readability_score },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-bold text-primary">{value ?? '—'}</div>
                <div className="text-sm text-muted-foreground mt-1">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
