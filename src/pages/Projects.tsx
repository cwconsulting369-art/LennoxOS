import { useEffect, useState, useCallback } from 'react';
import { FolderOpen, RefreshCw, Bot, CircleDot, ExternalLink } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
  leadAgentName: string | null;
  openIssues: number;
  dashboardUrl: string | null;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  in_progress: { label: 'In Progress', cls: 'bg-os-green/10 border-os-green/20 text-os-green' },
  backlog: { label: 'Backlog', cls: 'bg-os-muted/10 border-os-border text-os-muted' },
  done: { label: 'Done', cls: 'bg-os-cyan/10 border-os-cyan/20 text-os-cyan' },
  paused: { label: 'Paused', cls: 'bg-os-yellow/10 border-os-yellow/20 text-os-yellow' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, cls: 'bg-os-muted/10 border-os-border text-os-muted' };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>
      {s.label}
    </span>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4 hover:border-os-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
            style={{ backgroundColor: project.color }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-os-text leading-tight truncate">{project.name}</p>
          </div>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-os-muted">
        {project.leadAgentName && (
          <div className="flex items-center gap-1">
            <Bot size={11} className="flex-shrink-0" />
            <span>{project.leadAgentName}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <CircleDot size={11} className="flex-shrink-0" />
          <span className={project.openIssues > 0 ? 'text-os-yellow' : 'text-os-muted'}>
            {project.openIssues} open issue{project.openIssues !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {project.dashboardUrl && (
        <a
          href={project.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-os-border bg-os-bg py-1.5 text-[10px] font-semibold text-os-muted hover:text-os-cyan hover:border-os-cyan/40 transition-colors"
        >
          <ExternalLink size={11} />
          Open Dashboard
        </a>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-3 h-3 rounded-full bg-os-border" />
        <div className="h-4 w-32 rounded bg-os-border/60" />
      </div>
      <div className="h-3 w-24 rounded bg-os-border/40" />
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Project[] = await res.json();
      setProjects(Array.isArray(json) ? json : []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const inProgress = projects.filter(p => p.status === 'in_progress');
  const backlog = projects.filter(p => p.status !== 'in_progress');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
            <FolderOpen size={18} className="text-os-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-os-text">Projekte</h1>
              {!loading && (
                <span className="rounded-full bg-os-border/60 px-2 py-0.5 text-[11px] font-medium text-os-muted">
                  {projects.length}
                </span>
              )}
            </div>
            <p className="text-xs text-os-muted">Paperclip Projects</p>
          </div>
        </div>
        <button
          onClick={() => fetchProjects(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:border-os-accent/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-os-border p-8 text-center text-sm text-os-muted">
          Keine Projekte gefunden
        </div>
      ) : (
        <>
          {inProgress.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-os-green font-semibold">In Progress</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </div>
          )}
          {backlog.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-os-muted font-semibold">Backlog</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {backlog.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
