/* ============================================================
 * Command Center — API layer
 * Single typed fetch helper for the WAR ROOM dashboard.
 * Never surfaces raw API errors to the user (HARD rule:
 * professional-error-display). All endpoints already exist
 * in server.cjs and serve REAL data — no mocks.
 * ============================================================ */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new ApiError(res.status, `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/* ---------- Endpoint response shapes (subset we consume) ---------- */

export interface MonitorData {
  cpu: { cores: number; loadPct: number };
  loadAvg: { '1m': number; '5m': number; '15m': number };
  memory: { total: number; used: number };
  disk: { total: string; used: string; free: string; pct: string };
  uptime: number;
  timestamp: number;
}

export interface MasterOverview {
  generatedAt: string;
  cashflow: {
    mrr: { mrr: number; subscriptions: number; itemCount: number };
    recent: { totalCents: number; total: number; count: number; byProject: Record<string, number> };
  };
  agents: { standby?: boolean };
  services: { total: number; online: number; errored: number; stopped: number };
  vercel: { total: number; names: string[] };
  osHealth: Array<{ id: string; name: string; url: string; revenueSource?: string }>;
}

export interface HermesCostSummary {
  today: HermesCostBucket;
  week_7d: HermesCostBucket;
  month: HermesCostBucket;
}
export interface HermesCostBucket {
  runs: number;
  success: number;
  failed: number;
  cost_cents: number;
  tokens: number;
}

export interface HermesCostDaily {
  days: number;
  items: Array<{ date: string; total_cents: number; runs: number; success: number; failed: number }>;
}

export interface RegistryStats {
  total: number;
  by_status: Record<string, number>;
  by_role: Record<string, number>;
  by_project: Record<string, number>;
  cost_30d_total_eur: number;
  runs_30d_total: number;
}

export interface IdeasStats {
  total: number;
  neu: number;
  in_arbeit: number;
  erledigt: number;
  verworfen: number;
  duplicates: number;
  offen_hoch: number;
}

export interface ServiceRow {
  id: number;
  name: string;
  status: string;
  uptime: number;
  restarts: number;
  cpu: number;
  memory: number;
  pid: number;
}

export interface FinanceOverview {
  window_days: number;
  buckets: {
    projects: Array<{ project: string; cost_30d: number; sources: Record<string, number> }>;
  };
}

export interface EventRow {
  id?: number | string;
  project?: string;
  type?: string;
  message?: string;
  title?: string;
  created_at?: string;
  ts?: string;
}
export interface EventsResponse {
  events: EventRow[];
  total: number;
}

export interface HermesRun {
  id?: number | string;
  agent?: string;
  agent_id?: string;
  slug?: string;
  status?: string;
  cost_cents?: number;
  model_used?: string;
  created_at?: string;
  started_at?: string;
}

export type MomentumStatus = 'hot' | 'warm' | 'cool' | 'idle' | 'stale' | 'none';
export interface MomentumProject {
  key: string;
  label: string;
  prio: number;
  repo: string;
  exists: boolean;
  today: number;
  d7: number;
  d14: number;
  daily: number[];
  lastIso: string | null;
  lastRel: string | null;
  status: MomentumStatus;
  phase: string | null;
  nextAction: string | null;
  error?: boolean;
}
export interface MomentumData {
  generatedAt: string;
  today: string;
  streak: number;
  touchedToday: number;
  totalProjects: number;
  totalCommits14d: number;
  projects: MomentumProject[];
}

/* ---------- small formatters (shared, tabular-safe) ---------- */

export const fmt = {
  cents(c: number): string {
    return `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },
  int(n: number): string {
    return n.toLocaleString('de-DE');
  },
  pct(n: number): string {
    return `${Math.round(n)}%`;
  },
  bytesGB(bytes: number): string {
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  },
  uptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  },
  timeHM(iso?: string): string {
    if (!iso) return '--:--';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  },
};
