'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';

const AGENTS = [
  { key: 'canonical_writer', label: 'Agent 1: Writing canonical draft' },
  { key: 'platform_optimizer', label: 'Agent 2: Platform optimization' },
  { key: 'brand_optimizer', label: 'Agent 3: Brand alignment' },
  { key: 'humanizer', label: 'Agent 4: Humanization' },
  { key: 'qa', label: 'Agent 5: Quality assurance' },
];

type AgentStatus = 'pending' | 'running' | 'done' | 'failed';

export default function GeneratingPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;

  const [progress, setProgress] = useState(0);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({
    canonical_writer: 'pending',
    platform_optimizer: 'pending',
    brand_optimizer: 'pending',
    humanizer: 'pending',
    qa: 'pending',
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000', {
      query: { requestId },
    });

    socket.on('job:progress', ({ progress: p }: { progress: number }) => {
      setProgress(p);
      // Map progress % to agent completion
      if (p >= 10) setAgentStatuses((s) => ({ ...s, canonical_writer: p >= 35 ? 'done' : 'running' }));
      if (p >= 35) setAgentStatuses((s) => ({ ...s, platform_optimizer: p >= 55 ? 'done' : 'running' }));
      if (p >= 55) setAgentStatuses((s) => ({ ...s, brand_optimizer: p >= 75 ? 'done' : 'running' }));
      if (p >= 75) setAgentStatuses((s) => ({ ...s, humanizer: p >= 90 ? 'done' : 'running' }));
      if (p >= 90) setAgentStatuses((s) => ({ ...s, qa: p >= 100 ? 'done' : 'running' }));
    });

    socket.on('job:completed', () => {
      setProgress(100);
      setAgentStatuses({ canonical_writer: 'done', platform_optimizer: 'done', brand_optimizer: 'done', humanizer: 'done', qa: 'done' });
      setTimeout(() => router.push(`/content/${requestId}`), 1200);
    });

    socket.on('job:failed', () => setFailed(true));

    return () => { socket.disconnect(); };
  }, [requestId, router]);

  const estimatedSec = Math.max(0, Math.round(((100 - progress) / 100) * 60));

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">Generating Your Content</h1>
          <p className="text-muted-foreground text-sm">AI agents are working on your request</p>
        </div>

        <div className="bg-card border rounded-xl p-6 space-y-5">
          {/* Agents */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Input validated</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Context retrieved</span>
            </div>
            {AGENTS.map(({ key, label }) => {
              const status = agentStatuses[key];
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  {status === 'done' && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {status === 'running' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                  {status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground" />}
                  {status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                  <span className={status === 'running' ? 'text-foreground font-medium' : status === 'done' ? 'text-green-600' : 'text-muted-foreground'}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress}%</span>
              {!failed && progress < 100 && <span>~{estimatedSec}s remaining</span>}
            </div>
          </div>

          {failed && (
            <div className="text-center pt-2">
              <p className="text-destructive text-sm mb-3">Generation failed. Please try again.</p>
              <Button variant="outline" size="sm" onClick={() => router.push('/content/new')}>Try Again</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
