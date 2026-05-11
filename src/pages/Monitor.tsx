import { useState, useEffect, useCallback } from 'react';
import {
  Activity, RefreshCw, FileText, RotateCcw, ChevronDown,
  Server, Cpu, HardDrive, Wifi, Terminal, Gauge, MemoryStick,
  CheckCircle2, XCircle, AlertTriangle, Search
} from 'lucide-react';

interface Service {
  id: number;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
  uptime: number;
}

interface SystemInfo {
  memory: { total: number; used: number };
  loadAvg: { '1m': number; '5m': number; '15m': number };
  cpu: { cores: number; loadPct: number };
  disk: { total: string; used: string; free: string; pct: string };
  uptime: number;
}

interface Process {
  pid: number;
  user: string;
  cpu: number;
  memory: number;
  command: string;
  started: string;
}

interface LogData {
  name: string;
  out: string;
  err: string;
}

function ProgressBar({ value, max = 100, color = 'bg-os-cyan' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-os-border">
      <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, color = 'text-os-cyan' }: {
  title: string; value: string; subtitle?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center gap-2 text-os-muted">
        <Icon size={14} />
        <span className="text-[10px] uppercase tracking-wider">{title}</span>
      </div>
      <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
      {subtitle && <p className="mt-0.5 text-[11px] text-os-muted">{subtitle}</p>}
    </div>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h`;
}

function statusIcon(status: string) {
  if (status === 'online') return <CheckCircle2 size={13} className="text-os-green" />;
  if (status === 'errored') return <XCircle size={13} className="text-os-red" />;
  return <AlertTriangle size={13} className="text-os-yellow" />;
}

function statusColor(status: string) {
  if (status === 'online') return 'border-os-green/20 bg-os-green/5';
  if (status === 'errored') return 'border-os-red/20 bg-os-red/5';
  return 'border-os-yellow/20 bg-os-yellow/5';
}

type Tab = 'services' | 'processes';

export default function Monitor() {
  const [services, setServices] = useState<Service[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('services');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [logData, setLogData] = useState<Record<string, LogData>>({});
  const [logLoading, setLogLoading] = useState<string | null>(null);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [processSearch, setProcessSearch] = useState('');
  const [spin, setSpin] = useState(false);

  const load = useCallback(async () => {
    try {
      const [svcRes, sysRes] = await Promise.all([
        fetch('/api/services').then(r => r.json()),
        fetch('/api/monitor').then(r => r.json()),
      ]);
      setServices(Array.isArray(svcRes) ? svcRes : []);
      setSystem(sysRes);
    } catch {}
    setLoading(false);
  }, []);

  const loadProcesses = useCallback(async () => {
    try {
      const data = await fetch('/api/system/processes').then(r => r.json());
      setProcesses(data.processes || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (tab === 'processes') loadProcesses();
  }, [tab, loadProcesses]);

  const refresh = () => {
    setSpin(true);
    load();
    if (tab === 'processes') loadProcesses();
    setTimeout(() => setSpin(false), 600);
  };

  const toggleLog = async (name: string) => {
    if (expandedLog === name) { setExpandedLog(null); return; }
    setExpandedLog(name);
    if (logData[name]) return;
    setLogLoading(name);
    try {
      const data = await fetch(`/api/logs/${name}?lines=80`).then(r => r.json());
      setLogData(prev => ({ ...prev, [name]: data }));
    } catch {}
    setLogLoading(null);
  };

  const restart = async (name: string) => {
    setRestarting(name);
    await fetch(`/api/services/${name}/restart`, { method: 'POST' });
    await new Promise(r => setTimeout(r, 1500));
    await load();
    setRestarting(null);
  };

  const memPct = system ? Math.round((system.memory.used / system.memory.total) * 100) : 0;
  const memUsedMb = system ? Math.round(system.memory.used / 1024 / 1024) : 0;
  const memTotalMb = system ? Math.round(system.memory.total / 1024 / 1024) : 0;
  const online = services.filter(s => s.status === 'online').length;

  const filteredProcs = processes.filter(p =>
    !processSearch || p.command.toLowerCase().includes(processSearch.toLowerCase()) ||
    String(p.pid).includes(processSearch)
  ).slice(0, 60);

  if (loading) return (
    <div className="p-6 space-y-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-os-surface animate-pulse" />
      ))}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-os-cyan" />
            <h1 className="text-lg font-semibold text-os-text">System Monitor</h1>
            <span className="flex items-center gap-1 rounded-full border border-os-green/30 bg-os-green/10 px-2 py-0.5 text-[10px] text-os-green">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-os-green opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-os-green" />
              </span>
              VPS UP
            </span>
          </div>
          <p className="mt-0.5 text-xs text-os-muted">204.168.142.89 · {online}/{services.length} services online</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors"
        >
          <RefreshCw size={13} className={spin ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Row */}
      {system && (
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            title="CPU Load"
            value={`${system.cpu.loadPct}%`}
            subtitle={`${system.cpu.cores} cores · 1m avg`}
            icon={Cpu}
            color={system.cpu.loadPct > 80 ? 'text-os-red' : system.cpu.loadPct > 50 ? 'text-os-yellow' : 'text-os-green'}
          />
          <KpiCard
            title="Memory"
            value={`${memPct}%`}
            subtitle={`${memUsedMb} / ${memTotalMb} MB`}
            icon={MemoryStick}
            color={memPct > 85 ? 'text-os-red' : memPct > 65 ? 'text-os-yellow' : 'text-os-cyan'}
          />
          <KpiCard
            title="Disk"
            value={system.disk.pct}
            subtitle={`${system.disk.used} used of ${system.disk.total}`}
            icon={HardDrive}
            color={parseInt(system.disk.pct) > 85 ? 'text-os-red' : 'text-os-cyan'}
          />
          <KpiCard
            title="Uptime"
            value={formatUptime(system.uptime)}
            subtitle={`Load: ${system.loadAvg['5m'].toFixed(2)} (5m)`}
            icon={Gauge}
            color="text-os-green"
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-os-border bg-os-surface p-1 w-fit">
        {(['services', 'processes'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-os-bg text-os-cyan' : 'text-os-muted hover:text-os-text'
            }`}
          >
            {t === 'services' ? <Server size={13} /> : <Terminal size={13} />}
            {t}
          </button>
        ))}
      </div>

      {/* Services Tab */}
      {tab === 'services' && (
        <div className="grid grid-cols-2 gap-4">
          {services.map(svc => (
            <div key={svc.name} className={`rounded-xl border p-4 transition ${statusColor(svc.status)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon(svc.status)}
                  <span className="text-sm font-semibold text-os-text">{svc.name}</span>
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${
                  svc.status === 'online' ? 'text-os-green' : svc.status === 'errored' ? 'text-os-red' : 'text-os-yellow'
                }`}>{svc.status}</span>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-[10px] uppercase text-os-muted">CPU</span>
                  <div className="flex-1">
                    <ProgressBar value={svc.cpu} max={50} color={svc.status === 'online' ? 'bg-os-cyan' : 'bg-os-yellow'} />
                  </div>
                  <span className="w-8 text-right text-[11px] text-os-muted">{svc.cpu}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 text-[10px] uppercase text-os-muted">RAM</span>
                  <div className="flex-1">
                    <ProgressBar value={svc.memory} max={512} />
                  </div>
                  <span className="w-10 text-right text-[11px] text-os-muted">{svc.memory}MB</span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-4 text-[10px] text-os-muted">
                <span>Restarts: {svc.restarts}</span>
                {svc.uptime > 0 && <span>Since: {new Date(svc.uptime).toLocaleTimeString()}</span>}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => toggleLog(svc.name)}
                  className="flex items-center gap-1 rounded-lg border border-os-border px-2.5 py-1 text-[11px] text-os-muted hover:text-os-text hover:bg-os-bg transition-colors"
                >
                  <FileText size={11} />
                  Logs
                  <ChevronDown size={11} className={`transition-transform ${expandedLog === svc.name ? 'rotate-180' : ''}`} />
                </button>
                <button
                  onClick={() => restart(svc.name)}
                  disabled={restarting === svc.name}
                  className="flex items-center gap-1 rounded-lg border border-os-border px-2.5 py-1 text-[11px] text-os-muted hover:text-os-text hover:bg-os-bg transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={11} className={restarting === svc.name ? 'animate-spin' : ''} />
                  Restart
                </button>
              </div>

              {expandedLog === svc.name && (
                <div className="mt-3 rounded-lg bg-os-bg border border-os-border p-3">
                  {logLoading === svc.name ? (
                    <div className="h-4 w-1/3 rounded bg-os-surface animate-pulse" />
                  ) : logData[svc.name] ? (
                    <div className="space-y-2">
                      {logData[svc.name].out && (
                        <div>
                          <p className="text-[9px] uppercase text-os-muted mb-1">stdout</p>
                          <pre className="text-[10px] text-os-text font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {logData[svc.name].out.split('\n').slice(-30).join('\n')}
                          </pre>
                        </div>
                      )}
                      {logData[svc.name].err && (
                        <div>
                          <p className="text-[9px] uppercase text-os-red mb-1">stderr</p>
                          <pre className="text-[10px] text-os-red/80 font-mono whitespace-pre-wrap max-h-20 overflow-y-auto">
                            {logData[svc.name].err.split('\n').slice(-10).join('\n')}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-os-muted">No logs</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Processes Tab */}
      {tab === 'processes' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-os-border bg-os-surface px-3 py-2">
            <Search size={13} className="text-os-muted" />
            <input
              value={processSearch}
              onChange={e => setProcessSearch(e.target.value)}
              placeholder="Search processes..."
              className="flex-1 bg-transparent text-sm text-os-text placeholder-os-muted outline-none"
            />
          </div>
          <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-os-border">
                  <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">PID</th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">User</th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase text-os-muted">CPU%</th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase text-os-muted">MEM%</th>
                  <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">Command</th>
                </tr>
              </thead>
              <tbody>
                {filteredProcs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-os-muted">No processes</td></tr>
                ) : filteredProcs.map(p => (
                  <tr key={p.pid} className="border-b border-os-border/50 hover:bg-os-bg transition-colors">
                    <td className="px-4 py-2 text-os-muted font-mono">{p.pid}</td>
                    <td className="px-4 py-2 text-os-muted">{p.user}</td>
                    <td className={`px-4 py-2 text-right font-mono ${p.cpu > 10 ? 'text-os-yellow' : p.cpu > 50 ? 'text-os-red' : 'text-os-text'}`}>{p.cpu.toFixed(1)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${p.memory > 10 ? 'text-os-yellow' : 'text-os-text'}`}>{p.memory.toFixed(1)}</td>
                    <td className="px-4 py-2 text-os-text truncate max-w-xs font-mono">{p.command}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-os-muted text-right">{filteredProcs.length} processes shown</p>
        </div>
      )}
    </div>
  );
}
