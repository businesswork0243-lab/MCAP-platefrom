'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

const TONE_DIMS = ['formality', 'technicalDepth', 'confidence', 'emotionalIntensity', 'humor', 'storytelling', 'persuasiveness', 'assertiveness'];

function ToneSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground capitalize">{label.replace(/([A-Z])/g, ' $1')}</span>
        <span className="font-medium">{value}</span>
      </div>
      <input type="range" min={1} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5" />
    </div>
  );
}

const defaultTone = Object.fromEntries(TONE_DIMS.map((d) => [d, 5]));

export default function BrandPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ name: '', missionStatement: '', tone: { ...defaultTone }, bannedPhrases: [], preferredTerms: [] });
  const [tagInput, setTagInput] = useState('');
  const [bannedInput, setBannedInput] = useState('');

  const { data } = useQuery({
    queryKey: ['brand-profiles'],
    queryFn: () => api.get('/brand').then((r) => r.data),
  });
  const profiles = data?.profiles ?? [];

  const saveMutation = useMutation({
    mutationFn: () => editing
      ? api.put(`/brand/${editing.id}`, form)
      : api.post('/brand', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-profiles'] });
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', missionStatement: '', tone: { ...defaultTone }, bannedPhrases: [], preferredTerms: [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/brand/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brand-profiles'] }),
  });

  const openEdit = (profile: any) => {
    setEditing(profile);
    setForm({ name: profile.name, missionStatement: profile.mission_statement, tone: profile.tone_settings ?? { ...defaultTone }, bannedPhrases: profile.banned_phrases ?? [], preferredTerms: profile.preferred_terms ?? [] });
    setShowForm(true);
  };

  const addTag = (field: 'preferredTerms' | 'bannedPhrases', value: string, reset: () => void) => {
    if (!value.trim()) return;
    setForm((f: any) => ({ ...f, [field]: [...(f[field] ?? []), value.trim()] }));
    reset();
  };

  const removeTag = (field: 'preferredTerms' | 'bannedPhrases', idx: number) => {
    setForm((f: any) => ({ ...f, [field]: f[field].filter((_: any, i: number) => i !== idx) }));
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brand Profiles</h1>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> New Profile
        </Button>
      </div>

      {/* Profile list */}
      {!showForm && (
        <div className="grid gap-3">
          {profiles.length === 0 && (
            <div className="text-center py-14 text-muted-foreground">
              <p>No brand profiles yet</p>
              <Button className="mt-3" onClick={() => setShowForm(true)}>Create your first profile</Button>
            </div>
          )}
          {profiles.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{p.name}</h2>
                    {p.is_default && <Badge variant="secondary">Default</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{p.mission_statement}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Brand form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editing ? 'Edit Brand Profile' : 'New Brand Profile'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Identity */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Identity</h3>
              <Input placeholder="Brand Name *" value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} />
              <Textarea placeholder="Mission Statement" rows={2} value={form.missionStatement} onChange={(e) => setForm((f: any) => ({ ...f, missionStatement: e.target.value }))} />
            </div>

            {/* Tone */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Voice & Tone</h3>
              <div className="space-y-3">
                {TONE_DIMS.map((dim) => (
                  <ToneSlider key={dim} label={dim} value={form.tone?.[dim] ?? 5}
                    onChange={(v) => setForm((f: any) => ({ ...f, tone: { ...f.tone, [dim]: v } }))} />
                ))}
              </div>
            </div>

            {/* Preferred terms */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Preferred Terms</h3>
              <div className="flex gap-2">
                <Input placeholder="Add term..." value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addTag('preferredTerms', tagInput, () => setTagInput('')); e.preventDefault(); } }} />
                <Button size="sm" variant="outline" onClick={() => addTag('preferredTerms', tagInput, () => setTagInput(''))}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(form.preferredTerms ?? []).map((t: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full">
                    {t} <button onClick={() => removeTag('preferredTerms', i)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Banned phrases */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Banned Phrases</h3>
              <div className="flex gap-2">
                <Input placeholder="e.g. game-changing, leverage..." value={bannedInput} onChange={(e) => setBannedInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { addTag('bannedPhrases', bannedInput, () => setBannedInput('')); e.preventDefault(); } }} />
                <Button size="sm" variant="outline" onClick={() => addTag('bannedPhrases', bannedInput, () => setBannedInput(''))}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(form.bannedPhrases ?? []).map((t: string, i: number) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-full">
                    {t} <button onClick={() => removeTag('bannedPhrases', i)}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!form.name}>
                Save Profile
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
