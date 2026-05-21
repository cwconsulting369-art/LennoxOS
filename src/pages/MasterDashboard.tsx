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
    recent: { total: number; dailyRevenue: Array<{ date: string; amount: number }>; count: number; byProject?: Record<string, number> } | null;
  };
  agents: { total: number; active: number; error: number } | { error: string } | null;
  services: { total: number; online: number; errored: number; stopped: number };
  vercel: { total: number; names: string[] } | null;
  traffic: { requests24h: number; bandwidth24h: number; uniques24h: number; cacheRatio: number } | { error: string } | null;
  osHealth: Array<{ id: string; name: string; url: string; status: string; revenueSource: string; httpStatus?: number }>;
  osMetrics?: Record<string, any>;
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
                <ProjectCard
                  key={p.id}
                  project={p}
                  metrics={data.osMetrics?.[p.id] || data.osMetrics?.[p.id === 'kevin' ? 'kevin' : p.id]}
                  onClick={() => onNavigate?.(OS_INTERNAL_PAGE[p.id] || p.id)}
                />
              ))}
            </div>
          </div>

          {/* Cross-OS Activity Feed */}
          <ActivityFeed />

          {/* Per-Project Revenue Split (Stripe metadata.project) */}
          {recent?.byProject && Object.keys(recent.byProject).length > 0 && (
            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
                <DollarSign size={13} className="text-os-green" /> Revenue per Project (30d)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {Object.entries(recent.byProject)
                  .sort((a, b) => b[1] - a[1])
                  .map(([proj, amount]) => (
                    <div key={proj} className="rounded-md border border-os-border bg-os-elevated p-2">
                      <p className="text-[10px] text-os-muted uppercase">{proj}</p>
                      <p className="text-sm font-bold text-os-green">{fmtEUR(amount)}</p>
                    </div>
                  ))}
              </div>
              <p className="text-[10px] text-os-muted italic mt-2">
                Via Stripe <code>metadata.project</code>. <strong>unassigned</strong> = noch nicht tagged — bei AEVUM/GTS-Checkouts metadata setzen.
              </p>
            </div>
          )}

          {/* Subscriptions Section */}
          <SubscriptionsSection />

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

// ─── Activity Feed (Cross-OS Events) ──────────────────────────────────────
interface EventRow { project: string; type: string; payload: any; ts: string; }

function ActivityFeed() {
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    const load = () => fetch('/api/events/recent?limit=20').then(r => r.json()).then(d => setEvents(d.events || [])).catch(() => {});
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, []);

  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
        <ArrowUpRight size={13} className="text-os-cyan" /> Cross-OS Activity ({events.length})
      </h3>
      <ul className="space-y-1">
        {events.slice(0, 10).map((e, i) => (
          <li key={i} className="flex items-center justify-between text-[11px] py-1 px-2 rounded hover:bg-os-elevated">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[10px] font-bold uppercase text-os-cyan flex-shrink-0">{e.project}</span>
              <span className="text-os-yellow text-[10px] flex-shrink-0">{e.type}</span>
              <span className="text-os-muted truncate">{JSON.stringify(e.payload).slice(0, 80)}</span>
            </div>
            <span className="text-[9px] text-os-muted ml-2 flex-shrink-0">{new Date(e.ts).toLocaleTimeString('de-DE')}</span>
          </li>
        ))}
      </ul>
      <p className="text-[9px] text-os-muted italic mt-2">
        Project-OS POST to <code>/api/event/&lt;project&gt;</code> {`{type, ...payload}`}. Polling alle 15s.
      </p>
    </div>
  );
}

// ─── Subscriptions / Abo-Tracking ─────────────────────────────────────────
type SubStatus = 'active' | 'cancelled-pending-payment' | 'cancelled' | 'decision-pending' | 'free' | 'usage';

interface Subscription {
  name: string;
  vendor: string;
  tier: string;
  cost: number; // EUR/mo estimated
  cycle: 'monthly' | 'yearly' | 'usage';
  projects: string[];   // 'shared' | 'aevum' | 'gts' | 'utilityhub' | 'ketolabs' | 'lennoxos' | 'personal' | 'thailand' | 'script' | 'k3ngama' | 'content'
  billable: boolean;
  status: SubStatus;
  notes?: string;
}

