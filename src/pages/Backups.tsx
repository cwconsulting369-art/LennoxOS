import { useEffect, useState, useCallback } from 'react';
import { HardDrive, Shield, Clock, RefreshCw, Server, Archive } from 'lucide-react';

interface MonitorData {
  disk: { total: string; used: string; free: string; pct: string };
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

export default function Backups() {
  const [disk, setDisk] = useState<MonitorData['disk'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDisk = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/monitor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MonitorData = await res.json();
      setDisk(json.disk);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDisk();
  }, [fetchDisk]);

  const diskPct = disk ? parseInt(disk.pct, 10) : 0;
  const barColor =
    diskPct < 60 ? 'bg-os-green' : diskPct < 80 ? 'bg-os-yellow' : 'bg-os-red';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
            <HardDrive size={18} className="text-os-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text">Backups & Disk</h1>
            <p className="text-xs text-os-muted">Storage & Backup-Management</p>
          </div>
        </div>
        <button
          onClick={() => fetchDisk(true)}
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
          Fehler: {error}
        </div>
      )}

      {/* Disk usage */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Disk Usage</p>
        {loading && !disk ? (
          <div className="rounded-xl border border-os-border bg-os-surface p-4 animate-pulse">
            <div className="h-4 w-32 rounded bg-os-border/60 mb-3" />
            <div className="h-2 w-full rounded-full bg-os-border/60" />
          </div>
        ) : disk ? (
          <div className="rounded-xl border border-os-border bg-os-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server size={14} className="text-os-muted" />
                <span className="text-sm font-medium text-os-text">Haupt-Volume</span>
              </div>
              <span
                className={`text-sm font-bold ${
                  diskPct < 60
                    ? 'text-os-green'
                    : diskPct < 80
                    ? 'text-os-yellow'
                    : 'text-os-red'
                }`}
              >
                {disk.pct}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-os-border mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: disk.pct }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-os-muted mb-0.5">Gesamt</p>
                <p className="text-sm font-semibold text-os-text">{disk.total}</p>
              </div>
              <div>
                <p className="text-xs text-os-muted mb-0.5">Genutzt</p>
                <p className="text-sm font-semibold text-os-text">{disk.used}</p>
              </div>
              <div>
                <p className="text-xs text-os-muted mb-0.5">Frei</p>
                <p className="text-sm font-semibold text-os-green">{disk.free}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Hetzner Storage Box info */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Backup-Provider</p>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-os-green/10">
              <Shield size={16} className="text-os-green" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-os-text">Hetzner Storage Box</p>
                <span className="rounded-full bg-os-yellow/10 border border-os-yellow/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
                  Monitoring ausstehend
                </span>
              </div>
              <p className="text-xs text-os-muted mb-3">
                Offsite-Backup via Hetzner Storage Box. Backup-Automation aktiv,
                Monitoring-Integration ins Dashboard ausstehend.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-os-elevated px-3 py-2">
                  <p className="text-os-muted mb-0.5">Provider</p>
                  <p className="font-medium text-os-text">Hetzner Cloud</p>
                </div>
                <div className="rounded-lg bg-os-elevated px-3 py-2">
                  <p className="text-os-muted mb-0.5">Protokoll</p>
                  <p className="font-medium text-os-text">SFTP / rsync</p>
                </div>
                <div className="rounded-lg bg-os-elevated px-3 py-2">
                  <p className="text-os-muted mb-0.5">Retention</p>
                  <p className="font-medium text-os-text">7 Tage</p>
                </div>
                <div className="rounded-lg bg-os-elevated px-3 py-2">
                  <p className="text-os-muted mb-0.5">Status</p>
                  <p className="font-medium text-os-yellow">Unbekannt</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="rounded-xl border border-os-border bg-os-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Archive size={13} className="text-os-muted flex-shrink-0" />
          <p className="text-xs text-os-muted">
            Backup-Automation über Hetzner Storage Box läuft — Monitoring-Integration ins Dashboard ausstehend.
            Manuelle Verifikation via SSH möglich.
          </p>
        </div>
      </div>

      {/* Coming Soon sections */}
      <div className="space-y-4">
        <div>
          <p className="mb-3 text-sm font-semibold text-os-text">Backup-Liste</p>
          <ComingSoon
            title="Backup-Liste"
            description="Alle vorhandenen Backups mit Datum, Größe und Restore-Status"
          />
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-os-text">Backup-Zeitplan</p>
          <ComingSoon
            title="Backup-Zeitplan"
            description="Konfiguration der automatischen Backup-Intervalle und Retention-Policy"
          />
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold text-os-text">Restore</p>
          <ComingSoon
            title="Restore-Funktion"
            description="Backup-Wiederherstellung direkt aus dem Dashboard — One-Click Restore"
          />
        </div>
      </div>
    </div>
  );
}
