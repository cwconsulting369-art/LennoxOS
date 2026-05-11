import { useEffect, useState, useCallback } from 'react';
import { FolderOpen, ExternalLink, RefreshCw, Layers } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  path: string;
}

function capitalize(s: string) {
  return s
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function truncate(s: string, max = 100) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
}

function ProjectCard({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate?: (project: Project) => void;
}) {
  const isActive = project.status === 'active' || !project.status;

  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4 flex flex-col gap-3 hover:border-os-accent/40 transition-colors">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-os-accent/15">
            <Layers size={14} className="text-os-accent" />
          </div>
          <p className="text-sm font-semibold text-os-text leading-tight">
            {capitalize(project.name)}
          </p>
        </div>
        <span
          className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isActive
              ? 'bg-os-green/10 border-os-green/20 text-os-green'
              : 'bg-os-muted/10 border-os-border text-os-muted'
          }`}
        >
          {project.status || 'active'}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-os-muted leading-relaxed">
          {truncate(project.description)}
        </p>
      )}

      {/* Path badge */}
      {project.path && (
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderOpen size={11} className="text-os-muted flex-shrink-0" />
          <span className="truncate text-[10px] font-mono text-os-muted bg-os-elevated px-2 py-0.5 rounded">
            {project.path}
          </span>
        </div>
      )}

      {/* Action */}
      <button
        onClick={() => onNavigate?.(project)}
        className="mt-auto flex items-center gap-1.5 self-start rounded-lg border border-os-border px-3 py-1.5 text-xs font-medium text-os-muted hover:text-os-accent hover:border-os-accent/50 transition-colors"
      >
        <ExternalLink size={11} />
        öffnen
      </button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg bg-os-border/60" />
        <div className="h-4 w-32 rounded bg-os-border/60" />
      </div>
      <div className="h-3 w-full rounded bg-os-border/40 mb-1.5" />
      <div className="h-3 w-4/5 rounded bg-os-border/40 mb-3" />
      <div className="h-5 w-40 rounded bg-os-border/40" />
    </div>
  );
}

const FALLBACK_PROJECTS: Project[] = [
  {
    id: 'aevum',
    name: 'AEVUM',
    description:
      'Productized Agency für Hausverwaltungen und Augsburger Makler. Phase 1 aktiv — Outreach und erste Kunden.',
    status: 'active',
    path: '/home/carlos/personal-os/01-business/aevum',
  },
  {
    id: 'utilityhub',
    name: 'UtilityHub',
    description:
      'Energy-Consulting Data Hub. Next.js Dashboard, Supabase Backend, Miguel-Vertrag aktiv (10% Revenue Share).',
    status: 'active',
    path: '/home/carlos/personal-os/01-business/utility-hub',
  },
  {
    id: 'patrick-thailand',
    name: 'Patrick Thailand',
    description:
      'Real Estate Website für Patrick. Vite+React, cinematic Design, Content-Abgleich läuft. 110h Scope.',
    status: 'active',
    path: '/home/carlos/personal-os/03-pipeline/prospects/patrick-thailand',
  },
  {
    id: 'ketolabs',
    name: 'Ketolabs / Kevin',
    description:
      'DTC E-Commerce CollaGlow (€70k Meta, 20k Klaviyo). IRON Media Framework, API-Anbindungen laufen.',
    status: 'active',
    path: '/home/carlos/personal-os/03-pipeline/prospects/ketolabs',
  },
  {
    id: 'lennoxos',
    name: 'LennoxOS',
    description:
      'Self — Agentic OS. Personal-OS SSOT, Paperclip Agents, Dashboard, VPS-Stack, Automatisierungs-Layer.',
    status: 'active',
    path: '/home/carlos/personal-os',
  },
];

export default function Projects({
  onNavigate,
}: {
  onNavigate?: (project: Project) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Project[] = await res.json();
      setProjects(json.length > 0 ? json : FALLBACK_PROJECTS);
    } catch {
      // Fall back to static list on error
      setProjects(FALLBACK_PROJECTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const displayProjects = projects.length > 0 ? projects : FALLBACK_PROJECTS;

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
                  {displayProjects.length}
                </span>
              )}
            </div>
            <p className="text-xs text-os-muted">Aktive Projekte & Workstreams</p>
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

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-os-yellow/30 bg-os-yellow/10 px-4 py-3 text-sm text-os-yellow">
          API nicht erreichbar — zeige lokale Projektliste
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : displayProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {displayProjects.map((p) => (
            <ProjectCard key={p.id} project={p} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-os-border bg-os-surface p-12 text-center">
          <FolderOpen size={32} className="mx-auto mb-3 text-os-muted" />
          <p className="text-sm font-medium text-os-text">Keine Projekte gefunden</p>
          <p className="mt-1 text-xs text-os-muted">
            API unter /api/projects prüfen
          </p>
        </div>
      )}
    </div>
  );
}
