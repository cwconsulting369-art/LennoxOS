import { useState, useEffect, useCallback } from 'react';
import { Bot, DollarSign, Zap, Search, RefreshCw, Activity } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  budgetPerMonth: number;
  status: 'active' | 'idle' | 'disabled';
  issuesCount: number;
  lastActive: string | null;
}

type StatusFilter = 'All' | 'Active' | 'Idle' | 'Disabled';

const MODEL_STYLE: Record<string, { label: string; color: string; dot: string }> = {
  'claude-sonnet-4-6': {
    label: 'Sonnet 4.6',
    color: 'text-purple-400 border-purple-400/40 bg-purple-400/10',
    dot: 'bg-purple-400',
  },
  'claude-opus-4-7': {
    label: 'Opus 4.7',
    color: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
    dot: 'bg-orange-400',
  },
  'claude-haiku-4-5': {
    label: 'Haiku 4.5',
    color: 'text-os-green border-os-green/40 bg-os-green/10',
    dot: 'bg-os-green',
  },
  'gpt-4.1': {
    label: 'GPT-4.1',
    color: 'text-os-blue border-os-blue/40 bg-os-blue/10',
    dot: 'bg-os-blue',
  },
  'gpt-4.1-mini': {
    label: 'GPT-4.1 Mini',
    color: 'text-sky-400 border-sky-400/40 bg-sky-400/10',
    dot: 'bg-sky-400',
  },
};

const MODEL_FALLBACK = {
  label: 'Unknown',
  color: 'text-os-muted border-os-muted/40 bg-os-muted/10',
  dot: 'bg-os-muted',
};

const STATUS_DOT: Record<Agent['status'], string> = {
  active: 'bg-os-green',
  idle: 'bg-os-yellow',
  disabled: 'bg-os-muted',
};

const STATUS_LABEL: Record<Agent['status'], string> = {
  active: 'text-os-green',
  idle: 'text-os-yellow',
  disabled: 'text-os-muted',
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getModelStyle(model: string) {
  const key = Object.keys(MODEL_STYLE).find(
    (k) => model?.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(model?.toLowerCase())
  );
  return key ? MODEL_STYLE[key] : { ...MODEL_FALLBACK, label: model || 'Unknown' };
}

function formatBudget(cents: number): string {
  return `$${cents}`;
}

export default function AgentControl() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [spin, setSpin] = useState(false);
  const [addClicked, setAddClicked] = useState(false);

  const fetchAgents = useCallback(async () => {
    setSpin(true);
    setError(null);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Agent[] = await res.json();
      setAgents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents');
    } finally {
      setLoading(false);
      setSpin(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const filtered = agents.filter((a) => {
    const matchSearch =
      search === '' ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()) ||
      a.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'All' ||
      (filter === 'Active' && a.status === 'active') ||
      (filter === 'Idle' && a.status === 'idle') ||
      (filter === 'Disabled' && a.status === 'disabled');
    return matchSearch && matchFilter;
  });

  const totalBudget = agents.reduce((sum, a) => sum + (a.budgetPerMonth ?? 0), 0);
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const idleCount = agents.filter((a) => a.status === 'idle').length;

  // Budget by model
  const budgetByModel: Record<string, number> = {};
  for (const agent of agents) {
    const key = agent.model || 'unknown';
    budgetByModel[key] = (budgetByModel[key] ?? 0) + (agent.budgetPerMonth ?? 0);
  }

  const FILTERS: StatusFilter[] = ['All', 'Active', 'Idle', 'Disabled'];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={20} className="text-os-accent" />
          <h1 className="text-lg font-semibold text-os-text">Agent Control</h1>
          <span className="text-[11px] text-os-muted">Paperclip · {agents.length} agents</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setAddClicked(true)}
              onBlur={() => setAddClicked(false)}
              className="flex items-center gap-1.5 rounded-lg border border-os-accent/40 bg-os-accent/10 px-3 py-1.5 text-xs text-os-accent hover:bg-os-accent/20 transition-colors"
            >
              <Zap size={12} />
              Add Agent
            </button>
            {addClicked && (
              <div className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-os-border bg-os-elevated px-3 py-2 text-[11px] text-os-muted whitespace-nowrap shadow-lg">
                Kommt bald
              </div>
            )}
          </div>
          <button
            onClick={fetchAgents}
            className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors"
          >
            <RefreshCw size={12} className={spin ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot size={14} className="text-os-muted" />
            <p className="text-[11px] text-os-muted">Total Agents</p>
          </div>
          <p className="text-2xl font-bold text-os-text">{loading ? '—' : agents.length}</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-os-green" />
            <p className="text-[11px] text-os-muted">Active</p>
          </div>
          <p className="text-2xl font-bold text-os-green">{loading ? '—' : activeCount}</p>
          <p className="text-[11px] text-os-muted mt-1">{idleCount} idle</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-os-yellow" />
            <p className="text-[11px] text-os-muted">Monthly Budget</p>
          </div>
          <p className="text-2xl font-bold text-os-yellow">{loading ? '—' : `$${totalBudget}`}</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-os-accent" />
            <p className="text-[11px] text-os-muted">By Model</p>
          </div>
          {loading ? (
            <div className="h-4 w-24 rounded bg-os-border animate-pulse" />
          ) : (
            <div className="space-y-1">
              {Object.entries(budgetByModel).map(([model, budget]) => {
                const style = getModelStyle(model);
                return (
                  <div key={model} className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${style.color}`}>
                      {style.label}
                    </span>
                    <span className="text-[11px] text-os-muted">${budget}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">
          {error}
        </div>
      )}

      {/* Search + Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-os-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="w-full rounded-lg border border-os-border bg-os-surface pl-9 pr-4 py-2 text-sm text-os-text placeholder:text-os-muted focus:outline-none focus:border-os-accent/60"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-os-border bg-os-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-os-elevated text-os-text border border-os-border'
                  : 'text-os-muted hover:text-os-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-os-border">
              {['Agent', 'Model', 'Role', 'Status', 'Issues', 'Budget/Mo', 'Last Active'].map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-os-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-os-border/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 rounded bg-os-border animate-pulse" style={{ width: `${40 + j * 10}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[11px] text-os-muted">
                  No agents match your search
                </td>
              </tr>
            ) : (
              filtered.map((agent) => {
                const modelStyle = getModelStyle(agent.model);
                return (
                  <tr
                    key={agent.id}
                    className="border-b border-os-border/50 hover:bg-os-elevated/50 transition-colors"
                  >
                    {/* Agent */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-os-accent/10 border border-os-accent/20 flex items-center justify-center shrink-0">
                          <Bot size={13} className="text-os-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-os-text">{agent.name}</p>
                          <p className="text-[10px] text-os-muted font-mono">{agent.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Model */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${modelStyle.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${modelStyle.dot}`} />
                        {modelStyle.label}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-os-text">{agent.role}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[agent.status]}`} />
                        <span className={`text-[12px] font-medium capitalize ${STATUS_LABEL[agent.status]}`}>
                          {agent.status}
                        </span>
                      </div>
                    </td>

                    {/* Issues */}
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-os-text">{agent.issuesCount ?? 0}</span>
                    </td>

                    {/* Budget */}
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-semibold text-os-text">
                        {formatBudget(agent.budgetPerMonth ?? 0)}
                      </span>
                    </td>

                    {/* Last Active */}
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-os-muted">{relativeTime(agent.lastActive)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-[11px] text-os-muted text-right">
          Showing {filtered.length} of {agents.length} agents · Auto-refresh every 30s
        </p>
      )}
    </div>
  );
}
