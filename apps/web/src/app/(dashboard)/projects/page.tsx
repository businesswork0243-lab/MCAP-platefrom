'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { formatRelative } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id:               string;
  title:            string;
  description:      string | null;
  status:           'active' | 'completed' | 'archived';
  owner_name:       string;
  client_name:      string | null;
  total_requests:   number;
  completed_count:  number;
  last_activity_at: string | null;
  updated_at:       string;
  created_at:       string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'text-green-400 bg-green-500/15 border-green-500/30'   },
  completed: { label: 'Completed', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30'      },
  archived:  { label: 'Archived',  color: 'text-gray-500 bg-gray-500/15 border-gray-500/30'      },
} as const;

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title,  setTitle]  = useState('');
  const [desc,   setDesc]   = useState('');
  const [error,  setError]  = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post('/projects', {
      title,                    // ✅ 'title' not 'name'
      description: desc || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-[#0F0F10] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">New Project</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Project Name *
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Q1 LinkedIn Campaign"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Description
              <span className="ml-1 text-gray-600">(optional)</span>
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What is this project about?"
              rows={3}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-gray-400 border border-white/10 rounded-xl hover:border-white/20 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!title.trim() || mutation.isPending}
            className="flex-1 py-2.5 text-sm text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active;
  const completionRate = project.total_requests > 0
    ? Math.round((project.completed_count / project.total_requests) * 100)
    : 0;

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="p-5 bg-white/3 border border-white/10 rounded-2xl hover:border-violet-500/30 hover:bg-white/5 transition-all group cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
                {project.title}
              </h2>
              {project.client_name && (
                <span className="text-xs px-2 py-0.5 bg-white/5 text-gray-500 rounded-full border border-white/10">
                  {project.client_name}
                </span>
              )}
            </div>

            {project.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {project.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3 text-xs text-gray-600">
              <span>{project.total_requests} pieces</span>
              <span>·</span>
              <span>By {project.owner_name}</span>
              <span>·</span>
              <span>
                {project.last_activity_at
                  ? formatRelative(project.last_activity_at)
                  : formatRelative(project.updated_at)
                }
              </span>
            </div>
          </div>

          <span className={`px-2.5 py-1 text-xs font-medium rounded-full border shrink-0 ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Progress bar */}
        {project.total_requests > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1.5">
              <span>{project.completed_count} completed</span>
              <span>{completionRate}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500/50 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'active',    label: 'Active'    },
  { value: 'completed', label: 'Completed' },
  { value: 'all',       label: 'All'       },
];

export default function ProjectsPage() {
  const [showCreate,    setShowCreate]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<string>('active');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn:  () => api.get(`/projects?status=${statusFilter}`).then(r => r.data),
    staleTime: 30_000,
  });

  const projects: Project[] = data?.projects ?? [];

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.title.toLowerCase().includes(q) ||           // ✅ title not name
      p.description?.toLowerCase().includes(q) ||
      p.client_name?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  return (
    <div className="min-h-screen bg-[#080809] text-white">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-gray-500 text-sm mt-1">
              Organize content by campaign or client
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-all"
          >
            + New Project
          </button>
        </div>

        {/* ── Filters Row ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600">
              ⌕
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  statusFilter === f.value
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Project List ── */}
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-white/3 border border-white/10 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">◈</div>
            <h3 className="text-white font-medium">
              {search ? 'No projects match your search' : 'No projects yet'}
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              {search
                ? 'Try a different search term'
                : 'Create your first project to organize content'
              }
            </p>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-6 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-all"
              >
                Create First Project →
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Count */}
        {filtered.length > 0 && (
          <p className="text-xs text-gray-700 text-center">
            Showing {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateProjectModal onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
