'use client';
import { useRouter } from 'next/navigation';
import { useContentStore } from '@/store/content';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Rocket, Check } from 'lucide-react';

const STEPS = ['What to Create', 'Target Audience', 'Platforms', 'Tone & Style', 'Review'];

const PLATFORMS = [
  { id: 'linkedin_post', label: 'LinkedIn Post', emoji: '💼' },
  { id: 'linkedin_article', label: 'LinkedIn Article', emoji: '📰' },
  { id: 'x_post', label: 'X Post', emoji: '🐦' },
  { id: 'x_thread', label: 'X Thread', emoji: '🧵' },
  { id: 'blog_post', label: 'Blog Post', emoji: '📝' },
  { id: 'newsletter', label: 'Newsletter', emoji: '📧' },
  { id: 'landing_page', label: 'Landing Page', emoji: '🚀' },
  { id: 'executive_brief', label: 'Executive Brief', emoji: '📊' },
];

const STRUCTURES = [
  { id: 'debate', label: 'Debate', emoji: '💬' },
  { id: 'data_driven', label: 'Data Driven', emoji: '📊' },
  { id: 'story', label: 'Story', emoji: '📖' },
  { id: 'thesis', label: 'Thesis', emoji: '📝' },
  { id: 'incentive_diagnosis', label: 'Incentive Diagnosis', emoji: '🔍' },
];

const AUDIENCES = ['C-Suite / Executives', 'Technical (CTO, Engineers)', 'Marketing Professionals', 'Investors / VCs', 'General Business', 'Custom...'];
const OBJECTIVES = ['Educate audience', 'Generate leads', 'Build thought leadership', 'Announce product/feature', 'Drive event registrations'];
const PERSPECTIVES = ['Founder', 'CEO', 'CMO / Marketing', 'CTO / Technical', 'Researcher', 'Analyst', 'Consultant', 'Institution / Company'];
const CTAS = ['Invite discussion', 'Newsletter subscribe', 'Book consultation', 'Download resource', 'Register for event', 'No CTA'];

