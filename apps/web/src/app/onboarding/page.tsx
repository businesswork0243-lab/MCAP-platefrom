'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';

const STEPS = ['Your Organization', 'Brand Profile', 'Writing Preferences', 'Invite Team'];
const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Consulting', 'Marketing', 'Media', 'Research', 'Legal', 'Other'];
const TEAM_SIZES = ['Just me', '2-10', '11-50', '51-200', '200+'];
const USE_CASES = ['Thought leadership', 'Product marketing', 'Content agency', 'Research publishing', 'Social media', 'Other'];
const PLATFORMS = [
  { id: 'linkedin_post', label: 'LinkedIn Posts' },
  { id: 'linkedin_article', label: 'LinkedIn Articles' },
  { id: 'x_post', label: 'X/Twitter Posts' },
  { id: 'x_thread', label: 'X Threads' },
  { id: 'blog_post', label: 'Blog Posts' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'landing_page', label: 'Landing Pages' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    industry: '', teamSize: '', useCase: '',
    brandName: '', missionStatement: '',
    formality: 7, technicalDepth: 5, confidence: 8, emotionalIntensity: 3,
    platforms: [] as string[], language: 'English',
    inviteEmails: ['', '', '', '', ''],
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: () => api.post('/auth/onboarding', form),
    onSuccess: () => router.push('/dashboard'),
  });

  const togglePlatform = (id: string) => {
    const curr = form.platforms;
    set('platforms', curr.includes(id) ? curr.filter((p) => p !== id) : [...curr, id]);
  };

  const canNext = () => {
    if (step === 1) return !!form.industry && !!form.teamSize;
    if (step === 2) return !!form.brandName;
    if (step === 3) return form.platforms.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold">MCAP</span>
          </div>
          <h1 className="text-2xl font-bold">Let's set you up</h1>
          <p className="text-muted-foreground text-sm mt-1">Step {step} of {STEPS.length}</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {STEPS.map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full transition-all', i < step ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step - 1]}</CardTitle>
            <CardDescription>Step {step} of {STEPS.length}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1 */}
            {step === 1 && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Industry *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {INDUSTRIES.map((ind) => (
                      <button key={ind} onClick={() => set('industry', ind)}
                        className={cn('px-3 py-2 text-xs rounded-lg border transition-all', form.industry === ind ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-accent')}>
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Team Size *</label>
                  <div className="flex gap-2">
                    {TEAM_SIZES.map((s) => (
                      <button key={s} onClick={() => set('teamSize', s)}
                        className={cn('flex-1 py-2 text-xs rounded-lg border transition-all', form.teamSize === s ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-accent')}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Primary Use Case</label>
                  <div className="grid grid-cols-2 gap-2">
                    {USE_CASES.map((u) => (
                      <button key={u} onClick={() => set('useCase', u)}
                        className={cn('px-3 py-2 text-xs rounded-lg border text-left transition-all', form.useCase === u ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-accent')}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Brand Name *</label>
                  <Input placeholder="Your brand or company name" value={form.brandName} onChange={(e) => set('brandName', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Mission Statement</label>
                  <Textarea placeholder="What does your brand stand for?" rows={3} value={form.missionStatement} onChange={(e) => set('missionStatement', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Brand Tone</label>
                  {[
                    { key: 'formality', label: 'Formality' },
                    { key: 'technicalDepth', label: 'Technical Depth' },
                    { key: 'confidence', label: 'Confidence' },
                    { key: 'emotionalIntensity', label: 'Emotional Intensity' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-36">{label}</span>
                      <input type="range" min={1} max={10} value={form[key as keyof typeof form] as number}
                        onChange={(e) => set(key, Number(e.target.value))} className="flex-1 accent-primary h-1.5" />
                      <span className="text-xs font-medium w-4">{form[key as keyof typeof form]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preferred Platforms *</label>
                  <div className="space-y-2">
                    {PLATFORMS.map(({ id, label }) => (
                      <label key={id} className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" className="accent-primary" checked={form.platforms.includes(id)}
                          onChange={() => togglePlatform(id)} />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 pt-2">
                  <label className="text-sm font-medium">Default Language</label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.language} onChange={(e) => set('language', e.target.value)}>
                    {['English', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese'].map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Invite up to 5 team members (optional)</p>
                {form.inviteEmails.map((email, i) => (
                  <Input key={i} type="email" placeholder={`colleague${i + 1}@company.com`} value={email}
                    onChange={(e) => {
                      const updated = [...form.inviteEmails];
                      updated[i] = e.target.value;
                      set('inviteEmails', updated);
                    }} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 1}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>Skip</Button>
              <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
                <Check className="w-4 h-4" /> Finish Setup
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
