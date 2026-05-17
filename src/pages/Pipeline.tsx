import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Users, Trophy, RefreshCw, ChevronRight } from 'lucide-react';

interface PipelineEntry {
  file: string;
  name: string;
  status: string;
  priority: string;
  lastContact: string;
  nextAction: string;
  dealValue: string;
  linkedIssue: string;
}

interface PipelineData {
  leads: PipelineEntry[];
  prospects: PipelineEntry[];
  customers: PipelineEntry[];
  '99-archive': PipelineEntry[];
}

type TabKey = 'leads' | 'prospects' | 'customers' | 'archive';

const PRIORITY_BADGE: Record<string, string> = {
  A: 'text-os-red border-os-red/40 bg-os-red/10',
  B: 'text-os-yellow border-os-yellow/40 bg-os-yellow/10',
  C: 'text-os-muted border-os-muted/40 bg-os-muted/5',
};


function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function EntryCard({ entry, highlight = false }: { entry: PipelineEntry; highlight?: boolean }) {
  const priorityStyle = PRIORITY_BADGE[entry.priority] ?? PRIORITY_BADGE.C;

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        highlight
          ? 'border-os-accent/50 bg-os-accent/5 ring-1 ring-os-accent/20'
          : 'border-os-border bg-os-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-os-text">{entry.name}</h3>
            {highlight && (
              <span className="inline-flex items-center rounded-full border border-os-accent/40 px-2 py-0.5 text-[10px] font-bold uppercase text-os-accent">
                Key Account
              </span>
            )}
          </div>
          <span className="text-[11px] text-os-muted">{entry.status}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityStyle}`}>
            {entry.priority}
          </span>
          {entry.dealValue && (
            <span className="text-[11px] font-semibold text-os-green whitespace-nowrap">
              {entry.dealValue}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <p className="text-os-muted mb-0.5">Last Contact</p>
          <p className="text-os-text">{formatDate(entry.lastContact)}</p>
        </div>
        {entry.linkedIssue && (
          <div>
            <p className="text-os-muted mb-0.5">Linked Issue</p>
            <p className="font-mono text-os-accent">{entry.linkedIssue}</p>
          </div>
        )}
      </div>

      {entry.nextAction && (
        <div className="flex items-start gap-2 rounded-lg border border-os-border bg-os-bg px-3 py-2">
          <ChevronRight size={12} className="text-os-accent mt-0.5 shrink-0" />
          <p className="text-[11px] text-os-text leading-snug">{entry.nextAction}</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ stage }: { stage: string }) {
  return (
    <div className="rounded-xl border border-dashed border-os-border bg-os-surface p-8 text-center space-y-2">
      <p className="text-sm text-os-muted">Keine Einträge</p>
      <p className="text-[11px] text-os-muted/60">
        Lade Daten aus personal-os/03-pipeline/{stage}/
      </p>
    </div>
  );
}

export default function Pipeline() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('prospects');
  const [spin, setSpin] = useState(false);

  const fetchData = useCallback(async () => {
    setSpin(true);
    setError(null);
    try {
      const res = await fetch('/api/pipeline');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: PipelineData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
      setSpin(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const leads = data?.leads ?? [];
  const prospects = data?.prospects ?? [];
  const customers = data?.customers ?? [];
  const archive = data?.['99-archive'] ?? [];

  const allProspects = prospects;

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: 'leads', label: 'Leads', count: leads.length },
    { key: 'prospects', label: 'Prospects', count: prospects.length },
    { key: 'customers', label: 'Customers', count: customers.length },
    { key: 'archive', label: 'Archive', count: archive.length },
  ];

  const currentEntries: PipelineEntry[] =
    tab === 'leads'
      ? leads
      : tab === 'prospects'
      ? allProspects
      : tab === 'customers'
      ? customers
      : archive;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-os-green" />
          <h1 className="text-lg font-semibold text-os-text">Sales Pipeline</h1>
          <span className="text-[11px] text-os-muted">personal-os/03-pipeline</span>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors"
        >
          <RefreshCw size={12} className={spin ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-os-border bg-os-surface p-4 flex items-center gap-4">
          <div className="rounded-lg bg-os-blue/10 border border-os-blue/20 p-2">
            <Users size={18} className="text-os-blue" />
          </div>
          <div>
            <p className="text-[11px] text-os-muted">Leads</p>
            <p className="text-2xl font-bold text-os-text">{loading ? '—' : leads.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4 flex items-center gap-4">
          <div className="rounded-lg bg-os-yellow/10 border border-os-yellow/20 p-2">
            <TrendingUp size={18} className="text-os-yellow" />
          </div>
          <div>
            <p className="text-[11px] text-os-muted">Prospects</p>
            <p className="text-2xl font-bold text-os-text">{loading ? '—' : allProspects.length}</p>
          </div>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4 flex items-center gap-4">
          <div className="rounded-lg bg-os-green/10 border border-os-green/20 p-2">
            <Trophy size={18} className="text-os-green" />
          </div>
          <div>
            <p className="text-[11px] text-os-muted">Customers</p>
            <p className="text-2xl font-bold text-os-text">{loading ? '—' : customers.length}</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-os-yellow/30 bg-os-yellow/10 px-4 py-3 text-sm text-os-yellow">
          API unavailable — showing cached/static data. ({error})
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-os-border bg-os-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-os-elevated text-os-text border border-os-border'
                : 'text-os-muted hover:text-os-text'
            }`}
          >
            {t.label}
            <span
              className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                tab === t.key ? 'bg-os-accent/20 text-os-accent' : 'bg-os-border text-os-muted'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-xl border border-os-border bg-os-surface p-4 animate-pulse">
                <div className="h-4 w-40 rounded bg-os-border mb-2" />
                <div className="h-3 w-24 rounded bg-os-border mb-3" />
                <div className="h-3 w-full rounded bg-os-border" />
              </div>
            ))}
          </div>
        ) : currentEntries.length === 0 ? (
          <EmptyState stage={tab} />
        ) : (
          currentEntries.map((entry, idx) => (
            <EntryCard
              key={entry.file || idx}
              entry={entry}
              highlight={entry.name === 'Hoffmann Eitle'}
            />
          ))
        )}
      </div>
    </div>
  );
}
