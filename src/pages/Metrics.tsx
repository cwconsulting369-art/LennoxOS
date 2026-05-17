import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Cpu, MemoryStick, HardDrive, Activity, RefreshCw, Clock } from 'lucide-react';
import { KPICard } from '../components/KPICard';

interface MonitorData {
  memory: { total: number; used: number };
  loadAvg: { '1m': number; '5m': number; '15m': number };
  cpu: { cores: number; loadPct: number };
  disk: { total: string; used: string; free: string; pct: string };
  uptime: number;
}

interface HistPoint {
  t: number;
  cpu: number;
  ram: number;
  load: number;
}

const GRID = '#1e2d4a';
const AXIS = '#4a5a7a';
const TT_STYLE = {
  backgroundColor: '#0f1629',
  border: '1px solid #1e2d4a',
  borderRadius: '6px',
  fontSize: '11px',
  color: '#c8d6f0',
};

function formatBytes(b: number) {
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(1) + ' GB';
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(0) + ' MB';
  return (b / 1024).toFixed(0) + ' KB';
}

function formatUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ClockBadge() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-xs text-os-secondary">{t.toLocaleTimeString('de-DE')}</span>;
}

const MAX_HIST = 40;

export default function Metrics() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [history, setHistory] = useState<HistPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const histRef = useRef<HistPoint[]>([]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/monitor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MonitorData = await res.json();
      setData(json);
      const point: HistPoint = {
        t: Date.now(),
        cpu: json.cpu.loadPct,
        ram: Math.round((json.memory.used / json.memory.total) * 100),
        load: json.loadAvg['1m'],
      };
      histRef.current = [...histRef.current, point].slice(-MAX_HIST);
      setHistory([...histRef.current]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(() => fetchData(true), 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const ramPct = data ? Math.round((data.memory.used / data.memory.total) * 100) : 0;
  const diskPct = data ? parseInt(data.disk.pct, 10) : 0;

  const chartData = history.map((p, i) => ({ i, cpu: p.cpu, ram: p.ram, load: p.load }));
  const cpuSparkline = history.map(p => p.cpu);
  const ramSparkline = history.map(p => p.ram);
  const loadSparkline = history.map(p => p.load);

  const diskBarData = data ? [
    { name: 'Disk', used: diskPct, free: 100 - diskPct },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
            <Activity size={18} className="text-os-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text">Metriken</h1>
            <p className="text-xs text-os-muted">System Performance — live</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-os-green/30 bg-os-green/10 px-2 py-0.5 text-xs text-os-green">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-os-green opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-os-green" />
              </span>
              {formatUptime(data.uptime)}
            </span>
          )}
          <ClockBadge />
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">
          {error}
        </div>
      )}

      {/* KPI Row */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border border-os-border bg-os-surface p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard
            label="CPU Load"
            value={`${data.cpu.loadPct.toFixed(1)}%`}
            sub={`${data.cpu.cores} Cores`}
            sparklineData={cpuSparkline}
            sparklineColor={data.cpu.loadPct > 80 ? '#ff4466' : data.cpu.loadPct > 60 ? '#ffcc00' : '#00d4ff'}
          />
          <KPICard
            label="RAM"
            value={formatBytes(data.memory.used)}
            sub={`von ${formatBytes(data.memory.total)} — ${ramPct}%`}
            sparklineData={ramSparkline}
            sparklineColor={ramPct > 80 ? '#ff4466' : ramPct > 60 ? '#ffcc00' : '#a855f7'}
          />
          <KPICard
            label="Disk /"
            value={data.disk.used}
            sub={`von ${data.disk.total} — ${data.disk.pct}`}
            sparklineData={[diskPct]}
            sparklineColor="#6366f1"
          />
          <KPICard
            label="Load Avg 1m"
            value={data.loadAvg['1m'].toFixed(2)}
            sub={`5m: ${data.loadAvg['5m'].toFixed(2)} · 15m: ${data.loadAvg['15m'].toFixed(2)}`}
            sparklineData={loadSparkline}
            sparklineColor="#ffcc00"
          />
        </div>
      ) : null}

      {/* Charts — only if history available */}
      {chartData.length > 1 && (
        <>
          {/* CPU + RAM over time */}
          <div className="rounded-lg border border-os-border bg-os-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Cpu size={14} className="text-os-accent" />
              <h3 className="text-sm font-semibold text-os-text">CPU & RAM über Zeit</h3>
              <span className="ml-auto text-[10px] text-os-muted">alle 15s · {chartData.length} Punkte</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis dataKey="i" hide />
                <YAxis domain={[0, 100]} tick={{ fill: AXIS, fontSize: 11 }} width={30} unit="%" />
                <Tooltip contentStyle={TT_STYLE as React.CSSProperties} formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: '11px', color: AXIS }} />
                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#00d4ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ram" name="RAM %" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Load + Disk side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Load Average */}
            <div className="rounded-lg border border-os-border bg-os-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity size={14} className="text-os-yellow" />
                <h3 className="text-sm font-semibold text-os-text">Load Average</h3>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="i" hide />
                  <YAxis tick={{ fill: AXIS, fontSize: 11 }} width={35} />
                  <Tooltip contentStyle={TT_STYLE as React.CSSProperties} formatter={(v: number) => v.toFixed(2)} />
                  <Area type="monotone" dataKey="load" name="1m Load" stroke="#ffcc00" fill="#ffcc00" fillOpacity={0.2} strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Disk */}
            <div className="rounded-lg border border-os-border bg-os-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <HardDrive size={14} className="text-os-purple" />
                <h3 className="text-sm font-semibold text-os-text">Disk Nutzung</h3>
              </div>
              {data && (
                <>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={diskBarData} layout="vertical">
                      <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: AXIS, fontSize: 11 }} unit="%" />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip contentStyle={TT_STYLE as React.CSSProperties} formatter={(v: number) => `${v}%`} />
                      <Bar dataKey="used" name="Belegt" fill="#a855f7" stackId="d" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="free" name="Frei" fill="#1e2d4a" stackId="d" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div className="text-center">
                      <p className="text-os-muted">Gesamt</p>
                      <p className="font-semibold text-os-text">{data.disk.total}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-os-muted">Belegt</p>
                      <p className="font-semibold text-os-purple">{data.disk.used}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-os-muted">Frei</p>
                      <p className="font-semibold text-os-green">{data.disk.free}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Waiting for history */}
      {chartData.length <= 1 && !loading && (
        <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-6 text-center">
          <Clock size={20} className="mx-auto mb-2 text-os-muted" />
          <p className="text-sm text-os-muted">Charts erscheinen nach ~30s (sammelt Datenpunkte alle 15s)</p>
        </div>
      )}
    </div>
  );
}
