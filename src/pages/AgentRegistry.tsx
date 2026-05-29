import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Bot, Boxes, CircleDot, ChevronRight, Database, FileText,
  GitBranch, Layers, Pause, Power, Server, Workflow, Zap,
} from 'lucide-react';

/* ============================================================
 * AgentRegistry — Paperclip-Copy in-house
 * Tree-View links · Detail-Pane rechts · Stats oben
 * Read-only Phase 1 (Phase 2 wird Runner + Edit-Forms)
 * ============================================================ */

type Status = 'active' | 'paused' | 'error' | 'archived' | 'planned';
type Runtime = 'pm2' | 'cron' | 'n8n' | 'systemd' | 'on-demand' | 'manual' | 'api-route';

interface Agent {
  id: string;
  name: string;
  role: string;
  parent_id: string | null;
  status: Status;
  model: string | null;
  runtime: Runtime;
  runtime_ref: string | null;
  trigger_type: string | null;
  project: string | null;
  account_slug: string | null;
  visible: boolean;
  last_run_at: string | null;
  last_status: string | null;
  total_runs_30d: number;
  total_cost_eur_30d: number;
  budget_cap_eur_monthly: number | null;
  child_count: number;
  budget_usage_pct: number | null;
}

interface AgentDetail {
  agent: Agent & { description: string; skills: string[]; guardrails: Record<string, any>; system_prompt_path: string | null; memory_path: string | null };
  memory: Array<{ memory_type: string; storage_kind: string; storage_ref: string; description: string | null; bytes: number | null; is_cached: boolean }>;
  relations: Array<{ from_agent_id: string; to_agent_id: string; relation_type: string; notes: string | null }>;
  runs_recent: Array<{ id: number; trigger_source: string; started_at: string; finished_at: string | null; status: string; cost_eur: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; error_message: string | null }>;
}

interface Stats {
  total: number;
  by_status: Record<Status, number>;
  by_role: Record<string, number>;
  by_project: Record<string, number>;
  cost_30d_total_eur: number;
  runs_30d_total: number;
}

const STATUS_COLOR: Record<Status, string> = {
  active:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  paused:   'text-amber-400 bg-amber-500/10 border-amber-500/30',
  error:    'text-rose-400 bg-rose-500/10 border-rose-500/30',
  archived: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
  planned:  'text-violet-400 bg-violet-500/10 border-violet-500/30',
};

const ROLE_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'orchestrator':      Server,
  'helpbot':           Bot,
  'customer-bot':      Bot,
  'background-worker': Activity,
  'workflow':          Workflow,
  'cron':              CircleDot,
  'api-route':         Zap,
};

