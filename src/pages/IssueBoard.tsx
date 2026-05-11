import { useState, useEffect, useCallback } from 'react';
import { CircleDot, Search, RefreshCw, AlertCircle, Clock } from 'lucide-react';

interface Issue {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'open' | 'blocked' | 'backlog';
  priority?: 'high' | 'medium' | 'low';
  assigneeId?: string;
  labels?: string[];
  createdAt?: string;
  updatedAt?: string;
}

type Column = 'Todo' | 'In Progress' | 'In Review' | 'Done';

const COLUMN_MAP: Record<Issue['status'], Column> = {
  open: 'Todo',
  todo: 'Todo',
  backlog: 'Todo',
  in_progress: 'In Progress',
  blocked: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

const COLUMN_ORDER: Column[] = ['Todo', 'In Progress', 'In Review', 'Done'];

const COLUMN_ACCENT: Record<Column, string> = {
  Todo: 'border-os-muted/40 text-os-muted',
  'In Progress': 'border-os-accent/60 text-os-accent',
  'In Review': 'border-os-yellow/60 text-os-yellow',
  Done: 'border-os-green/60 text-os-green',
};

const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-l-os-red',
  medium: 'border-l-os-yellow',
  low: 'border-l-os-muted',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'text-os-red border-os-red/40',
  medium: 'text-os-yellow border-os-yellow/40',
  low: 'text-os-muted border-os-muted/40',
};

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-os-border bg-os-elevated p-3 animate-pulse border-l-4 border-l-os-border space-y-2">
      <div className="h-3 w-16 rounded bg-os-border" />
      <div className="h-4 w-full rounded bg-os-border" />
      <div className="h-3 w-24 rounded bg-os-border" />
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const borderColor = PRIORITY_BORDER[issue.priority ?? 'low'] ?? 'border-l-os-muted';
  const priorityStyle = PRIORITY_LABEL[issue.priority ?? 'low'] ?? PRIORITY_LABEL.low;

  return (
    <div className={`rounded-xl border border-os-border bg-os-elevated p-3 border-l-4 ${borderColor} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-os-muted bg-os-bg px-1.5 py-0.5 rounded border border-os-border">
          {issue.id}
        </span>
        {issue.priority && (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${priorityStyle}`}>
            {issue.priority}
          </span>
        )}
      </div>
      <p className="text-[13px] text-os-text leading-snug line-clamp-2">{issue.title}</p>
      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {issue.labels.slice(0, 3).map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full border border-os-accent/30 px-2 py-0.5 text-[10px] font-bold uppercase text-os-accent"
            >
              {label}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 text-[11px] text-os-muted">
        <Clock size={10} />
        <span>{relativeTime(issue.updatedAt ?? issue.createdAt)}</span>
      </div>
    </div>
  );
}

export default function IssueBoard() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [spin, setSpin] = useState(false);

  const fetchIssues = useCallback(async () => {
    setSpin(true);
    setError(null);
    try {
      const res = await fetch('/api/issues');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Issue[] = await res.json();
      setIssues(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load issues');
    } finally {
      setLoading(false);
      setSpin(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, 30000);
    return () => clearInterval(interval);
  }, [fetchIssues]);

  const filtered = issues.filter(
    (i) =>
      search === '' ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.id.toLowerCase().includes(search.toLowerCase())
  );

  const byColumn: Record<Column, Issue[]> = {
    Todo: [],
    'In Progress': [],
    'In Review': [],
    Done: [],
  };
  for (const issue of filtered) {
    const col = COLUMN_MAP[issue.status] ?? 'Todo';
    byColumn[col].push(issue);
  }

  const totals = {
    total: issues.length,
    todo: issues.filter((i) => COLUMN_MAP[i.status] === 'Todo').length,
    inProgress: issues.filter((i) => COLUMN_MAP[i.status] === 'In Progress').length,
    inReview: issues.filter((i) => COLUMN_MAP[i.status] === 'In Review').length,
    done: issues.filter((i) => COLUMN_MAP[i.status] === 'Done').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CircleDot size={20} className="text-os-accent" />
          <h1 className="text-lg font-semibold text-os-text">Issue Board</h1>
          <span className="text-[11px] text-os-muted">Paperclip Kanban</span>
        </div>
        <button
          onClick={fetchIssues}
          className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors"
        >
          <RefreshCw size={12} className={spin ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: totals.total, color: 'text-os-text' },
          { label: 'Todo', value: totals.todo, color: 'text-os-muted' },
          { label: 'In Progress', value: totals.inProgress, color: 'text-os-accent' },
          { label: 'In Review', value: totals.inReview, color: 'text-os-yellow' },
          { label: 'Done', value: totals.done, color: 'text-os-green' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-os-border bg-os-surface p-4">
            <p className="text-[11px] text-os-muted mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-os-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or ID…"
          className="w-full rounded-lg border border-os-border bg-os-surface pl-9 pr-4 py-2 text-sm text-os-text placeholder:text-os-muted focus:outline-none focus:border-os-accent/60"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-4 gap-4">
        {COLUMN_ORDER.map((col) => (
          <div key={col} className="space-y-3">
            {/* Column header */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${COLUMN_ACCENT[col]}`}>
                {col}
              </span>
              <span className="text-[11px] text-os-muted">{byColumn[col].length}</span>
            </div>

            {/* Cards */}
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : byColumn[col].length === 0 ? (
              <div className="rounded-xl border border-dashed border-os-border p-4 text-center text-[11px] text-os-muted">
                No issues
              </div>
            ) : (
              byColumn[col].map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
