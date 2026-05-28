import { useEffect, useState } from 'react';
import { Cpu, ChevronLeft, FileText, Clock, DollarSign, Activity, AlertCircle, BookOpen, Plus, Trash2, Save, X } from 'lucide-react';

/* ============================================================
 * HermesDashboard — neue agents+agent_runs Foundation-DB
 * List → Card-Click → Detail-View pro Agent
 * Reads /api/hermes/* routes
 * ============================================================ */

type AgentType = 'hermes-subagent' | 'custom-pre-hermes' | string;
type RunStatus = 'running' | 'success' | 'failed' | 'idle';

interface HermesAgent {
  id: string;
  slug: string;
  name: string;
  layer: string;
  agent_type: AgentType;
  status: string;
  endpoint: string;
  budget_cents_monthly: number | null;
  current_spend_cents: number;
  last_heartbeat_at: string | null;
  last_run: { started_at: string; status: RunStatus; cost_cents: number; tokens_in: number; tokens_out: number } | null;
  today_runs: number;
  today_cost_cents: number;
  today_failed: number;
}

interface CostSummary {
  today: { runs: number; success: number; failed: number; cost_cents: number; tokens: number };
  week_7d: { runs: number; success: number; failed: number; cost_cents: number; tokens: number };
  month: { runs: number; success: number; failed: number; cost_cents: number; tokens: number };
}

interface Run {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: RunStatus;
  cost_cents: number;
  tokens_in: number;
  tokens_out: number;
  model_used: string | null;
  output_summary: string | null;
  output_payload: Record<string, any> | null;
  error_message: string | null;
}

const fmtCost = (c: number) => '$' + (c / 100).toFixed(4);
const fmtTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toISOString().slice(0, 16).replace('T', ' ');
};
const statusColor = (s: RunStatus | string) => {
  if (s === 'success') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  if (s === 'failed') return 'bg-red-500/20 text-red-300 border-red-500/30';
  if (s === 'running') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  return 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30';
};

