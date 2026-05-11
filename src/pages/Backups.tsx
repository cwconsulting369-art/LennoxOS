import { useEffect, useState, useCallback } from 'react';
import { HardDrive, Shield, Clock, RefreshCw, Server, Archive, FileArchive } from 'lucide-react';

interface MonitorData {
  disk: { total: string; used: string; free: string; pct: string };
}

interface BackupEntry {
  name: string;
  path: string;
  size: number;
  mtime: string;
}

function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB';
  return b + ' B';
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return 'Gerade eben';
  if (h < 24) return `vor ${h}h`;
  const d = Math.floor(h / 24);
  return `vor ${d}d`;
}

export default function Backups() {
  const [disk, setDisk] = useState<MonitorData['disk'] | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const [monRes, bakRes] = await Promise.all([
        fetch('/api/monitor'),
        fetch('/api/backups'),
      ]);
      if (monRes.ok) {
        const j: MonitorData = await monRes.json();
        setDisk(j.disk);
      }
      if (bakRes.ok) {
        const j = await bakRes.json();
        setBackups(j.backups ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const diskPct = disk ? parseInt(disk.pct, 10) : 0;
  const barColor = diskPct < 60 ? 'bg-os-green' : diskPct < 80 ? 'bg-os-yellow' : 'bg-os-red';
  const totalSize = backups.reduce((s, b) => s + b.size, 0);

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
            <p className="text-xs text-os-muted">{backups.length} Backup-Dateien · {fmtBytes(totalSize)}</p>
          </div>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:border-os-accent/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

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
              <span className={`text-sm font-bold ${diskPct < 60 ? 'text-os-green' : diskPct < 80 ? 'text-os-yellow' : 'text-os-red'}`}>
                {disk.pct}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-os-border mb-3">
              <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: disk.pct }} />
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

      {/* Backup-Provider */}
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
                <span className="rounded-full bg-os-green/10 border border-os-green/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-os-green">
                  Aktiv
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mt-3">
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
                  <p className="text-os-muted mb-0.5">Letztes Sync</p>
                  <p className="font-medium text-os-green">
                    {backups.length > 0 ? relTime(backups[0].mtime) : 'Unbekannt'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backup-Liste */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Backup-Dateien</p>
        {loading && backups.length === 0 ? (
          <div className="space-y-2">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl border border-os-border bg-os-surface p-3 animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="h-8 w-8 rounded-lg bg-os-border/60 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-48 rounded bg-os-border/60" />
                    <div className="h-3 w-24 rounded bg-os-border/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-6 text-center">
            <Archive size={18} className="mx-auto mb-2 text-os-muted" />
            <p className="text-sm text-os-muted">Keine Backup-Dateien gefunden.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div key={b.path} className="rounded-xl border border-os-border bg-os-surface px-4 py-3 flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-os-elevated">
                  <FileArchive size={14} className="text-os-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-os-text truncate">{b.name}</p>
                  <p className="text-xs text-os-muted">{b.path !== b.name ? b.path + ' · ' : ''}{fmtBytes(b.size)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Clock size={11} className="text-os-muted" />
                  <span className="text-xs text-os-muted">{relTime(b.mtime)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-os-border bg-os-surface/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Archive size={13} className="text-os-muted flex-shrink-0" />
          <p className="text-xs text-os-muted">
            Backup-Automation via Hetzner Storage Box. Manuelle Verifikation via SSH jederzeit möglich.
          </p>
        </div>
      </div>
    </div>
  );
}
