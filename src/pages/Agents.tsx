import { useState, useEffect } from 'react';
import { Bot, Search, DollarSign, RefreshCw, Zap } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  budgetPerMonth: number;
  status: 'active' | 'idle' | 'disabled';
  issuesCount?: number;
  lastActive?: string;
}

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

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [spin, setSpin] = useState(false);

  const load = async () => {
    try {
      const data = await fetch('/api/agents').then(r => r.json());
      const list = Array.isArray(data) ? data : (data.agents || []);
      setAgents(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refresh = () => { setSpin(true); load(); setTimeout(() => setSpin(false), 600); };

  const filtered = agents.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.role?.toLowerCase().includes(search.toLowerCase())
  );

  const totalBudget = agents.reduce((s, a) => s + (a.budgetPerMonth || 0), 0);
  const activeCount = agents.filter(a => a.status === 'active').length;

  const budgetByModel = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.model] = (acc[a.model] || 0) + (a.budgetPerMonth || 0);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={20} className="text-os-cyan" />
          <h1 className="text-lg font-semibold text-os-text">Agents</h1>
          <span className="rounded-full bg-os-green/10 border border-os-green/20 px-2 py-0.5 text-[10px] font-bold text-os-green">
            {activeCount} active
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
          <p className="mt-0.5 text-[11px] text-os-muted">{activeCount} active · {agents.length - activeCount} idle</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 text-os-muted">
            <DollarSign size={13} />
            <span className="text-[10px] uppercase tracking-wider">Monthly Budget</span>
          </div>
          <p className="mt-2 text-xl font-bold text-os-yellow">${totalBudget}</p>
          <p className="mt-0.5 text-[11px] text-os-muted">across {agents.length} agents</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 text-os-muted">
            <Zap size={13} />
            <span className="text-[10px] uppercase tracking-wider">By Model</span>
          </div>
          <div className="mt-2 space-y-1">
            {Object.entries(budgetByModel).slice(0, 3).map(([model, budget]) => (
              <div key={model} className="flex items-center justify-between">
                <span className="text-[10px] text-os-muted">{MODEL_LABEL[model] || model}</span>
                <span className="text-[10px] font-bold text-os-text">${budget}</span>
              </div>
            ))}
          </div>
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

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-os-surface animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
          <Bot size={24} className="text-os-muted mx-auto mb-2" />
          <p className="text-sm text-os-muted">{search ? 'No agents match' : 'No agents found'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map(agent => (
            <div
              key={agent.id}
              className={`rounded-xl border p-4 transition-colors ${
                agent.status === 'active'
                  ? 'border-os-green/20 bg-os-green/5'
                  : agent.status === 'disabled'
                  ? 'border-os-muted/20 bg-os-bg opacity-60'
                  : 'border-os-border bg-os-surface'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-os-bg border border-os-border">
                    <Bot size={13} className="text-os-cyan" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-os-text leading-tight">{agent.name}</p>
                    {agent.role && <p className="text-[10px] text-os-muted truncate max-w-[120px]">{agent.role}</p>}
                  </div>
                </div>
                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  agent.status === 'active' ? 'border-os-green/30 text-os-green' :
                  agent.status === 'disabled' ? 'border-os-muted/30 text-os-muted' :
                  'border-os-border text-os-muted'
                }`}>
                  {agent.status || 'idle'}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-medium ${MODEL_COLOR[agent.model] || 'bg-os-muted/10 text-os-muted border-os-muted/20'}`}>
                  {MODEL_LABEL[agent.model] || agent.model || 'unknown'}
                </span>
                {agent.budgetPerMonth > 0 && (
                  <span className="text-[11px] font-bold text-os-yellow">${agent.budgetPerMonth}/mo</span>
                )}
              </div>

              {agent.issuesCount !== undefined && (
                <p className="mt-2 text-[10px] text-os-muted">{agent.issuesCount} open issues</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
