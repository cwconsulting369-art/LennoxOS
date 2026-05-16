import { useState, useEffect, useCallback } from 'react';
import {
  Zap, CircleDot, TrendingUp, Activity, AlertTriangle,
  Server, Cpu, HardDrive, Flame, Plus, RefreshCw, ExternalLink,
  Dumbbell, Droplets, Moon, Timer, Footprints, CheckCircle2,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */

interface Service {
  id: number; name: string; status: string;
  cpu: number; memory: number; restarts: number;
}

interface Issue {
  id: string; identifier: string; title: string;
  status: string; priority: number;
  assignee?: { name: string };
}

interface SystemInfo {
  memory: { total: number; used: number };
  loadAvg: { '1m': number; '5m': number; '15m': number };
  cpu: { cores: number; loadPct: number };
  disk: { total: string; used: string; free: string; pct: string };
  uptime: number;
}

/* ─── Helpers ───────────────────────────────────────────── */

const STATUS_DOT: Record<string, string> = {
  online: 'bg-os-green',
  stopped: 'bg-os-yellow',
  errored: 'bg-os-red',
};

const STATUS_TEXT: Record<string, string> = {
  online: 'text-os-green',
  stopped: 'text-os-yellow',
  errored: 'text-os-red',
};

/* ─── Component ─────────────────────────────────────────── */

export default function Overview() {
  const [services, setServices] = useState<Service[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);

  const load = useCallback(async () => {
    setSpin(true);
    setError(null);
    try {
      const [svcRes, issRes, sysRes] = await Promise.allSettled([
        fetch('/api/services').then(r => r.json()),
        fetch('/api/issues').then(r => r.json()),
        fetch('/api/monitor').then(r => r.json()),
      ]);
      if (svcRes.status === 'fulfilled') setServices(Array.isArray(svcRes.value) ? svcRes.value : []);
      if (issRes.status === 'fulfilled') {
        const v = issRes.value as any;
        setIssues(Array.isArray(v.issues) ? v.issues : Array.isArray(v) ? v : []);
      }
      if (sysRes.status === 'fulfilled') setSystem(sysRes.value);
    } catch (e) {
      setError('Verbindung zum Server nicht möglich');
    }
    setLoading(false);
    setSpin(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const online = services.filter(s => s.status === 'online').length;
  const errored = services.filter(s => s.status === 'errored').length;
  const stopped = services.filter(s => s.status === 'stopped').length;

  const activeIssues = issues
    .filter(i => i.status === 'open' || i.status === 'in_progress')
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);

  const memPct = system ? Math.round((system.memory.used / system.memory.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-os-text flex items-center gap-2">
            <Zap size={20} className="text-os-cyan" />
            System Overview
          </h1>
          <p className="text-xs text-os-muted mt-0.5">Alles was jetzt wichtig ist — auf einen Blick</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors"
        >
          <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">
          {error}
        </div>
      )}

      {/* System Health Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Online',   value: `${online}/${services.length}`, icon: Server, color: 'text-os-green' },
          { label: 'Errored',  value: String(errored),                icon: AlertTriangle, color: 'text-os-red' },
          { label: 'CPU',      value: system ? `${system.cpu.loadPct}%` : '—', icon: Cpu, color: 'text-os-cyan' },
          { label: 'RAM',      value: `${memPct}%`,                   icon: Activity, color: memPct > 80 ? 'text-os-red' : 'text-os-cyan' },
          { label: 'Disk',     value: system?.disk.pct ?? '—',        icon: HardDrive, color: parseInt(system?.disk.pct ?? '0') > 80 ? 'text-os-red' : 'text-os-cyan' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-os-border bg-os-surface p-4">
            <div className="flex items-center gap-2 text-os-muted mb-2">
              <kpi.icon size={14} />
              <span className="text-[10px] uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Col 1: Issues */}
        <div className="space-y-4">
          <div className="rounded-xl border border-os-border bg-os-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-os-muted uppercase tracking-wider flex items-center gap-2">
                <CircleDot size={13} className="text-os-accent" /> Active Issues
              </span>
              <span className="text-xs text-os-accent font-bold">{activeIssues.length}</span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 rounded bg-os-border animate-pulse" />)}
              </div>
            ) : activeIssues.length === 0 ? (
              <p className="text-xs text-os-muted text-center py-4">Keine offenen Issues</p>
            ) : (
              <div className="space-y-2">
                {activeIssues.map(issue => (
                  <div key={issue.id} className="flex items-start gap-2 p-2 rounded-lg bg-os-bg border border-os-border">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      issue.priority <= 1 ? 'bg-os-red' : issue.priority === 2 ? 'bg-os-yellow' : 'bg-os-muted'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs text-os-text truncate">{issue.title}</p>
                      <p className="text-[10px] text-os-muted font-mono">{issue.identifier}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-os-border bg-os-surface p-4">
            <span className="text-xs text-os-muted uppercase tracking-wider mb-3 block">Quick Actions</span>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 text-xs text-os-text hover:text-os-cyan transition-colors py-1.5">
                <Plus size={13} /> New Issue
              </button>
              <a href="https://paperclip.lennoxos.com" target="_blank" rel="noreferrer"
                 className="flex items-center gap-2 text-xs text-os-text hover:text-os-cyan transition-colors py-1.5">
                <ExternalLink size={13} /> Open Paperclip
              </a>
            </div>
          </div>
        </div>

        {/* Col 2: Habits + Fitness */}
        <div className="space-y-4">
          <div className="rounded-xl border border-os-border bg-os-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-os-muted uppercase tracking-wider flex items-center gap-2">
                <Flame size={13} className="text-os-yellow" /> Heutige Habits
              </span>
              <span className="text-[10px] text-os-green font-bold">0/6</span>
            </div>
            {[
              { label: 'Joggen',       icon: Footprints,  done: false },
              { label: 'Workout',      icon: Dumbbell,    done: false },
              { label: 'Meditation',   icon: Moon,        done: false },
              { label: 'Breathwork',   icon: Activity,    done: false },
              { label: 'Journaling',   icon: TrendingUp,  done: false },
              { label: 'Affirmationen',icon: CheckCircle2,done: false },
            ].map(habit => (
              <div key={habit.label} className="flex items-center justify-between py-1.5 border-b border-os-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <habit.icon size={13} className="text-os-muted" />
                  <span className="text-xs text-os-text">{habit.label}</span>
                </div>
                <button className={`text-xs px-2 py-0.5 rounded ${
                  habit.done ? 'bg-os-green/20 text-os-green' : 'bg-os-border text-os-muted hover:text-os-text'
                }`}>
                  {habit.done ? '✓' : '—'}
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-os-border bg-os-surface p-4">
            <span className="text-xs text-os-muted uppercase tracking-wider mb-3 block flex items-center gap-2">
              <Dumbbell size={13} className="text-os-cyan" /> Fitness Quick Stats
            </span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Wiederholungen', value: '0', icon: Zap, color: 'text-os-cyan' },
                { label: 'Wasser', value: '0.0/2.5L', icon: Droplets, color: 'text-os-blue' },
                { label: 'Schlaf', value: '0h', icon: Moon, color: 'text-os-accent' },
                { label: 'Fasten 10-18', value: 'Nein', icon: Timer, color: 'text-os-green' },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-os-bg p-2.5">
                  <div className="flex items-center gap-1.5 text-os-muted mb-1">
                    <s.icon size={11} />
                    <span className="text-[9px] uppercase">{s.label}</span>
                  </div>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Col 3: Agents + Service Status */}
        <div className="space-y-4">
          <div className="rounded-xl border border-os-border bg-os-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-os-muted uppercase tracking-wider flex items-center gap-2">
                <Activity size={13} className="text-os-cyan" /> Agent Status
              </span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="h-6 rounded bg-os-border animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {services.filter(s => s.status !== 'online').length === 0 ? (
                  <p className="text-xs text-os-green text-center py-4">Alle Agenten online</p>
                ) : (
                  services.filter(s => s.status !== 'online').map(s => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] || 'bg-os-muted'}`} />
                      <span className="text-os-text">{s.name}</span>
                      <span className={`ml-auto ${STATUS_TEXT[s.status] || 'text-os-muted'}`}>{s.status}</span>
                    </div>
                  ))
                )}
                <div className="border-t border-os-border pt-2 mt-2 space-y-2">
                  {services.filter(s => s.status === 'online').slice(0, 8).map(s => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-os-green" />
                      <span className="text-os-muted">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-os-border bg-os-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-os-muted uppercase tracking-wider">Service Status</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-os-green" />
                <span className="text-os-text">{online} Online</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-os-red" />
                <span className="text-os-text">{errored} Error</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-os-yellow" />
                <span className="text-os-text">{stopped} Stopped</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
