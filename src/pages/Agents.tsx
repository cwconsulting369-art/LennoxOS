import { useState, useEffect } from 'react';
import { Bot, Search, DollarSign, RefreshCw, Zap, ChevronRight } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  role: string;
  title?: string | null;
  model?: string;
  status: string;
  reportsTo?: string | null;
  budgetMonthlyCents?: number;
  budgetPerMonth?: number;
  issuesCount?: number;
  lastHeartbeatAt?: string | null;
}

const STATUS_DOT: Record<string, string> = {
  running: 'bg-os-green',
  active: 'bg-os-green',
  idle: 'bg-os-muted',
  disabled: 'bg-os-muted/30',
};

const MODEL_COLOR: Record<string, string> = {
  'claude-sonnet-4-6': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'claude-opus-4-7': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'claude-haiku-4-5': 'bg-green-500/10 text-green-400 border-green-500/20',
  'gpt-4.1': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'gpt-4.1-mini': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

const MODEL_LABEL: Record<string, string> = {
  'claude-sonnet-4-6': 'Sonnet',
  'claude-opus-4-7': 'Opus',
  'claude-haiku-4-5': 'Haiku',
  'gpt-4.1': 'GPT-4.1',
  'gpt-4.1-mini': 'GPT-mini',
};

function budgetDollars(agent: Agent): number {
  if (agent.budgetMonthlyCents) return agent.budgetMonthlyCents / 100;
  return agent.budgetPerMonth ?? 0;
}

function AgentRow({
  agent,
  depth,
  children,
}: {
  agent: Agent;
  depth: number;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = !!children;
  const statusKey = agent.status?.toLowerCase() ?? 'idle';
  const dotColor = STATUS_DOT[statusKey] ?? 'bg-os-muted';
  const budget = budgetDollars(agent);

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-os-surface/60 transition-colors ${depth === 0 ? 'border border-os-border bg-os-surface mb-1' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        {/* Expand/Collapse toggle */}
        {hasChildren ? (
          <button
            onClick={() => setOpen(v => !v)}
            className="flex-shrink-0 text-os-muted hover:text-os-text transition-colors"
          >
            <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />

        {/* Name */}
        <span className={`text-sm font-semibold flex-1 min-w-0 truncate ${depth === 0 ? 'text-os-cyan' : 'text-os-text'}`}>
          {agent.name}
        </span>

        {/* Role badge */}
        {agent.role && agent.role !== 'general' && (
          <span className="hidden sm:inline text-[10px] text-os-muted bg-os-bg border border-os-border rounded px-1.5 py-0.5 flex-shrink-0">
            {agent.role}
          </span>
        )}

        {/* Model badge */}
        {agent.model && (
          <span className={`hidden sm:inline rounded-full border px-2 py-0.5 text-[9px] font-medium flex-shrink-0 ${MODEL_COLOR[agent.model] ?? 'bg-os-muted/10 text-os-muted border-os-muted/20'}`}>
            {MODEL_LABEL[agent.model] ?? agent.model}
          </span>
        )}

        {/* Budget */}
        {budget > 0 && (
          <span className="text-[11px] font-bold text-os-yellow flex-shrink-0">${budget}/mo</span>
        )}

        {/* Status label */}
        <span className={`text-[10px] uppercase font-bold flex-shrink-0 ${
          statusKey === 'running' || statusKey === 'active' ? 'text-os-green' : 'text-os-muted'
        }`}>
          {agent.status ?? 'idle'}
        </span>
      </div>

      {/* Children */}
      {hasChildren && open && (
        <div className="border-l border-os-border/40 ml-6">{children}</div>
      )}
    </div>
  );
}

function buildTree(
  agents: Agent[],
  parentId: string | null | undefined,
  search: string,
  depth = 0
): React.ReactNode {
  const children = agents.filter(a => {
    if (parentId === null) return !a.reportsTo;
    return a.reportsTo === parentId;
  });

  return children
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.role?.toLowerCase().includes(search.toLowerCase()))
    .map(agent => {
      const subTree = buildTree(agents, agent.id, '', depth + 1);
      return (
        <AgentRow key={agent.id} agent={agent} depth={depth}>
          {subTree}
        </AgentRow>
      );
    });
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [spin, setSpin] = useState(false);

  const load = async () => {
    try {
      const data = await fetch('/api/agents').then(r => r.json());
      const list: Agent[] = Array.isArray(data) ? data : (data.agents || []);
      setAgents(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setSpin(true); load(); setTimeout(() => setSpin(false), 600); };

  const totalBudget = agents.reduce((s, a) => s + budgetDollars(a), 0);
  const activeCount = agents.filter(a => a.status === 'running' || a.status === 'active').length;

  const filteredFlat = search
    ? agents.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.role?.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={20} className="text-os-cyan" />
          <h1 className="text-lg font-semibold text-os-text">Agents</h1>
          <span className="rounded-full bg-os-green/10 border border-os-green/20 px-2 py-0.5 text-[10px] font-bold text-os-green">
            {activeCount} running
          </span>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors">
          <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 text-os-muted">
            <Bot size={13} />
            <span className="text-[10px] uppercase tracking-wider">Total Agents</span>
          </div>
          <p className="mt-2 text-xl font-bold text-os-cyan">{agents.length}</p>
          <p className="mt-0.5 text-[11px] text-os-muted">{activeCount} running · {agents.length - activeCount} idle</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 text-os-muted">
            <DollarSign size={13} />
            <span className="text-[10px] uppercase tracking-wider">Monthly Budget</span>
          </div>
          <p className="mt-2 text-xl font-bold text-os-yellow">${totalBudget.toFixed(0)}</p>
          <p className="mt-0.5 text-[11px] text-os-muted">across {agents.length} agents</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 text-os-muted">
            <Zap size={13} />
            <span className="text-[10px] uppercase tracking-wider">Hierarchy</span>
          </div>
          <p className="mt-2 text-xl font-bold text-os-text">{agents.filter(a => !a.reportsTo).length}</p>
          <p className="mt-0.5 text-[11px] text-os-muted">top-level · {agents.filter(a => !!a.reportsTo).length} reporting</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-os-border bg-os-surface px-3 py-2">
        <Search size={13} className="text-os-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="flex-1 bg-transparent text-sm text-os-text placeholder-os-muted outline-none"
        />
      </div>

      {/* Tree or Flat Search Results */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-os-surface animate-pulse" />)}
        </div>
      ) : filteredFlat ? (
        // Flat search results
        <div className="space-y-1">
          {filteredFlat.length === 0 ? (
            <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
              <Bot size={24} className="text-os-muted mx-auto mb-2" />
              <p className="text-sm text-os-muted">No agents match</p>
            </div>
          ) : filteredFlat.map(agent => (
            <AgentRow key={agent.id} agent={agent} depth={0} />
          ))}
        </div>
      ) : (
        // Hierarchy tree
        <div className="rounded-xl border border-os-border bg-os-bg p-3 space-y-1">
          {buildTree(agents, null, '') as React.ReactNode}
        </div>
      )}
    </div>
  );
}