export default function HermesDashboard() {
  const [agents, setAgents] = useState<HermesAgent[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [aRes, cRes] = await Promise.all([
        fetch('/api/hermes/agents'),
        fetch('/api/hermes/cost-summary'),
      ]);
      const aData = await aRes.json();
      const cData = await cRes.json();
      setAgents(aData.items || []);
      setCostSummary(cData);
      setLoading(false);
    } catch (e) {
      console.error('hermes refresh', e);
    }
  }

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 30000);
    return () => clearInterval(i);
  }, []);

  if (selectedSlug) {
    return <AgentDetail slug={selectedSlug} onBack={() => setSelectedSlug(null)} />;
  }

  const hermes = agents.filter(a => a.agent_type === 'hermes-subagent');
  const system = agents.filter(a => a.agent_type !== 'hermes-subagent');

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <header>
        <h1 className="text-2xl font-bold text-[var(--accent)]">⚡ Hermes Agent-Schwarm</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">LennoxOS interne Agents · auto-refresh 30s</p>
      </header>

      {/* Cost Stats */}
      {costSummary && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Heute" data={costSummary.today} />
          <StatCard label="7 Tage" data={costSummary.week_7d} />
          <StatCard label="Diesen Monat" data={costSummary.month} />
        </div>
      )}

      {/* Hermes-Subagents */}
      <section>
        <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Hermes-Subagents ({hermes.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading && <div className="text-[var(--text-muted)] col-span-3">Loading...</div>}
          {hermes.map(a => <AgentCard key={a.id} agent={a} onClick={() => setSelectedSlug(a.slug)} />)}
        </div>
      </section>

      {/* System-Agents */}
      <section>
        <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">
          System-Agents ({system.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {system.map(a => <AgentCard key={a.id} agent={a} onClick={() => setSelectedSlug(a.slug)} />)}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, data }: { label: string; data: CostSummary['today'] }) {
  return (
    <div className="bg-[var(--surface)]/80 border border-[var(--border)] rounded p-4">
      <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-2xl font-mono">{fmtCost(data.cost_cents)}</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">
        {data.runs} runs · ✓{data.success} {data.failed > 0 && <span className="text-red-400">· ✗{data.failed}</span>}
      </div>
    </div>
  );
}

function AgentCard({ agent, onClick }: { agent: HermesAgent; onClick: () => void }) {
  const lastStatus = agent.last_run?.status || 'idle';
  return (
    <div
      onClick={onClick}
      className="bg-[var(--surface)]/80 border border-[var(--border)] hover:border-[var(--accent)]/50 rounded p-3 cursor-pointer transition-colors"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-bold text-sm flex items-center gap-1.5">
            <Cpu size={14} className="text-[var(--accent)]" />
            {agent.slug}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">{agent.agent_type}</div>
        </div>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${statusColor(lastStatus)}`}>
          {lastStatus}
        </span>
      </div>
      <div className="text-xs text-[var(--text-muted)] space-y-0.5">
        <div className="flex justify-between">
          <span>Last:</span>
          <span>{fmtTime(agent.last_run?.started_at || null)}</span>
        </div>
        <div className="flex justify-between">
          <span>Today:</span>
          <span>{agent.today_runs} runs · {fmtCost(agent.today_cost_cents)}</span>
        </div>
        {agent.today_failed > 0 && (
          <div className="flex items-center gap-1 text-red-400">
            <AlertCircle size={12} />
            <span>{agent.today_failed} failed</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface AgentDetailData {
  agent: HermesAgent & { created_at: string; config: Record<string, any> };
  stats: { today: any; week_7d: any };
  last_run: Run | null;
}

function AgentDetail({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [detail, setDetail] = useState<AgentDetailData | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [reports, setReports] = useState<Array<{ filename: string; size: number; mtime: string }>>([]);
  const [tab, setTab] = useState<'overview' | 'prompt' | 'knowledge' | 'runs' | 'reports'>('overview');

  useEffect(() => {
    (async () => {
      try {
        const [d, r, p, rep] = await Promise.all([
          fetch(`/api/hermes/agents/${slug}`).then(x => x.json()),
          fetch(`/api/hermes/agents/${slug}/runs?limit=30`).then(x => x.json()),
          fetch(`/api/hermes/agents/${slug}/prompt`).then(x => x.json()).catch(() => null),
          fetch('/api/hermes/reports?limit=100').then(x => x.json()),
        ]);
        setDetail(d);
        setRuns(r.items || []);
        setPrompt(p?.content || null);
        // Filter reports for this agent (filename starts with agent-name)
        const agentName = slug.replace(/^hermes-/, '');
        setReports((rep.items || []).filter((f: any) => f.filename.startsWith(agentName + '-')));
      } catch (e) {
        console.error('agent detail', e);
      }
    })();
  }, [slug]);

  if (!detail) return <div className="p-6 text-[var(--text-muted)]">Loading {slug}...</div>;

  const a = detail.agent;
  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--accent)]">
        <ChevronLeft size={16} /> Zurück
      </button>

      <header className="border-b border-[var(--border)] pb-4">
        <h1 className="text-2xl font-bold text-[var(--accent)] flex items-center gap-2">
          <Cpu size={22} /> {a.slug}
        </h1>
        <div className="text-sm text-[var(--text-muted)] mt-1">
          {a.name} · {a.agent_type} · layer={a.layer}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1 font-mono">
          endpoint: <code className="text-zinc-300">{a.endpoint}</code>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--surface)]/80 border border-[var(--border)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1"><Activity size={12} /> Heute</div>
          <div className="text-lg font-mono">{detail.stats.today.runs} runs · {fmtCost(detail.stats.today.cost_cents)}</div>
          {detail.stats.today.failed > 0 && <div className="text-xs text-red-400">✗ {detail.stats.today.failed} failed</div>}
        </div>
        <div className="bg-[var(--surface)]/80 border border-[var(--border)] rounded p-3">
          <div className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1"><DollarSign size={12} /> 7 Tage</div>
          <div className="text-lg font-mono">{detail.stats.week_7d.runs} runs · {fmtCost(detail.stats.week_7d.cost_cents)}</div>
          <div className="text-xs text-[var(--text-muted)]">{detail.stats.week_7d.tokens.toLocaleString()} tokens</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        {(['overview', 'prompt', 'knowledge', 'runs', 'reports'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs uppercase tracking-wide ${tab === t ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {tab === 'overview' && (
          <div className="bg-[var(--surface)]/80 border border-[var(--border)] rounded p-4 text-sm space-y-2">
            <div><span className="text-[var(--text-muted)]">Status:</span> {a.status}</div>
            <div><span className="text-[var(--text-muted)]">Created:</span> {new Date(a.created_at).toISOString().slice(0, 16).replace('T', ' ')}</div>
            <div><span className="text-[var(--text-muted)]">Budget cap:</span> {a.budget_cents_monthly ? fmtCost(a.budget_cents_monthly) + '/Mo' : 'none'}</div>
            <div><span className="text-[var(--text-muted)]">Current spend:</span> {fmtCost(a.current_spend_cents)}</div>
            <div><span className="text-[var(--text-muted)]">Last heartbeat:</span> {fmtTime(a.last_heartbeat_at)}</div>
            {detail.last_run && (
              <div className="mt-3 pt-3 border-t border-[var(--border)]">
                <div className="text-xs text-[var(--text-muted)] mb-1">Last Run</div>
                <div className="font-mono text-xs">
                  {fmtTime(detail.last_run.started_at)} · <span className={`px-1.5 py-0.5 rounded border ${statusColor(detail.last_run.status)}`}>{detail.last_run.status}</span> · {fmtCost(detail.last_run.cost_cents || 0)}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'prompt' && (
          <div className="bg-[var(--surface)]/80 border border-[var(--border)] rounded p-4">
            {prompt ? (
              <pre className="text-xs whitespace-pre-wrap font-mono text-zinc-200">{prompt}</pre>
            ) : (
              <div className="text-[var(--text-muted)] text-sm">No PROMPT.md for this agent (not a Hermes-Subagent)</div>
            )}
          </div>
        )}

        {tab === 'knowledge' && <KnowledgeBrowser slug={slug} />}

        {tab === 'runs' && (
          <div className="space-y-1">
            {runs.length === 0 && <div className="text-[var(--text-muted)] text-sm">No runs yet</div>}
            {runs.map(r => (
              <div key={r.id} className="bg-[var(--surface)]/80 border border-[var(--border)] rounded p-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-muted)]">{fmtTime(r.started_at)}</span>
                  <span className={`px-1.5 py-0.5 rounded border ${statusColor(r.status)}`}>{r.status}</span>
                  <span className="text-[var(--text-muted)]">{fmtCost(r.cost_cents || 0)}</span>
                  <span className="text-[var(--text-muted)]">{(r.tokens_in || 0) + (r.tokens_out || 0)} tok</span>
                </div>
                {r.output_summary && (
                  <div className="text-zinc-400 mt-1 line-clamp-2">{r.output_summary.slice(0, 200)}</div>
                )}
                {r.error_message && (
                  <div className="text-red-400 mt-1">{r.error_message.slice(0, 200)}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-1">
            {reports.length === 0 && <div className="text-[var(--text-muted)] text-sm">No reports for this agent</div>}
            {reports.map(f => (
              <ReportRow key={f.filename} filename={f.filename} mtime={f.mtime} size={f.size} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportRow({ filename, mtime, size }: { filename: string; mtime: string; size: number }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  async function loadContent() {
    if (content) { setOpen(!open); return; }
    const r = await fetch(`/api/hermes/reports/${filename}`);
    setContent(await r.text());
    setOpen(true);
  }

  return (
    <div className="bg-[var(--surface)]/80 border border-[var(--border)] rounded">
      <div onClick={loadContent} className="p-2 cursor-pointer hover:bg-[var(--surface)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[var(--accent)]" />
          <span className="text-xs font-mono">{filename}</span>
        </div>
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
          <Clock size={11} /> {fmtTime(mtime)} · {(size / 1024).toFixed(1)}KB
        </div>
      </div>
      {open && content && (
        <pre className="text-xs whitespace-pre-wrap font-mono p-3 border-t border-[var(--border)] text-zinc-200 max-h-96 overflow-y-auto">{content}</pre>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// KnowledgeBrowser — file-browser + upload + delete per agent
// ─────────────────────────────────────────────────────────────────────────

interface KnowledgeFile { filename: string; size: number; mtime: string }
interface KnowledgeData { coaching: KnowledgeFile[]; research: KnowledgeFile[]; learnings: KnowledgeFile[] }

function KnowledgeBrowser({ slug }: { slug: string }) {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [adding, setAdding] = useState<'coaching' | 'research' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch(`/api/hermes/agents/${slug}/knowledge`);
    setData(await r.json());
  }

  useEffect(() => { refresh(); }, [slug]);

  async function handleDelete(category: string, filename: string) {
    if (!confirm(`Delete ${filename}?`)) return;
    const r = await fetch(`/api/hermes/agents/${slug}/knowledge/${category}/${filename}`, { method: 'DELETE' });
    if (!r.ok) setError(`Delete failed: ${r.status}`);
    refresh();
  }

  async function handleUpload(category: string, filename: string, content: string) {
    setError(null);
    if (!filename.endsWith('.md')) filename = filename + '.md';
    const r = await fetch(`/api/hermes/agents/${slug}/knowledge/${category}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setError(e.error || `Upload failed: ${r.status}`);
      return;
    }
    setAdding(null);
    refresh();
  }

  if (!data) return <div className="text-[var(--text-muted)] text-sm">Loading knowledge...</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-xs px-3 py-2 rounded">{error}</div>
      )}

      <KnowledgeSection
        slug={slug} category="coaching" label="Coaching (manuell)"
        files={data.coaching} canAdd={true}
        onAddClick={() => setAdding('coaching')} onDelete={handleDelete}
      />
      <KnowledgeSection
        slug={slug} category="research" label="Research (deep-research output)"
        files={data.research} canAdd={true}
        onAddClick={() => setAdding('research')} onDelete={handleDelete}
      />
      <KnowledgeSection
        slug={slug} category="learnings" label="Learnings (auto post-run)"
        files={data.learnings} canAdd={false}
        onAddClick={() => {}} onDelete={handleDelete}
      />

      {adding && (
        <UploadDialog
          category={adding}
          onCancel={() => setAdding(null)}
          onSave={(fn, body) => handleUpload(adding, fn, body)}
        />
      )}
    </div>
  );
}

