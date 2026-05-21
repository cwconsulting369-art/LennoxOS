import { useEffect, useState } from 'react';
import {
  TrendingUp, Bot, Activity, Globe, DollarSign, Layers, RefreshCw,
  ArrowUpRight, AlertTriangle, Wifi, WifiOff, ExternalLink, BarChart3,
} from 'lucide-react';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area,
} from 'recharts';

interface MasterData {
  generatedAt: string;
  cached?: boolean;
  cashflow: {
    mrr: { mrr: number; subscriptions: number; itemCount: number } | { error: string } | null;
    recent: { total: number; dailyRevenue: Array<{ date: string; amount: number }>; count: number } | null;
  };
  agents: { total: number; active: number; error: number } | { error: string } | null;
  services: { total: number; online: number; errored: number; stopped: number };
  vercel: { total: number; names: string[] } | null;
  traffic: { requests24h: number; bandwidth24h: number; uniques24h: number; cacheRatio: number } | { error: string } | null;
  osHealth: Array<{ id: string; name: string; url: string; status: string; revenueSource: string; httpStatus?: number }>;
}

const OS_ICONS: Record<string, string> = {
  aevum: '⚡', gts: '🥇', kevin: '🤖', ketolabs: '🧪',
  utilityhub: '🏢', thailand: '🏝️', script: '🎬',
};

const OS_INTERNAL_PAGE: Record<string, string> = {
  aevum: 'aevum', gts: 'gts', kevin: 'k3ngama', ketolabs: 'ketolabs',
  utilityhub: 'utilityhub', thailand: 'thailand', script: 'script',
};

