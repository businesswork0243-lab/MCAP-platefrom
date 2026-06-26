'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Search } from 'lucide-react';
import { formatRelative } from '@/lib/utils';

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then((r) => r.data),
  });
  const projects = data?.projects ?? [];

  const createMutation = useMutation({
    mutationFn: () => api.post('/projects', { name: newName, description: newDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    },
  });

  const filtered = projects.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold text-sm">New Project</h2>
            <Input placeholder="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!newName}>Create</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No projects yet</p>
          <Button className="mt-3" onClick={() => setShowCreate(true)}>Create your first project</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((project: any) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="font-semibold">{project.name}</h2>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {project.content_count ?? 0} content pieces · Updated {formatRelative(project.updated_at)}
                      </p>
                    </div>
                    <Badge variant="secondary">{project.status ?? 'active'}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
