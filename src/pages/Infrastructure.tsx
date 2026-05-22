import { useEffect, useMemo, useState } from 'react';
import {
  Server, Cpu, HardDrive, MemoryStick, Activity, AlertTriangle, RefreshCw,
  CheckCircle2, XCircle, PauseCircle, Bot, ShieldAlert, Clock,
} from 'lucide-react';

/* ============================================================
 * Infrastructure — LennoxOS Command Center
 * The "Motor": pm2 health, system vitals, agents, security events.
 * ============================================================ */

interface ServiceRow {
  id: number;
  name: string;
  status: 'online' | 'errored' | 'stopped' | string;
  uptime: number | null;
  restarts: number;
  cpu: number;
  memory: number;
  pid: number | null;
}

interface MonitorData {
  cpu: { cores: number; loadPct: number };
  memory: { total: number; used: number; available: number; pct: number };
  disk: { total: string; used: string; free: string; pct: string };
  uptime: number;
  loadAvg?: { '1m': number; '5m': number; '15m': number };
}

interface ProjectEvent {
  project: string;
  type?: string;
  message?: string;
  timestamp?: string;
  severity?: string;
}

function fmtBytes(n: number) {
  if (!n) return '0';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

function fmtUptime(sec: number) {
  if (!sec) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtUptimeFromMs(ms: number | null) {
  if (!ms) return '—';
  return fmtUptime(Math.floor((Date.now() - ms) / 1000));
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Infrastructure() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [svcRes, monRes, evRes] = await Promise.all([
        fetch('/api/services').then(r => r.json()).catch(() => []),
        fetch('/api/monitor').then(r => r.json()).catch(() => null),
        fetch('/api/events/recent?limit=12').then(r => r.json()).catch(() => ({ events: [] })),
      ]);
      setServices(Array.isArray(svcRes) ? svcRes : []);
      setMonitor(monRes && !monRes.error ? monRes : null);
      setEvents(Array.isArray(evRes?.events) ? evRes.events : []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, []);

  const counts = useMemo(() => {
    const total = services.length;
    const online = services.filter(s => s.status === 'online').length;
    const errored = services.filter(s => s.status === 'errored').length;
    const stopped = services.filter(s => s.status === 'stopped').length;
    return { total, online, errored, stopped };
  }, [services]);

  /* Heuristic agent classification — agent if name contains these patterns */
  const agentNames = ['agent', 'bot', 'nexus', 'pm-chief', 'mail-agent', 'paperclip'];
  const agents = services.filter(s =>
    agentNames.some(p => s.name.toLowerCase().includes(p))
  );

  const cpuPct = monitor?.cpu.loadPct ?? 0;
  const memPct = monitor?.memory.pct ?? 0;
  const diskPct = parseInt((monitor?.disk.pct || '0').replace('%', '')) || 0;

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="lx-section-title mb-3">Infrastructure</div>
          <h1 className="lx-headline text-3xl">Command Center</h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Live-Status der VPS — Services, System, Agents, Security
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="lx-btn"
          title="Refresh"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Sync...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="lx-card p-4 mb-6 flex items-center gap-3 border-[var(--status-danger)]/40">
          <AlertTriangle size={16} className="text-[var(--status-danger)]" />
          <span className="text-sm text-[var(--text)]">{error}</span>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Services online"
          value={loading ? '—' : `${counts.online} / ${counts.total}`}
          icon={<CheckCircle2 size={18} />}
          tone={counts.errored > 0 ? 'warn' : 'ok'}
          sub={counts.errored > 0 ? `${counts.errored} errored · ${counts.stopped} stopped` : 'All operational'}
        />
        <KpiCard
          label="CPU Load"
          value={`${cpuPct}%`}
          icon={<Cpu size={18} />}
          tone={cpuPct > 80 ? 'err' : cpuPct > 60 ? 'warn' : 'ok'}
          sub={monitor ? `${monitor.cpu.cores} cores` : '—'}
          progress={cpuPct}
        />
        <KpiCard
          label="Memory"
          value={`${memPct}%`}
          icon={<MemoryStick size={18} />}
          tone={memPct > 85 ? 'err' : memPct > 70 ? 'warn' : 'ok'}
          sub={monitor ? `${fmtBytes(monitor.memory.used)} / ${fmtBytes(monitor.memory.total)}` : '—'}
          progress={memPct}
        />
        <KpiCard
          label="Disk"
          value={monitor?.disk.pct || '—'}
          icon={<HardDrive size={18} />}
          tone={diskPct > 85 ? 'err' : diskPct > 70 ? 'warn' : 'ok'}
          sub={monitor ? `${monitor.disk.used} / ${monitor.disk.total}` : '—'}
          progress={diskPct}
        />
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Services list — spans 2 */}
        <section className="lx-panel p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Server size={15} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">
                PM2 Services
              </h2>
              <span className="lx-pill">{counts.total}</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5"><span className="lx-dot lx-dot--ok"></span> {counts.online}</span>
              <span className="flex items-center gap-1.5"><span className="lx-dot lx-dot--err"></span> {counts.errored}</span>
              <span className="flex items-center gap-1.5"><span className="lx-dot lx-dot--warn"></span> {counts.stopped}</span>
            </div>
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">Loading services…</div>
          ) : services.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">No services running</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-deep)]/50 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Service</th>
                    <th className="text-left py-3 px-3 font-semibold">Status</th>
                    <th className="text-right py-3 px-3 font-semibold">CPU</th>
                    <th className="text-right py-3 px-3 font-semibold">Mem</th>
                    <th className="text-right py-3 px-3 font-semibold">Uptime</th>
                    <th className="text-right py-3 px-4 font-semibold">↻</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, i) => (
                    <tr
                      key={s.id}
                      className={`border-t border-[var(--border)] ${i % 2 === 0 ? 'bg-[var(--bg-deep)]/20' : ''} hover:bg-[var(--accent-soft)] transition-colors`}
                    >
                      <td className="py-2.5 px-4 font-medium text-[var(--text)]">{s.name}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] font-mono text-xs">{s.cpu}%</td>
                      <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] font-mono text-xs">{fmtBytes(s.memory)}</td>
                      <td className="py-2.5 px-3 text-right text-[var(--text-muted)] font-mono text-xs">{fmtUptimeFromMs(s.uptime)}</td>
                      <td className="py-2.5 px-4 text-right text-[var(--text-muted)] font-mono text-xs">{s.restarts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Sidebar column */}
        <div className="flex flex-col gap-5">
          {/* Agents */}
          <section className="lx-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bot size={15} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text)]">Agents</h2>
              </div>
              <span className="lx-pill lx-pill--accent">{agents.length}</span>
            </div>
            {agents.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No agent processes detected</p>
            ) : (
              <ul className="space-y-2">
                {agents.slice(0, 8).map(a => (
                  <li key={a.id} className="flex items-center justify-between text-xs py-1">
                    <span className="flex items-center gap-2 text-[var(--text)] truncate">
                      <span className={`lx-dot ${a.status === 'online' ? 'lx-dot--ok' : 'lx-dot--err'}`}></span>
                      <span className="truncate font-medium">{a.name}</span>
                    </span>
                    <span className="text-[var(--text-muted)] font-mono">{fmtUptimeFromMs(a.uptime)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent events / security */}
          <section className="lx-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ShieldAlert size={15} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text)]">Recent Events</h2>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-1">
                <Clock size={10} /> live
              </span>
            </div>
            {events.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No events in feed</p>
            ) : (
              <ul className="space-y-3">
                {events.slice(0, 8).map((e, i) => (
                  <li key={i} className="text-xs leading-snug">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-[var(--accent-glow)] uppercase tracking-wider text-[10px]">
                        {e.project || 'system'}
                      </span>
                      <span className="text-[var(--text-faint)] font-mono">{timeAgo(e.timestamp)}</span>
                    </div>
                    <p className="text-[var(--text-secondary)] truncate" title={e.message}>
                      {e.message || e.type || '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* System uptime */}
          {monitor && (
            <section className="lx-panel p-6">
              <div className="flex items-center gap-3 mb-3">
                <Activity size={15} className="text-[var(--accent)]" />
                <h2 className="text-sm font-semibold text-[var(--text)]">System</h2>
              </div>
              <div className="space-y-2 text-xs">
                <Row label="Uptime" value={fmtUptime(monitor.uptime)} />
                {monitor.loadAvg && (
                  <Row label="Load" value={`${monitor.loadAvg['1m']} · ${monitor.loadAvg['5m']} · ${monitor.loadAvg['15m']}`} />
                )}
                <Row label="Cores" value={String(monitor.cpu.cores)} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function KpiCard({
  label, value, sub, icon, tone, progress,
}: {
  label: string; value: string; sub?: string;
  icon?: React.ReactNode; tone?: 'ok' | 'warn' | 'err';
  progress?: number;
}) {
  const toneColor =
    tone === 'err' ? 'var(--status-danger)' :
    tone === 'warn' ? 'var(--status-warning)' :
    'var(--accent)';
  return (
    <div className="lx-card p-5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <span className="lx-kpi-label">{label}</span>
        <span style={{ color: toneColor }}>{icon}</span>
      </div>
      <div className="lx-kpi-value">{value}</div>
      {sub && <p className="text-[11px] text-[var(--text-muted)] mt-1">{sub}</p>}
      {progress !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--bg-deep)]">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${Math.min(100, progress)}%`,
              background: `linear-gradient(90deg, ${toneColor}, var(--accent-glow))`,
              boxShadow: `0 0 8px ${toneColor}`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'online') {
    return (
      <span className="lx-pill lx-pill--ok inline-flex">
        <span className="lx-dot lx-dot--ok"></span> online
      </span>
    );
  }
  if (status === 'errored') {
    return (
      <span className="lx-pill lx-pill--err inline-flex">
        <XCircle size={9} /> errored
      </span>
    );
  }
  if (status === 'stopped') {
    return (
      <span className="lx-pill lx-pill--warn inline-flex">
        <PauseCircle size={9} /> stopped
      </span>
    );
  }
  return <span className="lx-pill">{status}</span>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{label}</span>
      <span className="text-[var(--text)] font-mono">{value}</span>
    </div>
  );
}
