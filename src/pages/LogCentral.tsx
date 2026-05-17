'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, RefreshCw, Activity, Search, ChevronDown, Play, Pause } from 'lucide-react';

const SERVICES = [
  'lennox-os',
  'paperclip',
  'lennox-gold-bot',
  'openrouter-bridge',
  'idea-factory-bot',
  'agent-core',
  'chart-api',
  'cloudflared-tunnel',
  'lennox-terminal',
  'weekly-insight',
] as const;

type Service = (typeof SERVICES)[number];
type Tab = 'stdout' | 'stderr';

interface LogResponse {
  name: string;
  out: string;
  err: string;
}

export default function LogCentral() {
  const [service, setService] = useState<Service>('lennox-os');
  const [tab, setTab] = useState<Tab>('stdout');
  const [logData, setLogData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [search, setSearch] = useState('');
  const [cleared, setCleared] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCleared(false);
    try {
      const res = await fetch(`/api/logs/${service}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LogResponse = await res.json();
      setLogData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logData, tab]);

  const rawLog = logData ? (tab === 'stdout' ? logData.out : logData.err) : '';
  const lines = cleared ? [] : rawLog.split('\n').filter((l) => l.length > 0).slice(-150);

  const filteredLines = search.trim()
    ? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  function highlightLine(line: string) {
    if (!search.trim()) return line;
    const idx = line.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return line;
    return (
      line.slice(0, idx) +
      `\x1b[highlight]` +
      line.slice(idx, idx + search.length) +
      `\x1b[/highlight]` +
      line.slice(idx + search.length)
    );
  }

  function renderLine(line: string, i: number) {
    if (!search.trim()) {
      return (
        <div key={i} className="leading-5">
          {line}
        </div>
      );
    }
    const lower = line.toLowerCase();
    const searchLower = search.toLowerCase();
    const idx = lower.indexOf(searchLower);
    if (idx === -1) {
      return (
        <div key={i} className="leading-5 opacity-40">
          {line}
        </div>
      );
    }
    return (
      <div key={i} className="leading-5">
        {line.slice(0, idx)}
        <span className="bg-os-yellow text-os-bg font-semibold rounded px-0.5">
          {line.slice(idx, idx + search.length)}
        </span>
        {line.slice(idx + search.length)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-os-cyan" />
          <h1 className="text-lg font-semibold text-os-text">Log Central</h1>
          <span className="text-xs px-2 py-0.5 rounded-full border border-os-border text-os-muted">
            {service}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Line count badge */}
          <span className="text-xs px-2 py-1 rounded border border-os-border text-os-muted font-mono">
            {filteredLines.length} lines
          </span>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              autoRefresh
                ? 'border-os-cyan bg-os-cyan/10 text-os-cyan'
                : 'border-os-border text-os-muted hover:text-os-text'
            }`}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-3 h-3" /> Live
              </>
            ) : (
              <>
                <Activity className="w-3 h-3" /> Auto
              </>
            )}
          </button>

          {/* Manual refresh */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-os-border text-os-muted hover:text-os-text text-xs transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Clear view */}
          <button
            onClick={() => setCleared(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-os-border text-os-muted hover:text-os-red text-xs transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Service dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-os-border bg-os-surface text-os-text text-sm min-w-[200px] justify-between hover:border-os-cyan/40 transition-colors"
          >
            <span>{service}</span>
            <ChevronDown className="w-4 h-4 text-os-muted" />
          </button>
          {dropdownOpen && (
            <div className="absolute z-50 top-full mt-1 left-0 min-w-[200px] rounded-lg border border-os-border bg-os-elevated shadow-xl">
              {SERVICES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setService(s);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-os-surface transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    s === service ? 'text-os-cyan' : 'text-os-text'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-os-border overflow-hidden">
          {(['stdout', 'stderr'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-os-cyan/10 text-os-cyan border-r border-os-border last:border-r-0'
                  : 'text-os-muted hover:text-os-text border-r border-os-border last:border-r-0'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-2 rounded-lg border border-os-border bg-os-surface">
          <Search className="w-3.5 h-3.5 text-os-muted shrink-0" />
          <input
            type="text"
            placeholder="Filter lines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-os-text placeholder-os-muted outline-none w-full"
          />
        </div>
      </div>

      {/* Log output */}
      <div className="rounded-xl border border-os-border bg-os-bg overflow-hidden">
        {error && (
          <div className="px-4 py-3 text-xs text-os-red font-mono border-b border-os-border">
            Error: {error}
          </div>
        )}
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto p-4 font-mono text-xs text-os-green"
        >
          {loading && !logData ? (
            <div className="text-os-muted animate-pulse">Loading logs...</div>
          ) : filteredLines.length === 0 ? (
            <div className="text-os-muted">Keine Logs gefunden</div>
          ) : (
            filteredLines.map((line, i) => renderLine(line, i))
          )}
        </div>
        <div className="px-4 py-2 border-t border-os-border flex items-center justify-between">
          <span className="text-[10px] text-os-muted font-mono">
            {autoRefresh ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-os-green animate-pulse inline-block" />
                auto-refresh 5s
              </span>
            ) : (
              'auto-refresh off'
            )}
          </span>
          <span className="text-[10px] text-os-muted font-mono">
            showing last 150 lines · {filteredLines.length} visible
          </span>
        </div>
      </div>
    </div>
  );
}