function fmtEUR(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function fmtNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function MasterDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [data, setData] = useState<MasterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const d = await fetch('/api/master/overview').then(r => r.json());
      setData(d);
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const iv = setInterval(() => load(true), 60_000);
    return () => clearInterval(iv);
  }, []);

  const mrr = data?.cashflow.mrr && !('error' in data.cashflow.mrr) ? data.cashflow.mrr : null;
  const recent = data?.cashflow.recent && !('error' in (data.cashflow.recent as any)) ? data.cashflow.recent : null;
  const agents = data?.agents && !('error' in data.agents) ? data.agents : null;
  const traffic = data?.traffic && !('error' in (data.traffic as any)) ? data.traffic : null;
  const liveOS = data?.osHealth.filter(o => o.status === 'live').length || 0;

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-cyan/10">
            <Layers size={18} className="text-os-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text leading-tight">Master Dashboard</h1>
            <p className="text-[10px] text-os-muted">
              Aggregat über alle Projekte · {data ? `aktualisiert ${new Date(data.generatedAt).toLocaleTimeString('de-DE')}` : 'lädt…'}
            </p>
          </div>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-os-muted hover:text-os-cyan transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-os-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Kpi
              icon={DollarSign}
              label="MRR (Stripe)"
              value={mrr ? fmtEUR(mrr.mrr) : '—'}
              sub={mrr ? `${mrr.subscriptions} Subs aktiv` : 'kein Stripe-Connect'}
              color="text-os-yellow"
            />
            <Kpi
              icon={TrendingUp}
              label="30-Tage Revenue"
              value={recent ? fmtEUR(recent.total) : '—'}
              sub={recent ? `${recent.count} Transaktionen` : ''}
              color="text-os-green"
            />
            <Kpi
              icon={Layers}
              label="Live OS"
              value={`${liveOS} / ${data?.osHealth.length || 0}`}
              sub="Subdomain-Status"
              color="text-os-cyan"
            />
            <Kpi
              icon={Bot}
              label="Agents"
              value={agents ? agents.total : '—'}
              sub={agents ? `${agents.active} aktiv · ${agents.error} error` : 'Paperclip offline'}
              color={agents && agents.error > 0 ? 'text-os-red' : 'text-os-yellow'}
            />
            <Kpi
              icon={Activity}
              label="pm2 Services"
              value={`${data?.services.online || 0} / ${data?.services.total || 0}`}
              sub={data?.services.errored ? `⚠ ${data.services.errored} errored` : 'alle online'}
              color={data?.services.errored ? 'text-os-red' : 'text-os-green'}
            />
          </div>

          {/* Revenue Chart + Traffic */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-os-border bg-os-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-os-text flex items-center gap-2">
                  <BarChart3 size={13} className="text-os-yellow" /> Revenue · letzte 30 Tage
                </h3>
                {recent && <span className="text-xs text-os-muted">Summe: <span className="text-os-green font-bold">{fmtEUR(recent.total)}</span></span>}
              </div>
              <div className="h-48">
                {recent && recent.dailyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={recent.dailyRevenue}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#facc15" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#a8a29e' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} />
                      <Tooltip contentStyle={{ background: '#1c1917', border: '1px solid #44403c', fontSize: 12 }} />
                      <Area type="monotone" dataKey="amount" stroke="#facc15" fill="url(#revGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[12px] text-os-muted italic">
                    Keine Stripe-Charges in letzten 30 Tagen — entweder Stripe-Account ohne Sales oder falscher Account verbunden
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
                <Globe size={13} className="text-os-cyan" /> Traffic · 24h
              </h3>
              {traffic ? (
                <div className="space-y-3">
                  <Metric label="Requests" value={fmtNumber(traffic.requests24h)} />
                  <Metric label="Unique Visitors" value={fmtNumber(traffic.uniques24h)} />
                  <Metric label="Bandwidth" value={`${(traffic.bandwidth24h / 1024 / 1024).toFixed(1)} MB`} />
                  <Metric label="Cache-Ratio" value={`${traffic.cacheRatio}%`} />
                </div>
              ) : (
                <p className="text-[11px] text-os-muted italic">
                  Cloudflare Analytics nicht verfügbar.
                  <br />
                  <span className="text-[10px]">Token braucht Zone:Analytics:Read Scope</span>
                </p>
              )}
            </div>
          </div>

          {/* Project Cards */}
          <div>
            <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
              <Layers size={13} className="text-os-cyan" /> Projekte ({data?.osHealth.length || 0})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data?.osHealth.map(p => (
                <ProjectCard key={p.id} project={p} onClick={() => onNavigate?.(OS_INTERNAL_PAGE[p.id] || p.id)} />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="text-center pt-4">
            <p className="text-[10px] text-os-muted italic">
              Live-Daten aus Stripe · Paperclip · pm2 · Vercel · Cloudflare ·
              {data?.cached && ' (cached, 60s)'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: React.ReactNode; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-os-muted">{label}</p>
        <Icon size={13} className={color} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-os-muted mt-1">{sub}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-[12px]">
      <span className="text-os-muted">{label}</span>
      <span className="font-bold text-os-text">{value}</span>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: any; onClick: () => void }) {
  const live = project.status === 'live';
  return (
    <div onClick={onClick}
      className="rounded-xl border border-os-border bg-os-surface p-4 cursor-pointer hover:border-os-cyan/40 hover:bg-os-cyan/5 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{OS_ICONS[project.id] || '📦'}</span>
          <div>
            <p className="text-sm font-semibold text-os-text">{project.name}</p>
            <p className="text-[10px] text-os-muted">{new URL(project.url).host}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-bold ${live ? 'text-os-green' : 'text-os-red'}`}>
          {live ? <Wifi size={9} /> : <WifiOff size={9} />}
          {live ? 'LIVE' : 'DOWN'}
        </span>
      </div>
      <div className="flex justify-between items-center text-[11px] text-os-muted">
        <span>Revenue: <span className="text-os-text">{project.revenueSource}</span></span>
        <ArrowUpRight size={11} className="text-os-cyan" />
      </div>
    </div>
  );
}