function KnowledgeSection({
  slug, category, label, files, canAdd, onAddClick, onDelete,
}: {
  slug: string; category: string; label: string; files: KnowledgeFile[];
  canAdd: boolean; onAddClick: () => void; onDelete: (cat: string, fn: string) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-1.5">
          <BookOpen size={12} /> {label} ({files.length})
        </h3>
        {canAdd && (
          <button
            onClick={onAddClick}
            className="text-xs px-2 py-1 bg-[var(--accent)]/20 hover:bg-[var(--accent)]/40 text-[var(--accent)] rounded border border-[var(--accent)]/30 flex items-center gap-1"
          >
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      {files.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] italic px-2">— leer —</div>
      ) : (
        <div className="space-y-1">
          {files.map(f => (
            <KnowledgeFileRow
              key={f.filename} slug={slug} category={category} file={f}
              onDelete={() => onDelete(category, f.filename)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeFileRow({
  slug, category, file, onDelete,
}: { slug: string; category: string; file: KnowledgeFile; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  async function toggle() {
    if (content) { setOpen(!open); return; }
    const r = await fetch(`/api/hermes/agents/${slug}/knowledge/${category}/${file.filename}`);
    const d = await r.json();
    setContent(d.content || '');
    setOpen(true);
  }

  return (
    <div className="bg-[var(--surface)]/80 border border-[var(--border)] rounded">
      <div className="p-2 flex items-center justify-between gap-2">
        <div onClick={toggle} className="cursor-pointer flex items-center gap-2 flex-1 min-w-0">
          <FileText size={14} className="text-[var(--accent)] flex-shrink-0" />
          <span className="text-xs font-mono truncate">{file.filename}</span>
        </div>
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 flex-shrink-0">
          <span>{fmtTime(file.mtime)} · {(file.size / 1024).toFixed(1)}KB</span>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400 hover:text-red-300">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {open && content !== null && (
        <pre className="text-xs whitespace-pre-wrap font-mono p-3 border-t border-[var(--border)] text-zinc-200 max-h-96 overflow-y-auto">{content}</pre>
      )}
    </div>
  );
}

function UploadDialog({
  category, onCancel, onSave,
}: { category: string; onCancel: () => void; onSave: (filename: string, content: string) => void }) {
  const [filename, setFilename] = useState('');
  const [content, setContent] = useState('');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded max-w-2xl w-full">
        <div className="px-4 py-3 border-b border-[var(--border)] flex justify-between items-center">
          <span className="text-sm font-bold text-[var(--accent)]">Add to {category}</span>
          <button onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">Filename (without .md)</label>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value.replace(/[^a-z0-9-_]/gi, '-'))}
              placeholder="hormozi-pricing"
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] block mb-1">Content (Markdown, max 200KB)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Title&#10;&#10;Your content here..."
              rows={14}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono"
            />
            <div className="text-xs text-[var(--text-muted)] mt-1">{content.length}/200000 chars</div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-[var(--border)] rounded">Cancel</button>
          <button
            onClick={() => filename && content && onSave(filename, content)}
            disabled={!filename || !content}
            className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded flex items-center gap-1 disabled:opacity-50"
          >
            <Save size={12} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