// Carlos-curated 2026-05-21 (Stand nach Decisions)
const SUBSCRIPTIONS: Subscription[] = [
  // Infra (shared, not billable)
  { name: 'Hetzner VPS',          vendor: 'hetzner',    tier: 'CX22',    cost: 30,  cycle: 'monthly', projects: ['shared'],                                  billable: false, status: 'active' },
  { name: 'Hetzner Storage Box',  vendor: 'hetzner',    tier: 'BX11',    cost: 4,   cycle: 'monthly', projects: ['shared'],                                  billable: false, status: 'active' },
  { name: 'Cloudflare',           vendor: 'cloudflare', tier: 'Free',    cost: 10,  cycle: 'monthly', projects: ['shared'],                                  billable: false, status: 'active', notes: 'invoice ~$10/mo' },
  { name: 'GoDaddy Domains',      vendor: 'godaddy',    tier: '—',       cost: 5,   cycle: 'yearly',  projects: ['shared'],                                  billable: false, status: 'active' },

  // Build / AI
  { name: 'Anthropic Claude MAX', vendor: 'anthropic',  tier: 'Max',     cost: 150, cycle: 'monthly', projects: ['lennoxos', 'aevum', 'gts', 'utilityhub', 'ketolabs', 'k3ngama', 'thailand', 'script', 'personal'], billable: true, status: 'active', notes: 'core Lennox-AI + alle Builds' },
  { name: 'Claude API (Individual)', vendor: 'anthropic', tier: 'Usage', cost: 30,  cycle: 'usage',   projects: ['lennoxos', 'personal'],                    billable: false, status: 'active',  notes: 'separat von Max; out-of-credits → Karte updaten' },
  { name: 'OpenRouter',           vendor: 'openrouter', tier: 'Usage',   cost: 30,  cycle: 'usage',   projects: ['bots', 'agents', 'gts'],                   billable: true,  status: 'usage' },
  { name: 'OpenAI',               vendor: 'openai',     tier: 'Usage',   cost: 15,  cycle: 'usage',   projects: ['special'],                                 billable: true,  status: 'usage' },
  { name: 'Gemini (Google AI)',   vendor: 'google',     tier: 'Free',    cost: 0,   cycle: 'usage',   projects: ['gts', 'content'],                          billable: false, status: 'free' },

  // Deploy / DB
  { name: 'Vercel',               vendor: 'vercel',     tier: 'Pro?',    cost: 20,  cycle: 'monthly', projects: ['aevum', 'gts', 'utilityhub', 'thailand', 'lennoxos-sales'], billable: true, status: 'active' },
  { name: 'Supabase LennoxOS',    vendor: 'supabase',   tier: 'Pro?',    cost: 25,  cycle: 'monthly', projects: ['lennoxos'],                                billable: false, status: 'active', notes: 'project erstellt 2026-05-10' },
  { name: 'Supabase Idea/UH/Keto',vendor: 'supabase',   tier: 'Pro?',    cost: 25,  cycle: 'monthly', projects: ['utilityhub', 'ketolabs', 'gts'],          billable: true,  status: 'active', notes: 'project erstellt 2026-05-10' },

  // Content / Voice
  { name: 'ElevenLabs',           vendor: 'elevenlabs', tier: 'Starter', cost: 26,  cycle: 'monthly', projects: ['content'],                                 billable: false, status: 'decision-pending', notes: 'Voice — ggf für Content Creation wichtig, payment-failure pending' },

  // Workflow
  { name: 'n8n (Paddle)',         vendor: 'n8n',        tier: 'Cloud Starter', cost: 29, cycle: 'monthly', projects: ['workflow'],                          billable: false, status: 'decision-pending', notes: 'Self-Host geplant → ggf kündigen' },
  { name: 'Make.com',             vendor: 'make',       tier: 'Free?',   cost: 0,   cycle: 'monthly', projects: ['workflow-tests'],                          billable: false, status: 'active' },
  { name: 'N8N self-host',        vendor: 'self',       tier: 'self',    cost: 0,   cycle: 'monthly', projects: ['workflow'],                                billable: false, status: 'free' },

  // Personal
  { name: 'Obsidian Sync',        vendor: 'obsidian',   tier: 'Sync',    cost: 5,   cycle: 'yearly',  projects: ['personal'],                                billable: false, status: 'active', notes: '$57/yr' },
  { name: 'Notion',               vendor: 'notion',     tier: 'Free',    cost: 0,   cycle: 'monthly', projects: ['personal'],                                billable: false, status: 'free' },

  // Design (decision pending)
  { name: 'Miro',                 vendor: 'miro',       tier: 'Team?',   cost: 12,  cycle: 'monthly', projects: ['workflow-viz'],                            billable: false, status: 'decision-pending', notes: 'Miro vs Figma für AI-Workflow-Viz — Carlos entscheidet' },
  { name: 'Figma',                vendor: 'figma',      tier: 'Free',    cost: 0,   cycle: 'monthly', projects: ['design'],                                  billable: false, status: 'free' },

  // Data / Workspace
  { name: 'Airtable',             vendor: 'airtable',   tier: 'Free',    cost: 0,   cycle: 'monthly', projects: ['utilityhub', 'ideas'],                     billable: false, status: 'free', notes: 'auf Free, 2 Workspaces am Limit; payment failed offen' },
  { name: 'HuggingFace',          vendor: 'huggingface',tier: 'Free',    cost: 0,   cycle: 'usage',   projects: ['agents'],                                  billable: false, status: 'free' },

  // Cancelled / Pending Payment
  { name: 'Zoom',                 vendor: 'zoom',       tier: '—',       cost: 0,   cycle: 'monthly', projects: ['personal'],                                billable: false, status: 'cancelled-pending-payment', notes: 'beendet, 1× offener Betrag zu zahlen' },
  { name: 'Apify',                vendor: 'apify',      tier: '—',       cost: 0,   cycle: 'monthly', projects: ['scraping'],                                billable: false, status: 'cancelled-pending-payment', notes: 'gekündigt, nur API-Kosten decken' },
  { name: 'Onepage GmbH',         vendor: 'onepage',    tier: 'Free',    cost: 0,   cycle: 'monthly', projects: ['shared'],                                  billable: false, status: 'cancelled-pending-payment', notes: 'gekündigt/free, einmal bezahlen' },

  // Cancelled & closed
  { name: 'HeyGen',               vendor: 'heygen',     tier: '—',       cost: 0,   cycle: 'monthly', projects: [],                                          billable: false, status: 'cancelled', notes: 'beendet — falls noch Charges: melden' },
  { name: 'Loom Business+AI',     vendor: 'atlassian',  tier: 'Trial',   cost: 0,   cycle: 'monthly', projects: [],                                          billable: false, status: 'cancelled', notes: 'Trial endete 2026-03-08, auto-cancelled' },

  // Community
  { name: 'Apex AI Skool',        vendor: 'skool',      tier: 'Membership', cost: 0, cycle: 'monthly', projects: ['network'],                               billable: false, status: 'active', notes: 'Tim-Network?' },

  // Telegram (free)
  { name: 'Telegram Bots',        vendor: 'telegram',   tier: 'Free',    cost: 0,   cycle: 'monthly', projects: ['shared'],                                  billable: false, status: 'free' },
  { name: 'GitHub',               vendor: 'github',     tier: 'Free',    cost: 0,   cycle: 'monthly', projects: ['shared'],                                  billable: false, status: 'free' },
];

