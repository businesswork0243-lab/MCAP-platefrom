'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Plus, Trash2 } from 'lucide-react';

const SECTIONS = ['Account', 'Organization', 'AI Preferences', 'API Access', 'Integrations'];

export default function SettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('Account');
  const [name, setName] = useState(user?.name ?? '');
  const [saved, setSaved] = useState(false);

  const { data: keysData } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/auth/api-keys').then((r) => r.data),
    enabled: activeSection === 'API Access',
  });
  const apiKeys = keysData?.keys ?? [];

  const updateMutation = useMutation({
    mutationFn: () => api.patch('/auth/me', { name }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const createKeyMutation = useMutation({
    mutationFn: () => api.post('/auth/api-keys'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/api-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-44 shrink-0">
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${activeSection === s ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'}`}
              >
                {s}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {activeSection === 'Account' && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Account Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={user?.email ?? ''} disabled />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <Input value={user?.role ?? ''} disabled />
                </div>
                <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending}>
                  {saved ? 'Saved!' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === 'AI Preferences' && (
            <Card>
              <CardHeader><CardTitle className="text-sm">AI Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Preferred AI Model</label>
                  <div className="space-y-2">
                    {[
                      { id: 'auto', label: 'Auto (Recommended)', desc: 'Best model for each task' },
                      { id: 'gpt4o', label: 'GPT-4o (OpenAI)', desc: 'Primary generation model' },
                      { id: 'claude', label: 'Claude Sonnet 4.6 (Anthropic)', desc: 'Fallback model' },
                    ].map(({ id, label, desc }) => (
                      <label key={id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                        <input type="radio" name="model" defaultChecked={id === 'auto'} className="accent-primary" />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Default Humanization Level</label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option>Light (preserve structure)</option>
                    <option selected>Medium (recommended)</option>
                    <option>Aggressive (full rewrite feel)</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'API Access' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">API Keys</CardTitle>
                <Button size="sm" onClick={() => createKeyMutation.mutate()} loading={createKeyMutation.isPending}>
                  <Plus className="w-3.5 h-3.5" /> Generate Key
                </Button>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No API keys yet</p>
                ) : (
                  <div className="divide-y">
                    {apiKeys.map((key: any) => (
                      <div key={key.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{key.prefix}••••••••</code>
                            <button onClick={() => navigator.clipboard.writeText(key.key ?? '')} className="text-muted-foreground hover:text-foreground">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Created {key.created_at?.slice(0, 10)}</p>
                        </div>
                        <button onClick={() => deleteKeyMutation.mutate(key.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === 'Integrations' && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Integrations</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'WordPress', status: 'available' },
                    { name: 'HubSpot', status: 'available' },
                    { name: 'Notion', status: 'available' },
                    { name: 'Buffer', status: 'available' },
                    { name: 'Slack', status: 'available' },
                    { name: 'Google Drive', status: 'connected' },
                  ].map(({ name, status }) => (
                    <div key={name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm font-medium">{name}</span>
                      {status === 'connected' ? (
                        <Badge variant="success">Connected</Badge>
                      ) : (
                        <Button size="sm" variant="outline">Connect</Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'Organization' && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Organization Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Company Name</label>
                  <Input defaultValue={user?.organizationName ?? ''} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Default Language</label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                </div>
                <Button>Save Changes</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
