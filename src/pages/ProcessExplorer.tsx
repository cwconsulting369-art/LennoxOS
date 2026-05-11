'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cpu, RefreshCw, Search, ChevronUp, ChevronDown, Activity } from 'lucide-react';

interface Process {
  pid: number;
  user: string;
  cpu: number;
  memory: number;
  command: string;
  started: string;
}

interface ProcessResponse {
  processes: Process[];
  total: number;
}

type SortKey = keyof Process;
type SortDir = 'asc' | 'desc';

function cpuColor(v: number) {
  if (v > 20) return 'text-os-red';
  if (v > 5) return 'text-os-yellow';
  return 'text-os-muted';
}

function memColor(v: number) {
  if (v > 20) return 'text-os-red';
  if (v > 5) return 'text-os-yellow';
  return 'text-os-muted';
}

const PAGE_SIZE = 100;

export default function ProcessExplorer() {
  const [data, setData] = useState<ProcessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('cpu');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/system/processes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ProcessResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProcesses();
    const id = setInterval(fetchProcesses, 10000);
    return () => clearInterval(id);
  }, [fetchProcesses]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  const processes = data?.processes ?? [];

  const filtered = processes.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.command.toLowerCase().includes(q) ||
      p.user.toLowerCase().includes(q) ||
      String(p.pid).includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    const dir = sortDir === 'asc' ? 1 : -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  const totalShown = Math.min(sorted.length, page * PAGE_SIZE);
  const visible = sorted.slice(0, totalShown);
  const hasMore = sorted.length > totalShown;

  const highCpu = processes.filter((p) => p.cpu > 5).length;
  const memHogs = processes.filter((p) => p.memory > 5).length;

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-20" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-os-cyan" />
    ) : (
      <ChevronDown className="w-3 h-3 text-os-cyan" />
    );
  }

  function ColHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-os-muted cursor-pointer hover:text-os-text select-none"
        onClick={() => handleSort(col)}
      >
        <span className="flex items-center gap-1">
          {label}
          <SortIcon col={col} />
        </span>
      </th>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-os-cyan" />
          <h1 className="text-lg font-semibold text-os-text">Process Explorer</h1>
        </div>
        <button
          onClick={fetchProcesses}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-os-border text-os-muted hover:text-os-text text-xs transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-os-muted mb-1">
            Total Processes
          </div>
          <div className="text-2xl font-semibold text-os-text font-mono">
            {data?.total ?? '—'}
          </div>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-os-muted mb-1">
            High CPU (&gt;5%)
          </div>
          <div className={`text-2xl font-semibold font-mono ${highCpu > 0 ? 'text-os-yellow' : 'text-os-text'}`}>
            {highCpu}
          </div>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-os-muted mb-1">
            Memory Hogs (&gt;5%)
          </div>
          <div className={`text-2xl font-semibold font-mono ${memHogs > 0 ? 'text-os-yellow' : 'text-os-text'}`}>
            {memHogs}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-os-border bg-os-surface max-w-sm">
        <Search className="w-3.5 h-3.5 text-os-muted shrink-0" />
        <input
          type="text"
          placeholder="Filter by command, user, PID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="bg-transparent text-sm text-os-text placeholder-os-muted outline-none w-full"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/5 px-4 py-3 text-xs text-os-red font-mono">
          Error: {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-os-elevated">
              <tr>
                <ColHeader col="pid" label="PID" />
                <ColHeader col="user" label="User" />
                <ColHeader col="cpu" label="CPU%" />
                <ColHeader col="memory" label="MEM%" />
                <ColHeader col="command" label="Command" />
                <ColHeader col="started" label="Started" />
              </tr>
            </thead>
            <tbody>
              {loading && visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-os-muted text-xs">
                    <Activity className="w-4 h-4 animate-pulse inline mr-2" />
                    Loading processes...
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-os-muted text-xs">
                    No processes found
                  </td>
                </tr>
              ) : (
                visible.map((p) => (
                  <tr key={p.pid} className="border-t border-os-border hover:bg-os-elevated/50 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-os-muted">{p.pid}</td>
                    <td className="px-3 py-2 text-xs text-os-text">{p.user}</td>
                    <td className={`px-3 py-2 font-mono text-xs ${cpuColor(p.cpu)}`}>
                      {p.cpu.toFixed(1)}
                    </td>
                    <td className={`px-3 py-2 font-mono text-xs ${memColor(p.memory)}`}>
                      {p.memory.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-os-text max-w-xs">
                      <span title={p.command}>{p.command.slice(0, 60)}{p.command.length > 60 ? '…' : ''}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-os-muted whitespace-nowrap">{p.started}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="px-4 py-3 border-t border-os-border flex items-center justify-between">
            <span className="text-xs text-os-muted">
              Showing {totalShown} of {sorted.length}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="text-xs px-3 py-1.5 rounded-lg border border-os-border text-os-cyan hover:bg-os-cyan/10 transition-colors"
            >
              Load more
            </button>
          </div>
        )}

        {!hasMore && visible.length > 0 && (
          <div className="px-4 py-2 border-t border-os-border">
            <span className="text-[10px] text-os-muted">
              {sorted.length} processes · auto-refresh 10s
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
