import { useState, useEffect, useCallback } from 'react';
import {
  Server, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Cpu, MemoryStick, HardDrive, Clock, Activity, Gauge,
  Terminal, FileText, Wifi, Search, ChevronDown, Bell, Shield,
} from 'lucide-react';

/* ─── Types ─── */
interface Service { id: number; name: string; status: string; cpu: number; memory: number; restarts: number; uptime: number; }
interface SystemInfo { memory: { total: number; used: number }; loadAvg: { '1m': number; '5m': number; '15m': number }; cpu: { cores: number; loadPct: number }; disk: { total: string; used: string; free: string; pct: string }; uptime: number; }
interface Process { pid: number; user: string; cpu: number; memory: number; command: string; }
interface LogData { name: string; out: string; err: string; }
interface NetInterface { name: string; ip: string; mac: string; status: string; rx: string; tx: string; }

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}

function ProgressBar({ value, max = 100, color = 'bg-os-cyan' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return <div className="h-1.5 w-full rounded-full bg-os-border"><div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>;
}

const STATUS: Record<string, string> = { online: 'text-os-green', stopped: 'text-os-yellow', errored: 'text-os-red' };
const STATUS_DOT: Record<string, string> = { online: 'bg-os-green', stopped: 'bg-os-yellow', errored: 'bg-os-red' };

type Tab = 'services' | 'processes' | 'logs' | 'network' | 'metrics' | 'alerts';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'services', label: 'Services', icon: Server },
  { id: 'processes', label: 'Prozesse', icon: Terminal },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'network', label: 'Netzwerk', icon: Wifi },
  { id: 'metrics', label: 'Metriken', icon: Gauge },
  { id: 'alerts', label: 'Alerts', icon: Bell },
];

