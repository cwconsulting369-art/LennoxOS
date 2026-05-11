import { useEffect, useState, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Clock,
} from 'lucide-react';

interface Service {
  id: string;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
  uptime: string | number;
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

function StatusBadge({ status }: { status: string }) {
  const isOnline = status === 'online';
  const isStopped = status === 'stopped' || status === 'errored';

  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-os-green/10 border border-os-green/20 px-2 py-0.5 text-[11px] font-medium text-os-green">
        <CheckCircle2 size={10} />
        online
      </span>
    );
  }
  if (isStopped) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-os-red/10 border border-os-red/20 px-2 py-0.5 text-[11px] font-medium text-os-red">
        <XCircle size={10} />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-os-yellow/10 border border-os-yellow/20 px-2 py-0.5 text-[11px] font-medium text-os-yellow">
      <AlertTriangle size={10} />
      {status}
    </span>
  );
}

export default function Alerts() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchServices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/services');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Service[] = await res.json();
      setServices(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    const interval = setInterval(() => fetchServices(true), 30_000);
    return () => clearInterval(interval);
  }, [fetchServices]);

  const unhealthy = services.filter((s) => s.status !== 'online');
  const allHealthy = services.length > 0 && unhealthy.length === 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
            <Bell size={18} className="text-os-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text">Alerts & Monitoring</h1>
            <p className="text-xs text-os-muted">
              Zuletzt: {lastRefresh.toLocaleTimeString('de-DE')}
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchServices(true)}
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

      {/* Current Issues */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Current Issues</p>
        {loading && !services.length ? (
          <div className="rounded-xl border border-os-border bg-os-surface p-4 animate-pulse">
            <div className="h-10 w-full rounded bg-os-border/40" />
          </div>
        ) : allHealthy ? (
          <div className="flex items-center gap-3 rounded-xl border border-os-green/30 bg-os-green/10 px-4 py-3">
            <CheckCircle2 size={16} className="text-os-green flex-shrink-0" />
            <p className="text-sm font-medium text-os-green">
              Alle Services healthy — kein aktiver Alert
            </p>
          </div>
        ) : unhealthy.length > 0 ? (
          <div className="space-y-2">
            {unhealthy.map((svc) => (
              <div
                key={svc.id}
                className="flex items-center gap-3 rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3"
              >
                <XCircle size={16} className="text-os-red flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-os-red">{svc.name}</p>
                  <p className="text-xs text-os-red/70">
                    Status: {svc.status} — Restarts: {svc.restarts}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Service Health Table */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">
          Service Health{' '}
          {services.length > 0 && (
            <span className="ml-1 rounded-full bg-os-border/60 px-2 py-0.5 text-[11px] text-os-muted">
              {services.length}
            </span>
          )}
        </p>
        {loading && !services.length ? (
          <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 border-b border-os-border last:border-0 animate-pulse"
              >
                <div className="h-3 w-32 rounded bg-os-border/60" />
                <div className="h-5 w-16 rounded-full bg-os-border/40" />
                <div className="ml-auto h-3 w-12 rounded bg-os-border/40" />
              </div>
            ))}
          </div>
        ) : services.length > 0 ? (
          <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-os-border px-4 py-2 bg-os-elevated">
              <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted">Service</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted">Status</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted hidden sm:block">CPU</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted hidden sm:block">MEM</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted">Restarts</span>
            </div>
            {services.map((svc) => (
              <div
                key={svc.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-os-border/50 px-4 py-3 last:border-0 hover:bg-os-elevated/50 transition-colors"
              >
                <span className="text-sm font-medium text-os-text truncate">{svc.name}</span>
                <StatusBadge status={svc.status} />
                <span className="text-xs text-os-muted hidden sm:block">{svc.cpu ?? 0}%</span>
                <span className="text-xs text-os-muted hidden sm:block">
                  {typeof svc.memory === 'number'
                    ? svc.memory > 1024
                      ? `${(svc.memory / 1024).toFixed(0)} MB`
                      : `${svc.memory} KB`
                    : '--'}
                </span>
                <span
                  className={`text-xs font-medium ${
                    (svc.restarts ?? 0) > 3
                      ? 'text-os-red'
                      : (svc.restarts ?? 0) > 0
                      ? 'text-os-yellow'
                      : 'text-os-muted'
                  }`}
                >
                  {svc.restarts ?? 0}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
            <Shield size={24} className="mx-auto mb-2 text-os-muted" />
            <p className="text-sm text-os-muted">Keine Services gefunden</p>
          </div>
        )}
      </div>

      {/* Coming Soon sections */}
      <div className="space-y-4">
        <div>
          <p className="mb-3 text-sm font-semibold text-os-text">Alert-Regeln</p>
          <ComingSoon
            title="Alert-Regeln"
            description="Schwellwerte für CPU, RAM, Disk und Service-Ausfälle konfigurieren"
          />
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-os-text">Benachrichtigungen</p>
          <ComingSoon
            title="PagerDuty / Telegram-Integration"
            description="Push-Alerts via Telegram Bot bei kritischen Events — Webhook-Config ausstehend"
          />
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-os-text">Historie</p>
          <ComingSoon
            title="Uptime-History"
            description="Historische Verfügbarkeit pro Service — 30/60/90 Tage Rückblick"
          />
        </div>
      </div>
    </div>
  );
}