const STATUS_COLOR: Record<SubStatus, string> = {
  'active': 'text-os-green',
  'usage': 'text-os-cyan',
  'free': 'text-os-muted',
  'decision-pending': 'text-os-yellow',
  'cancelled-pending-payment': 'text-os-red',
  'cancelled': 'text-os-muted',
};

const STATUS_LABEL: Record<SubStatus, string> = {
  'active': 'Active',
  'usage': 'Usage',
  'free': 'Free',
  'decision-pending': 'Decision',
  'cancelled-pending-payment': '⚠ Pay+Close',
  'cancelled': 'Closed',
};

function SubscriptionsSection() {
  const [filter, setFilter] = useState<'all' | 'active' | 'attention' | 'billable'>('all');

  const activeSubs = SUBSCRIPTIONS.filter(s => s.status === 'active' || s.status === 'usage');
  const totalActive = activeSubs.reduce((s, x) => s + (x.cost || 0), 0);
  const billable = SUBSCRIPTIONS.filter(x => x.billable && (x.status === 'active' || x.status === 'usage')).reduce((s, x) => s + (x.cost || 0), 0);
  const attention = SUBSCRIPTIONS.filter(s => s.status === 'decision-pending' || s.status === 'cancelled-pending-payment');

  const filtered = filter === 'all' ? SUBSCRIPTIONS :
                   filter === 'active' ? activeSubs :
                   filter === 'attention' ? attention :
                   SUBSCRIPTIONS.filter(s => s.billable);

  // Aggregate cost per project
  const byProject: Record<string, number> = {};
  for (const s of activeSubs) {
    const split = s.cost / Math.max(1, s.projects.length);
    for (const p of s.projects) byProject[p] = (byProject[p] || 0) + split;
  }
  const projectCosts = Object.entries(byProject).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-os-text flex items-center gap-2">
          <DollarSign size={13} className="text-os-yellow" /> Subscriptions & Tools ({SUBSCRIPTIONS.length})
        </h3>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Active: <span className="text-os-text font-bold">{fmtEUR(totalActive)}/mo</span></span>
          <span>Billable: <span className="text-os-green font-bold">{fmtEUR(billable)}/mo</span></span>
          {attention.length > 0 && <span className="text-os-yellow">⚠ {attention.length} need attention</span>}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-3">
        {(['all', 'active', 'attention', 'billable'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 py-1 text-[10px] rounded-md border transition-colors ${
              filter === f ? 'border-os-cyan text-os-cyan bg-os-cyan/10' : 'border-os-border text-os-muted hover:text-os-text'
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="border-b border-os-border text-os-muted text-left">
            <tr>
              <th className="py-2 pr-2">Tool</th>
              <th className="pr-2">Vendor / Tier</th>
              <th className="pr-2 text-right">Cost/mo</th>
              <th className="pr-2">Projekte</th>
              <th className="pr-2 text-center">Bill→Client</th>
              <th className="pr-2">Status</th>
              <th className="pr-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.name} className="border-b border-os-border/40">
                <td className="py-2 pr-2 text-os-text font-medium">{s.name}</td>
                <td className="pr-2 text-os-muted">{s.vendor} · {s.tier}</td>
                <td className="pr-2 text-right text-os-text">
                  {s.cost > 0 ? fmtEUR(s.cost) : (s.cycle === 'usage' ? 'usage' : '—')}
                </td>
                <td className="pr-2 text-os-muted text-[10px]">{s.projects.join(', ') || '—'}</td>
                <td className="pr-2 text-center">
                  {s.billable ? <span className="text-os-green">✓</span> : <span className="text-os-muted">—</span>}
                </td>
                <td className={`pr-2 font-bold ${STATUS_COLOR[s.status]}`}>{STATUS_LABEL[s.status]}</td>
                <td className="pr-2 text-os-muted text-[10px] italic max-w-[300px]">{s.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-project cost */}
      <div className="mt-4 rounded-lg bg-os-elevated p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-os-muted mb-2">Kosten pro Projekt (split, active subs only)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {projectCosts.map(([proj, cost]) => (
            <div key={proj} className="rounded-md border border-os-border bg-os-bg p-2">
              <p className="text-[10px] text-os-muted uppercase">{proj}</p>
              <p className="text-sm font-bold text-os-yellow">{fmtEUR(cost)}<span className="text-[9px] text-os-muted">/mo</span></p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-os-muted italic mt-3">
        Carlos-curated 2026-05-21. Cost = monatlich (yearly /12 verteilt). Status-Filter oben. Cost-per-Project ist Equal-Split (besser: usage-weighted via Phase B Subscription-Tracking-DB).
      </p>
    </div>
  );
}

function ProjectCard({ project, metrics, onClick }: { project: any; metrics?: any; onClick: () => void }) {
  const live = project.status === 'live';
  const kpis: Array<{ label: string; value: any }> = [];
  if (metrics && !metrics.error) {
    Object.entries(metrics).slice(0, 3).forEach(([k, v]) => kpis.push({ label: k, value: v }));
  }
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
      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {kpis.map(k => (
            <div key={k.label} className="text-center">
              <p className="text-[9px] uppercase text-os-muted">{k.label}</p>
              <p className="text-sm font-bold text-os-yellow">{typeof k.value === 'number' ? k.value : '—'}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between items-center text-[11px] text-os-muted">
        <span>Revenue: <span className="text-os-text">{project.revenueSource}</span></span>
        <ArrowUpRight size={11} className="text-os-cyan" />
      </div>
    </div>
  );
}