const PROJECT_BADGE: Record<string, string> = {
  'aevum':     'bg-amber-500/10 text-amber-300 border-amber-500/30',
  'lennoxos':  'bg-rose-500/10 text-rose-300 border-rose-500/30',
  'utilityhub':'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  'gts':       'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  'ketolabs':  'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  'thailand':  'bg-orange-500/10 text-orange-300 border-orange-500/30',
  'personal':  'bg-violet-500/10 text-violet-300 border-violet-500/30',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export default function AgentRegistry() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [aRes, sRes] = await Promise.all([
          fetch('/api/registry/agents').then(r => r.json()),
          fetch('/api/registry/stats').then(r => r.json()),
        ]);
        setAgents(aRes.items || []);
        setStats(sRes);
      } catch {
        setAgents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    fetch(`/api/registry/agents/${selectedId}`).then(r => r.json()).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const projects = useMemo(() => {
    const set = new Set<string>();
    agents.forEach(a => a.project && set.add(a.project));
    return ['all', ...Array.from(set).sort()];
  }, [agents]);

  const filtered = useMemo(() => {
    return agents.filter(a => filterProject === 'all' || a.project === filterProject);
  }, [agents, filterProject]);

  const tree = useMemo(() => {
    const byParent = new Map<string | null, Agent[]>();
    filtered.forEach(a => {
      const k = a.parent_id;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(a);
    });
    return byParent;
  }, [filtered]);

  const roots = tree.get(null) || [];

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      {/* ===== Header / Stats ===== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="lx-headline text-2xl tracking-tight flex items-center gap-3">
              <Layers className="text-[var(--accent)]" size={26} />
              Agent Registry
            </h1>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mt-1">
              Paperclip-Copy · Visibility-Layer · Read-Only Phase 1
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-glow)] transition-colors flex items-center gap-1.5"
          >
            <Activity size={12} /> refresh
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatTile label="TOTAL" value={stats.total} icon={Boxes} accent="text-zinc-200" />
            <StatTile label="ACTIVE" value={stats.by_status.active || 0} icon={Power} accent="text-emerald-400" />
            <StatTile label="ERROR" value={stats.by_status.error || 0} icon={AlertTriangle} accent="text-rose-400" />
            <StatTile label="RUNS 30d" value={stats.runs_30d_total} icon={Activity} accent="text-violet-400" />
            <StatTile label="COST 30d" value={`€${stats.cost_30d_total_eur.toFixed(2)}`} icon={Zap} accent="text-amber-400" />
          </div>
        )}
      </div>

      {/* ===== Filter Tabs ===== */}
      <div className="flex flex-wrap gap-2 mb-4">
        {projects.map(p => (
          <button
            key={p}
            onClick={() => setFilterProject(p)}
            className={`px-3 py-1 rounded-md text-[11px] uppercase tracking-widest border transition-colors ${
              filterProject === p
                ? 'bg-[var(--accent)]/15 border-[var(--accent)]/40 text-[var(--accent-glow)]'
                : 'bg-[var(--surface)]/50 border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {p === 'all' ? 'all' : p}
            {p !== 'all' && stats && (
              <span className="ml-1.5 text-[10px] opacity-60">{stats.by_project[p] || 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== Main: Tree + Detail ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        {/* Tree-Pane */}
        <div className="bg-[var(--surface)]/50 border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
              {filtered.length} agents
            </span>
            <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest">
              {filterProject !== 'all' ? `· ${filterProject}` : ''}
            </span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {loading && <div className="px-3 py-4 text-[12px] text-[var(--text-muted)]">loading…</div>}
            {!loading && roots.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--text-muted)]">No agents in this filter.</div>
            )}
            {roots.map(a => (
              <TreeNode key={a.id} agent={a} tree={tree} depth={0} selectedId={selectedId} onSelect={setSelectedId} />
            ))}
          </div>
        </div>

        {/* Detail-Pane */}
        <div className="bg-[var(--surface)]/50 border border-[var(--border)] rounded-lg overflow-hidden">
          {!selectedId ? (
            <div className="h-full flex items-center justify-center text-center p-10">
              <div>
                <Bot size={32} className="mx-auto text-[var(--text-faint)] mb-3" />
                <p className="text-[12px] text-[var(--text-muted)]">Klick einen Agent links für Details</p>
                <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-widest mt-2">Memory · Skills · Relations · Recent Runs</p>
              </div>
            </div>
          ) : detail ? (
            <AgentDetailPane detail={detail} agents={agents} />
          ) : (
            <div className="px-4 py-6 text-[12px] text-[var(--text-muted)]">loading detail…</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */

function StatTile({
  label, value, icon: Icon, accent,
}: { label: string; value: number | string; icon: React.ComponentType<{ size?: number; className?: string }>; accent: string }) {
  return (
    <div className="bg-[var(--surface)]/60 border border-[var(--border)] rounded-lg p-3">
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
        <Icon size={13} className={accent} />
      </div>
      <div className={`text-xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function TreeNode({
  agent, tree, depth, selectedId, onSelect,
}: {
  agent: Agent;
  tree: Map<string | null, Agent[]>;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = tree.get(agent.id) || [];
  const Icon = ROLE_ICON[agent.role] || Bot;
  const isSelected = selectedId === agent.id;
  const statusClass = STATUS_COLOR[agent.status as Status];

  return (
    <>
      <button
        onClick={() => onSelect(agent.id)}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors ${
          isSelected ? 'bg-[var(--accent)]/15 text-[var(--text)]' : 'hover:bg-[var(--surface-hover)] text-[var(--text-muted)]'
        }`}
      >
        {children.length > 0 ? (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="flex-shrink-0 cursor-pointer"
          >
            <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <Icon size={13} className="flex-shrink-0 text-[var(--text-faint)]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] truncate">{agent.name}</span>
            {agent.status !== 'active' && (
              <span className={`px-1.5 py-px text-[9px] uppercase tracking-widest rounded border ${statusClass}`}>
                {agent.status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)] mt-0.5">
            <span className="uppercase tracking-widest">{agent.role}</span>
            <span>·</span>
            <span>{agent.runtime}</span>
            {agent.project && (
              <>
                <span>·</span>
                <span className={`px-1.5 rounded border ${PROJECT_BADGE[agent.project] || 'border-zinc-500/20'}`}>
                  {agent.project}
                </span>
              </>
            )}
          </div>
        </div>
      </button>
      {expanded && children.map(c => (
        <TreeNode key={c.id} agent={c} tree={tree} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

function AgentDetailPane({ detail, agents }: { detail: AgentDetail; agents: Agent[] }) {
  const { agent, memory, relations, runs_recent } = detail;
  const Icon = ROLE_ICON[agent.role] || Bot;

  const incomingRels = relations.filter(r => r.to_agent_id === agent.id);
  const outgoingRels = relations.filter(r => r.from_agent_id === agent.id);

  return (
    <div className="overflow-y-auto max-h-[70vh]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)]">
        <div className="flex items-start gap-3 mb-3">
          <Icon size={20} className="text-[var(--accent)] mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{agent.name}</h2>
              <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest rounded border ${STATUS_COLOR[agent.status as Status]}`}>
                {agent.status}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono">{agent.id}</p>
          </div>
        </div>
        {agent.description && (
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{agent.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className="px-5 py-4 border-b border-[var(--border)] grid grid-cols-2 gap-3 text-[11px]">
        <Meta label="Role" value={agent.role} />
        <Meta label="Runtime" value={agent.runtime} />
        <Meta label="Trigger" value={agent.trigger_type || '—'} />
        <Meta label="Model" value={agent.model || '—'} mono />
        <Meta label="Project" value={agent.project || '—'} />
        <Meta label="Account" value={agent.account_slug || '—'} />
        <Meta label="Runtime-Ref" value={agent.runtime_ref || '—'} mono />
        <Meta label="Last Run" value={timeAgo(agent.last_run_at)} />
      </div>

      {/* Skills */}
      {agent.skills && agent.skills.length > 0 && (
        <Section title="Skills" icon={Zap}>
          <div className="flex flex-wrap gap-1.5">
            {agent.skills.map(s => (
              <span key={s} className="px-2 py-0.5 text-[10px] bg-[var(--surface)]/60 border border-[var(--border)] rounded-md text-[var(--text-muted)] font-mono">
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Guardrails */}
      {agent.guardrails && Object.keys(agent.guardrails).length > 0 && (
        <Section title="Guardrails" icon={AlertTriangle}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {Object.entries(agent.guardrails).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-[11px]">
                <span className="text-[var(--text-faint)] font-mono">{k}</span>
                <span className="text-[var(--text-muted)] font-mono truncate">{Array.isArray(v) ? v.join(',') : String(v)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Memory */}
      {memory.length > 0 && (
        <Section title={`Memory (${memory.length})`} icon={Database}>
          <div className="space-y-2">
            {memory.map((m, i) => (
              <div key={i} className="p-2.5 bg-[var(--surface)]/40 border border-[var(--border)] rounded-md">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{m.memory_type}</span>
                  <div className="flex gap-1.5">
                    {m.is_cached && (
                      <span className="px-1.5 py-px text-[9px] uppercase tracking-widest rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">cached</span>
                    )}
                    <span className="px-1.5 py-px text-[9px] uppercase tracking-widest rounded border border-[var(--border)] text-[var(--text-faint)]">{m.storage_kind}</span>
                  </div>
                </div>
                <p className="text-[11px] font-mono text-[var(--text-muted)] break-all">{m.storage_ref}</p>
                {m.description && (
                  <p className="text-[11px] text-[var(--text-faint)] mt-1">{m.description}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Relations */}
      {(incomingRels.length > 0 || outgoingRels.length > 0) && (
        <Section title="Relations" icon={GitBranch}>
          <div className="space-y-1.5">
            {outgoingRels.map((r, i) => (
              <RelationRow key={`o${i}`} dir="out" rel={r} agents={agents} self={agent.id} />
            ))}
            {incomingRels.map((r, i) => (
              <RelationRow key={`i${i}`} dir="in" rel={r} agents={agents} self={agent.id} />
            ))}
          </div>
        </Section>
      )}

      {/* Recent Runs */}
      <Section title={`Recent Runs (${runs_recent.length})`} icon={Activity}>
        {runs_recent.length === 0 ? (
          <p className="text-[11px] text-[var(--text-faint)]">No runs logged yet. (Phase 2 wird Run-Tracking aktivieren.)</p>
        ) : (
          <div className="space-y-1.5">
            {runs_recent.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-2 bg-[var(--surface)]/40 border border-[var(--border)] rounded-md text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'success' ? 'bg-emerald-400' : r.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                <span className="text-[var(--text-muted)] flex-1 truncate">{r.trigger_source || 'manual'}</span>
                <span className="text-[var(--text-faint)] font-mono">{timeAgo(r.started_at)}</span>
                <span className="text-[var(--text-muted)] font-mono">€{r.cost_eur.toFixed(4)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Files */}
      {(agent.system_prompt_path || agent.memory_path) && (
        <Section title="Source Pointers" icon={FileText}>
          <div className="space-y-1 text-[11px] font-mono">
            {agent.system_prompt_path && (
              <div><span className="text-[var(--text-faint)] uppercase tracking-widest text-[10px] mr-2">sys</span><span className="text-[var(--text-muted)]">{agent.system_prompt_path}</span></div>
            )}
            {agent.memory_path && (
              <div><span className="text-[var(--text-faint)] uppercase tracking-widest text-[10px] mr-2">mem</span><span className="text-[var(--text-muted)]">{agent.memory_path}</span></div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-widest text-[var(--text-faint)]">{label}</span>
      <span className={`text-[var(--text-muted)] mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={12} className="text-[var(--text-faint)]" />
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function RelationRow({ dir, rel, agents, self }: { dir: 'in' | 'out'; rel: any; agents: Agent[]; self: string }) {
  const otherId = dir === 'out' ? rel.to_agent_id : rel.from_agent_id;
  const other = agents.find(a => a.id === otherId);
  return (
    <div className="flex items-center gap-2 p-1.5 text-[11px] text-[var(--text-muted)]">
      <span className={`text-[9px] uppercase tracking-widest font-mono ${dir === 'out' ? 'text-rose-400' : 'text-emerald-400'}`}>
        {dir === 'out' ? '→' : '←'} {rel.relation_type}
      </span>
      <span className="flex-1 truncate">{other?.name || otherId}</span>
      {rel.notes && <span className="text-[var(--text-faint)] text-[10px] truncate max-w-[40%]">{rel.notes}</span>}
    </div>
  );
}
