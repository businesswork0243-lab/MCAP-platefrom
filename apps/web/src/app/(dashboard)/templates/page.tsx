'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { useContentStore } from '@/store/content';
import { useRouter } from 'next/navigation';

const LIBRARY_TEMPLATES = [
  { id: 'exec-thought', name: 'Executive Thought Leadership', platforms: 'LinkedIn + Blog + Newsletter', structure: 'Thesis', industries: ['B2B', 'Consulting'], emoji: '📊' },
  { id: 'product-launch', name: 'Product Launch Announcement', platforms: 'All Platforms', structure: 'Story', industries: ['SaaS', 'Startup'], emoji: '🚀' },
  { id: 'research-content', name: 'Research to Content', platforms: 'LinkedIn + X Thread + Blog', structure: 'Data Driven', industries: ['Research'], emoji: '📖' },
  { id: 'founder-story', name: 'Founder Story', platforms: 'LinkedIn + Blog', structure: 'Story', industries: ['Startup', 'Creator'], emoji: '💡' },
  { id: 'agency-client', name: 'Agency Client Content', platforms: 'All Platforms', structure: 'Thesis', industries: ['Agency'], emoji: '🎯' },
];

const STRUCTURE_COLORS: Record<string, any> = {
  'Thesis': 'default', 'Story': 'secondary', 'Data Driven': 'success', 'Debate': 'warning',
};

export default function TemplatesPage() {
  const router = useRouter();
  const { setDraft, setStep } = useContentStore();
  const [tab, setTab] = useState<'library' | 'my' | 'team'>('library');
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['my-templates'],
    queryFn: () => api.get('/templates').then((r) => r.data),
    enabled: tab !== 'library',
  });
  const myTemplates = data?.templates ?? [];

  const useTemplate = (tpl: typeof LIBRARY_TEMPLATES[0]) => {
    setDraft({ writingStructure: tpl.structure.toLowerCase().replace(' ', '_') });
    setStep(1);
    router.push('/content/new');
  };

  const filtered = LIBRARY_TEMPLATES.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">Templates</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(['library', 'my', 'team'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize ${tab === t ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'library' ? 'Template Library' : t === 'my' ? 'My Templates' : 'Team Templates'}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {tab === 'library' && (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((tpl) => (
            <Card key={tpl.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{tpl.emoji}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{tpl.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{tpl.platforms}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <Badge variant={STRUCTURE_COLORS[tpl.structure] ?? 'outline'} className="text-xs">{tpl.structure}</Badge>
                    {tpl.industries.map((ind) => (
                      <Badge key={ind} variant="outline" className="text-xs">{ind}</Badge>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="w-full" onClick={() => useTemplate(tpl)}>
                  Use Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab !== 'library' && (
        <div className="text-center py-14 text-muted-foreground">
          <p className="text-sm">No {tab} templates yet</p>
          <p className="text-xs mt-1">Save any content request as a template from the workspace</p>
        </div>
      )}
    </div>
  );
}
