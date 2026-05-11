import { useEffect, useState, useCallback } from 'react';
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  RefreshCw,
  Activity,
  Gauge,
} from 'lucide-react';

interface MonitorData {
  memory: { total: number; used: number };
  loadAvg: { '1m': number; '5m': number; '15m': number };
  cpu: { cores: number; loadPct: number };
  disk: { total: string; used: string; free: string; pct: string };
  uptime: number;
}

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-os-border/50">
        <Clock size={20} className="text-os-muted" />
      </div>
      <p className="text-sm font-medium text-os-text">{title}</p>
      <p className="mt-1 text-xs text-os-muted">{description}</p>
      <span className="mt-3 inline-flex items-center rounded-full bg-os-yellow/10 border border-os-yellow/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
        Kommt bald
      </span>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const color =
    pct < 60 ? 'bg-os-green' : pct < 80 ? 'bg-os-yellow' : 'bg-os-red';
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-os-border">
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  pct,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  pct?: number;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-os-border/60">
          <Icon size={14} className="text-os-muted" />
        </div>
        <span className="text-xs font-medium text-os-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-os-text">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-os-muted">{sub}</p>}
      {pct !== undefined && <ProgressBar pct={pct} />}
    </div>
  );
}

export default function Metrics() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/monitor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MonitorData = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const ramPct = data
    ? Math.round((data.memory.used / data.memory.total) * 100)
    : 0;
  const diskPct = data ? parseInt(data.disk.pct, 10) : 0;

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
            <p className="text-xs text-os-muted">
              Zuletzt: {lastRefresh.toLocaleTimeString('de-DE')}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:border-os-accent/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">
          Fehler beim Laden: {error}
        </div>
      )}

      {/* KPI Grid */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-os-border bg-os-surface p-4 animate-pulse"
            >
              <div className="h-8 w-8 rounded-lg bg-os-border/60 mb-3" />
              <div className="h-7 w-24 rounded bg-os-border/60 mb-1" />
              <div className="h-3 w-16 rounded bg-os-border/40" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={Gauge}
            label="CPU Load"
            value={`${data.cpu.loadPct.toFixed(1)}%`}
            sub={`${data.cpu.cores} Cores`}
            pct={data.cpu.loadPct}
          />
          <KpiCard
            icon={MemoryStick}
            label="RAM"
            value={formatBytes(data.memory.used)}
            sub={`von ${formatBytes(data.memory.total)}`}
            pct={ramPct}
          />
          <KpiCard
            icon={HardDrive}
            label="Disk"
            value={data.disk.used}
            sub={`von ${data.disk.total} — ${data.disk.free} frei`}
            pct={diskPct}
          />
          <KpiCard
            icon={Clock}
            label="Uptime"
            value={formatUptime(data.uptime)}
            sub="Server läuft"
          />
        </div>
      ) : null}

      {/* Load Average */}
      {data && (
        <div>
          <p className="mb-3 text-sm font-semibold text-os-text">
            Load Average
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { label: '1 Minute', value: data.loadAvg['1m'] },
                { label: '5 Minuten', value: data.loadAvg['5m'] },
                { label: '15 Minuten', value: data.loadAvg['15m'] },
              ] as const
            ).map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-os-border bg-os-surface p-4 text-center"
              >
                <p className="text-2xl font-bold text-os-text">
                  {(value as number).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-os-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CPU Info */}
      {data && (
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={14} className="text-os-muted" />
            <span className="text-sm font-semibold text-os-text">CPU Details</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-os-muted mb-0.5">Cores</p>
              <p className="font-medium text-os-text">{data.cpu.cores}</p>
            </div>
            <div>
              <p className="text-xs text-os-muted mb-0.5">Auslastung</p>
              <p className="font-medium text-os-text">{data.cpu.loadPct.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-os-muted mb-0.5">Status</p>
              <p className={`font-medium ${data.cpu.loadPct < 80 ? 'text-os-green' : 'text-os-red'}`}>
                {data.cpu.loadPct < 60 ? 'Normal' : data.cpu.loadPct < 80 ? 'Erhöht' : 'Kritisch'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon: Charts */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Zeitreihen</p>
        <ComingSoon
          title="Zeitreihen-Charts"
          description="CPU/RAM/Disk über Zeit — kommt mit Grafana oder Prometheus-Integration"
        />
      </div>
    </div>
  );
}