export default function SystemDashboard() {
  const [tab, setTab] = useState<Tab>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [logs, setLogs] = useState<Record<string, LogData>>({});
  const [interfaces, setInterfaces] = useState<NetInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [spin, setSpin] = useState(false);

  const load = useCallback(async () => {
    try {
      const [svcRes, sysRes, procRes, netRes] = await Promise.allSettled([
        fetch('/api/services').then(r => r.json()),
        fetch('/api/monitor').then(r => r.json()),
        fetch('/api/system/processes').then(r => r.json()),
        fetch('/api/system/network').then(r => r.json()),
      ]);
      if (svcRes.status === 'fulfilled') setServices(Array.isArray(svcRes.value) ? svcRes.value : []);
      if (sysRes.status === 'fulfilled') setSystem(sysRes.value);
      if (procRes.status === 'fulfilled') setProcesses(procRes.value?.processes || []);
      if (netRes.status === 'fulfilled') setInterfaces(netRes.value?.interfaces || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  const refresh = () => { setSpin(true); load(); setTimeout(() => setSpin(false), 600); };

  const online = services.filter(s => s.status === 'online').length;
  const errored = services.filter(s => s.status === 'errored').length;
  const memPct = system ? Math.round((system.memory.used / system.memory.total) * 100) : 0;
  const alerts = services.filter(s => s.status !== 'online').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server size={20} className="text-os-cyan" />
          <div>
            <h1 className="text-lg font-semibold text-os-text">System Dashboard</h1>
            <p className="text-xs text-os-muted">{online}/{services.length} Services online · {errored} Fehler</p>
          </div>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text transition-colors">
          <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'CPU', value: system ? `${system.cpu.loadPct}%` : '—', icon: Cpu, color: system && system.cpu.loadPct > 80 ? 'text-os-red' : 'text-os-cyan' },
          { label: 'RAM', value: `${memPct}%`, icon: MemoryStick, color: memPct > 80 ? 'text-os-red' : 'text-os-cyan' },
          { label: 'Disk', value: system?.disk.pct ?? '—', icon: HardDrive, color: parseInt(system?.disk.pct ?? '0') > 80 ? 'text-os-red' : 'text-os-green' },
          { label: 'Uptime', value: system ? formatUptime(system.uptime) : '—', icon: Clock, color: 'text-os-green' },
          { label: 'Online', value: `${online}/${services.length}`, icon: CheckCircle2, color: errored > 0 ? 'text-os-yellow' : 'text-os-green' },
          { label: 'Alerts', value: String(alerts), icon: Bell, color: alerts > 0 ? 'text-os-red' : 'text-os-green' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-os-border bg-os-surface p-4">
            <div className="flex items-center gap-2 text-os-muted mb-2"><kpi.icon size={14} /><span className="text-[10px] uppercase tracking-wider">{kpi.label}</span></div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-os-border bg-os-surface p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${tab === t.id ? 'bg-os-bg text-os-cyan' : 'text-os-muted hover:text-os-text'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'services' && <ServicesTab services={services} loading={loading} />}
      {tab === 'processes' && <ProcessesTab processes={processes} loading={loading} />}
      {tab === 'logs' && <LogsTab services={services} logs={logs} setLogs={setLogs} />}
      {tab === 'network' && <NetworkTab interfaces={interfaces} loading={loading} />}
      {tab === 'metrics' && <MetricsTab system={system} loading={loading} />}
      {tab === 'alerts' && <AlertsTab services={services} loading={loading} />}
    </div>
  );
}

/* ─── Services Tab ─── */
function ServicesTab({ services, loading }: { services: Service[]; loading: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {loading && !services.length ? [...Array(6)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-os-surface animate-pulse" />) :
        services.map(svc => (
          <div key={svc.name} className={`rounded-xl border p-4 ${svc.status === 'online' ? 'border-os-green/20 bg-os-green/5' : svc.status === 'errored' ? 'border-os-red/20 bg-os-red/5' : 'border-os-yellow/20 bg-os-yellow/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[svc.status] || 'bg-os-muted'}`} />
                <span className="text-sm font-semibold text-os-text">{svc.name}</span>
              </div>
              <span className={`text-[10px] uppercase font-bold ${STATUS[svc.status] || 'text-os-muted'}`}>{svc.status}</span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2"><span className="w-8 text-[10px] text-os-muted">CPU</span><ProgressBar value={svc.cpu} max={50} /><span className="w-8 text-right text-[11px] text-os-muted">{svc.cpu}%</span></div>
              <div className="flex items-center gap-2"><span className="w-8 text-[10px] text-os-muted">RAM</span><ProgressBar value={svc.memory} max={512} /><span className="w-10 text-right text-[11px] text-os-muted">{svc.memory}MB</span></div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-os-muted">
              <span>Restarts: {svc.restarts}</span>
              {svc.uptime > 0 && <span>Seit: {new Date(svc.uptime).toLocaleTimeString()}</span>}
            </div>
          </div>
        ))}
    </div>
  );
}

/* ─── Processes Tab ─── */
function ProcessesTab({ processes, loading }: { processes: Process[]; loading: boolean }) {
  const [search, setSearch] = useState('');
  const filtered = processes.filter(p => !search || p.command.toLowerCase().includes(search.toLowerCase()) || String(p.pid).includes(search)).slice(0, 60);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-os-border bg-os-surface px-3 py-2">
        <Search size={13} className="text-os-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Prozesse suchen..." className="flex-1 bg-transparent text-sm text-os-text placeholder-os-muted outline-none" />
      </div>
      <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-os-border">
            <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">PID</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">User</th>
            <th className="px-4 py-2 text-right text-[10px] uppercase text-os-muted">CPU%</th>
            <th className="px-4 py-2 text-right text-[10px] uppercase text-os-muted">MEM%</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">Command</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-os-muted">Keine Prozesse</td></tr> :
              filtered.map(p => (
                <tr key={p.pid} className="border-b border-os-border/50 hover:bg-os-bg transition-colors">
                  <td className="px-4 py-2 text-os-muted font-mono">{p.pid}</td>
                  <td className="px-4 py-2 text-os-muted">{p.user}</td>
                  <td className={`px-4 py-2 text-right font-mono ${p.cpu > 10 ? 'text-os-yellow' : 'text-os-text'}`}>{p.cpu.toFixed(1)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${p.memory > 10 ? 'text-os-yellow' : 'text-os-text'}`}>{p.memory.toFixed(1)}</td>
                  <td className="px-4 py-2 text-os-text truncate max-w-xs font-mono">{p.command}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-os-muted text-right">{filtered.length} Prozesse</p>
    </div>
  );
}

/* ─── Logs Tab ─── */
function LogsTab({ services, logs, setLogs }: { services: Service[]; logs: Record<string, LogData>; setLogs: React.Dispatch<React.SetStateAction<Record<string, LogData>>> }) {
  const [selectedSvc, setSelectedSvc] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const loadLog = async (name: string) => {
    if (logs[name]) return;
    setLoading(true);
    try {
      const data = await fetch(`/api/logs/${name}?lines=80`).then(r => r.json());
      setLogs(prev => ({ ...prev, [name]: data }));
    } catch {}
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-os-muted">Service:</span>
        <select value={selectedSvc} onChange={e => { setSelectedSvc(e.target.value); loadLog(e.target.value); }}
          className="rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-text outline-none">
          <option value="">Wählen...</option>
          {services.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </div>
      {selectedSvc && logs[selectedSvc] ? (
        <div className="rounded-xl border border-os-border bg-os-surface p-4 space-y-4">
          {logs[selectedSvc].out && (
            <div>
              <p className="text-[9px] uppercase text-os-muted mb-1">stdout</p>
              <pre className="text-[10px] text-os-text font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{logs[selectedSvc].out.split('\n').slice(-30).join('\n')}</pre>
            </div>
          )}
          {logs[selectedSvc].err && (
            <div>
              <p className="text-[9px] uppercase text-os-red mb-1">stderr</p>
              <pre className="text-[10px] text-os-red/80 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">{logs[selectedSvc].err.split('\n').slice(-10).join('\n')}</pre>
            </div>
          )}
        </div>
      ) : loading ? <div className="text-xs text-os-muted">Lade Logs...</div> : <div className="text-xs text-os-muted">Service auswählen um Logs anzuzeigen</div>}
    </div>
  );
}

/* ─── Network Tab ─── */
function NetworkTab({ interfaces, loading }: { interfaces: NetInterface[]; loading: boolean }) {
  return (
    <div>
      <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-os-border">
            <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">Interface</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">IP</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">MAC</th>
            <th className="px-4 py-2 text-left text-[10px] uppercase text-os-muted">Status</th>
            <th className="px-4 py-2 text-right text-[10px] uppercase text-os-muted">RX</th>
            <th className="px-4 py-2 text-right text-[10px] uppercase text-os-muted">TX</th>
          </tr></thead>
          <tbody>
            {interfaces.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-os-muted">{loading ? 'Lade...' : 'Keine Daten'}</td></tr> :
              interfaces.map((iface) => (
                <tr key={iface.name} className="border-b border-os-border/50 hover:bg-os-bg transition-colors">
                  <td className="px-4 py-2 text-os-text font-mono">{iface.name}</td>
                  <td className="px-4 py-2 text-os-text font-mono">{iface.ip}</td>
                  <td className="px-4 py-2 text-os-muted font-mono">{iface.mac}</td>
                  <td className="px-4 py-2"><span className={`text-[10px] uppercase ${iface.status === 'up' ? 'text-os-green' : 'text-os-red'}`}>{iface.status}</span></td>
                  <td className="px-4 py-2 text-right text-os-muted">{iface.rx}</td>
                  <td className="px-4 py-2 text-right text-os-muted">{iface.tx}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Metrics Tab ─── */
function MetricsTab({ system, loading }: { system: SystemInfo | null; loading: boolean }) {
  if (loading && !system) return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-os-surface animate-pulse" />)}</div>;
  if (!system) return <div className="text-os-muted text-sm">Keine Daten</div>;
  const ramPct = Math.round((system.memory.used / system.memory.total) * 100);
  const diskPct = parseInt(system.disk.pct, 10);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'CPU Load', value: `${system.cpu.loadPct.toFixed(1)}%`, sub: `${system.cpu.cores} Cores`, pct: system.cpu.loadPct },
          { label: 'RAM', value: `${ramPct}%`, sub: `von ${system.memory.total / 1024 / 1024}MB`, pct: ramPct },
          { label: 'Disk', value: system.disk.pct, sub: `${system.disk.used} von ${system.disk.total}`, pct: diskPct },
          { label: 'Uptime', value: formatUptime(system.uptime), sub: 'Server läuft' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-os-border bg-os-surface p-4">
            <span className="text-[10px] text-os-muted uppercase tracking-wider">{m.label}</span>
            <p className="text-2xl font-bold text-os-text mt-2">{m.value}</p>
            {m.sub && <p className="text-xs text-os-muted">{m.sub}</p>}
            {m.pct !== undefined && <ProgressBar value={m.pct} color={m.pct > 80 ? 'bg-os-red' : m.pct > 60 ? 'bg-os-yellow' : 'bg-os-green'} />}
          </div>
        ))}
      </div>
      <div>
        <p className="text-sm font-semibold text-os-text mb-3">Load Average</p>
        <div className="grid grid-cols-3 gap-3">
          {[{ l: '1 Minute', v: system.loadAvg['1m'] }, { l: '5 Minuten', v: system.loadAvg['5m'] }, { l: '15 Minuten', v: system.loadAvg['15m'] }].map(({ l, v }) => (
            <div key={l} className="rounded-xl border border-os-border bg-os-surface p-4 text-center">
              <p className="text-2xl font-bold text-os-text">{v.toFixed(2)}</p>
              <p className="text-xs text-os-muted">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Alerts Tab ─── */
function AlertsTab({ services, loading }: { services: Service[]; loading: boolean }) {
  const unhealthy = services.filter(s => s.status !== 'online');
  return (
    <div className="space-y-6">
      {/* Current Issues */}
      <div>
        <p className="text-sm font-semibold text-os-text mb-3">Current Issues</p>
        {loading && !services.length ? <div className="h-10 rounded-xl bg-os-surface animate-pulse" /> :
          unhealthy.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-os-green/30 bg-os-green/10 px-4 py-3">
              <CheckCircle2 size={16} className="text-os-green" />
              <p className="text-sm font-medium text-os-green">Alle Services healthy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {unhealthy.map(svc => (
                <div key={svc.id} className="flex items-center gap-3 rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3">
                  <XCircle size={16} className="text-os-red" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-os-red">{svc.name}</p>
                    <p className="text-xs text-os-red/70">Status: {svc.status} — Restarts: {svc.restarts}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Service Health Table */}
      <div>
        <p className="text-sm font-semibold text-os-text mb-3">Service Health ({services.length})</p>
        <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2 bg-os-elevated border-b border-os-border">
            <span className="text-[10px] font-bold uppercase text-os-muted">Service</span>
            <span className="text-[10px] font-bold uppercase text-os-muted">Status</span>
            <span className="text-[10px] font-bold uppercase text-os-muted">Restarts</span>
          </div>
          {services.map(svc => (
            <div key={svc.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-os-border/50 px-4 py-3 last:border-0 hover:bg-os-elevated/50">
              <span className="text-sm text-os-text truncate">{svc.name}</span>
              <span className={`text-[10px] uppercase font-bold ${STATUS[svc.status] || 'text-os-muted'}`}>{svc.status}</span>
              <span className={`text-xs font-medium ${svc.restarts > 3 ? 'text-os-red' : svc.restarts > 0 ? 'text-os-yellow' : 'text-os-muted'}`}>{svc.restarts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