export default function NewContentPage() {
  const router = useRouter();
  const { draft, currentStep, setDraft, setStep, resetDraft } = useContentStore();

  const { data: brandData } = useQuery({
    queryKey: ['brand-profiles'],
    queryFn: () => api.get('/brand').then((r) => r.data),
  });
  const brands = brandData?.profiles ?? [];

  const submitMutation = useMutation({
    mutationFn: () => api.post('/content', {
      topic: draft.topic,
      strategicObjective: draft.strategicObjective,
      context: draft.context,
      targetAudience: draft.targetAudience,
      audienceDescription: draft.audienceDescription,
      narrativePerspective: draft.narrativePerspective,
      targetPlatforms: draft.platforms,
      writingStructure: draft.writingStructure,
      callToAction: draft.callToAction,
      brandProfileId: draft.brandProfileId,
      enableHumanization: draft.enableHumanization,
      enableQA: draft.enableQA,
      requireApproval: draft.requireApproval,
      language: draft.language,
      specialInstructions: draft.specialInstructions,
    }),
    onSuccess: (res) => {
      resetDraft();
      router.push(`/content/${res.data.request.id}/generating`);
    },
  });

  const togglePlatform = (id: string) => {
    const current = draft.platforms ?? [];
    const updated = current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
    setDraft({ platforms: updated });
  };

  const canNext = () => {
    if (currentStep === 1) return !!draft.topic && !!draft.strategicObjective;
    if (currentStep === 2) return !!draft.targetAudience && !!draft.narrativePerspective;
    if (currentStep === 3) return (draft.platforms?.length ?? 0) > 0;
    if (currentStep === 4) return !!draft.writingStructure && !!draft.brandProfileId;
    return true;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="mb-8">
        <h1 className="text-xl font-bold mb-4">New Content Request</h1>
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => {
            const stepNum = i + 1;
            const done = currentStep > stepNum;
            const active = currentStep === stepNum;
            return (
              <div key={label} className="flex items-center gap-1 flex-1">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  done ? 'bg-primary text-white' : active ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {done ? <Check className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span className={cn('text-xs hidden sm:block', active ? 'text-foreground font-medium' : 'text-muted-foreground')}>{label}</span>
                {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border mx-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1 */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>What do you want to create?</CardTitle>
            <CardDescription>Step 1 of 5</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Topic / Title *</label>
              <Input
                placeholder="What's your topic?"
                value={draft.topic ?? ''}
                onChange={(e) => setDraft({ topic: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Strategic Objective *</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft.strategicObjective ?? ''}
                onChange={(e) => setDraft({ strategicObjective: e.target.value })}
              >
                <option value="">Select objective...</option>
                {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Primary Context</label>
              <Textarea
                placeholder="Add background info, key points, data, or paste your notes here..."
                rows={5}
                value={draft.context ?? ''}
                onChange={(e) => setDraft({ context: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Who is this for?</CardTitle>
            <CardDescription>Step 2 of 5</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Target Audience *</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft.targetAudience ?? ''}
                onChange={(e) => setDraft({ targetAudience: e.target.value })}
              >
                <option value="">Select audience...</option>
                {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Audience Description</label>
              <Textarea
                placeholder="Describe your reader..."
                rows={3}
                value={draft.audienceDescription ?? ''}
                onChange={(e) => setDraft({ audienceDescription: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Narrative Perspective *</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft.narrativePerspective ?? ''}
                onChange={(e) => setDraft({ narrativePerspective: e.target.value })}
              >
                <option value="">Select perspective...</option>
                {PERSPECTIVES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Where will this be published?</CardTitle>
            <CardDescription>Step 3 of 5 — Select one or more platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {PLATFORMS.map(({ id, label, emoji }) => {
                const selected = draft.platforms?.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => togglePlatform(id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all',
                      selected ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/40 hover:bg-accent'
                    )}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span>{label}</span>
                    {selected && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4 */}
      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Tone & Style</CardTitle>
            <CardDescription>Step 4 of 5</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Writing Structure *</label>
              <div className="grid grid-cols-3 gap-2">
                {STRUCTURES.map(({ id, label, emoji }) => (
                  <button
                    key={id}
                    onClick={() => setDraft({ writingStructure: id })}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all',
                      draft.writingStructure === id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40 hover:bg-accent'
                    )}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Call to Action</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft.callToAction ?? ''}
                onChange={(e) => setDraft({ callToAction: e.target.value })}
              >
                <option value="">Select CTA...</option>
                {CTAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Brand Profile *</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft.brandProfileId ?? ''}
                onChange={(e) => setDraft({ brandProfileId: e.target.value })}
              >
                <option value="">Select brand profile...</option>
                {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5 — Review */}
      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Generate</CardTitle>
            <CardDescription>Step 5 of 5 — Confirm your request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
              <Row label="Topic" value={draft.topic} />
              <Row label="Objective" value={draft.strategicObjective} />
              <Row label="Audience" value={draft.targetAudience} />
              <Row label="Perspective" value={draft.narrativePerspective} />
              <Row label="Platforms" value={draft.platforms?.join(', ')} />
              <Row label="Structure" value={draft.writingStructure} />
              <Row label="CTA" value={draft.callToAction || 'None'} />
            </div>
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Advanced Options</label>
              <div className="space-y-2">
                {[
                  { key: 'enableHumanization', label: 'Enable Humanization' },
                  { key: 'enableQA', label: 'Run Editorial QA' },
                  { key: 'requireApproval', label: 'Require human approval before export' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={Boolean(draft[key as keyof typeof draft])}
                      onChange={(e) => setDraft({ [key]: e.target.checked })}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1 pt-1">
                <label className="text-sm font-medium">Special Instructions</label>
                <Textarea
                  placeholder="Any additional instructions for the AI agents..."
                  rows={2}
                  value={draft.specialInstructions ?? ''}
                  onChange={(e) => setDraft({ specialInstructions: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep(currentStep - 1)}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        {currentStep < 5 ? (
          <Button onClick={() => setStep(currentStep + 1)} disabled={!canNext()}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
            disabled={!canNext()}
          >
            <Rocket className="w-4 h-4" /> Generate Content
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 shrink-0">{label}:</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
