import { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Layers, Server, User,
  CreditCard, Zap, RefreshCw, AlertCircle, Repeat,
} from 'lucide-react';

/* ============================================================
 * FinanceDashboard — Cost & Revenue OVERVIEW
 * Konsolidiert alle Cost-Quellen (Claude/Vendors/Infra) + Personal-Subs + Stripe-Revenue
 * Tabs: Overview · Projects · LennoxOS Infra · Private · Revenue · Coming Soon
 * Data: /api/finance/overview (server.cjs aggregator)
 * ============================================================ */

type Tab = 'overview' | 'projects' | 'infra' | 'subscriptions' | 'invoices' | 'private' | 'revenue' | 'allocation';

interface ProjectBucket {
  project: string;
  cost_30d: number;
  sources: Record<string, number>;
}

interface InfraBucket {
  servers_eur: number;
  cdn_zones: number;
  deploys_count: number;
  llm_apis_usd: number;
  claude_unassigned_usd: number;
  items: { vendor: string; metric: string; scope: string; cost_usd: number; day: string }[];
}

interface PrivateSub {
  name: string; plan: string; cost_str: string; cost_eur: number; renewal: string; active: boolean;
}

interface FinanceOverview {
  window_days: number;
  buckets: {
    projects: ProjectBucket[];
    infra: InfraBucket;
    private: { subscriptions: PrivateSub[]; total_monthly_eur: number };
    revenue: { payments_30d: number; payments_count: number; active_subs_monthly: number };
  };
  kpi: {
    projects_cost_30d_usd: number;
    infra_cost_30d_usd: number;
    private_monthly_eur: number;
    revenue_30d_eur: number;
    net_30d_estimate_usd: number;
  };
}

const PROJECT_META: Record<string, { label: string; color: string; tag: string }> = {
  aevum:       { label: 'AEVUM',       color: '#d4a847', tag: 'Business' },
  gts:         { label: 'GoldTraderSociety', color: '#f5b800', tag: 'Business · Standalone' },
  utilityhub:  { label: 'UtilityHub',  color: '#7c9eff', tag: 'AEVUM-Customer (Miguel)' },
  ketolabs:    { label: 'Ketolabs',    color: '#9be0a8', tag: 'AEVUM-Customer (Tommy)' },
  thailand:    { label: 'Thailand RE', color: '#ff9b7a', tag: 'AEVUM-Customer (Patrick)' },
  k3ngama:     { label: 'K3ngama',     color: '#c084fc', tag: 'Co-Partner (Kevin)' },
  betterfly:   { label: 'BetterFly3ffect', color: '#67e8f9', tag: 'Side-Project' },
  paperclip:   { label: 'Paperclip Agents', color: '#94a3b8', tag: 'Infra · LennoxOS' },
  lennox:      { label: 'LennoxOS (Personal)', color: '#c8131b', tag: 'Infra · LennoxOS' },
  lennoxos:    { label: 'LennoxOS', color: '#c8131b', tag: 'Infra · LennoxOS' },
  'personal-os': { label: 'PersonalOS', color: '#a0a0a0', tag: 'Personal' },
};

function fmtUsd(n: number) { return '$' + n.toFixed(2); }
function fmtEur(n: number) { return '€' + n.toFixed(2); }
function fmtNum(n: number) {
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'k';
  return n.toString();
}

export default function FinanceDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const j = await fetch('/api/finance/overview').then(r => r.json());
      setData(j);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
        <RefreshCw size={18} className="animate-spin mr-2" /> Loading finance overview…
      </div>
    );
  }
  if (!data) return null;

  const { buckets, kpi } = data;

  // Aggregate KPIs (rough EUR equivalents for display)
  const totalCostsUsd = kpi.projects_cost_30d_usd + kpi.infra_cost_30d_usd + kpi.private_monthly_eur * 1.08;
  const netEur = (kpi.revenue_30d_eur) - (totalCostsUsd / 1.08);

  // Classify projects: AEVUM-related (incl customers) vs Standalone vs Infra
  const aevumGroup = ['aevum', 'utilityhub', 'ketolabs', 'thailand'];
  const standaloneGroup = ['gts', 'k3ngama', 'betterfly'];
  const infraGroup = ['lennox', 'lennoxos', 'paperclip', 'personal-os'];

  const aevumCost = buckets.projects.filter(p => aevumGroup.includes(p.project)).reduce((s, p) => s + p.cost_30d, 0);
  const standaloneCost = buckets.projects.filter(p => standaloneGroup.includes(p.project)).reduce((s, p) => s + p.cost_30d, 0);
  const infraProjectsCost = buckets.projects.filter(p => infraGroup.includes(p.project)).reduce((s, p) => s + p.cost_30d, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="lx-headline text-2xl flex items-center gap-3">
            <DollarSign size={22} className="text-[var(--accent)]" />
            Finance Overview
          </h1>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mt-1">
            Last 30 days · Projects · Infra · Private · Revenue
          </p>
        </div>
        <button onClick={load} className="lx-btn flex items-center gap-2 text-xs" disabled={loading}>
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Master KPI Strip */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
        <BigKpi
          icon={<Layers size={14} />}
          label="Projects (30d)"
          value={fmtUsd(kpi.projects_cost_30d_usd)}
          sub={`${buckets.projects.length} projects`}
        />
        <BigKpi
          icon={<Server size={14} />}
          label="LennoxOS Infra (30d)"
          value={fmtUsd(kpi.infra_cost_30d_usd)}
          sub={`Server €${buckets.infra.servers_eur}/mo + APIs`}
        />
        <BigKpi
          icon={<User size={14} />}
          label="Private (monatlich)"
          value={fmtEur(kpi.private_monthly_eur)}
          sub={`${buckets.private.subscriptions.filter(s => s.active).length} subs aktiv`}
        />
        <BigKpi
          icon={<TrendingUp size={14} />}
          label="Revenue (30d)"
          value={fmtEur(kpi.revenue_30d_eur)}
          sub={`${buckets.revenue.payments_count} payments`}
          positive
        />
        <BigKpi
          icon={netEur >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          label="Net 30d (estimate)"
          value={(netEur >= 0 ? '€+' : '€-') + Math.abs(netEur).toFixed(2)}
          sub="Revenue − Cost"
          positive={netEur >= 0}
          negative={netEur < 0}
        />
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-[var(--border)] flex gap-1 flex-shrink-0 overflow-x-auto">
        <TabBtn active={tab === 'overview'}      onClick={() => setTab('overview')}      icon={<DollarSign size={13} />}>Overview</TabBtn>
        <TabBtn active={tab === 'projects'}      onClick={() => setTab('projects')}      icon={<Layers size={13} />}>Project Costs</TabBtn>
        <TabBtn active={tab === 'infra'}         onClick={() => setTab('infra')}         icon={<Server size={13} />}>LennoxOS Infra</TabBtn>
        <TabBtn active={tab === 'subscriptions'} onClick={() => setTab('subscriptions')} icon={<Repeat size={13} />}>Subscriptions Inventory</TabBtn>
        <TabBtn active={tab === 'invoices'}      onClick={() => setTab('invoices')}      icon={<CreditCard size={13} />}>Customer Invoices</TabBtn>
        <TabBtn active={tab === 'private'}       onClick={() => setTab('private')}       icon={<User size={13} />}>Private</TabBtn>
        <TabBtn active={tab === 'revenue'}       onClick={() => setTab('revenue')}       icon={<CreditCard size={13} />}>Revenue</TabBtn>
        <TabBtn active={tab === 'allocation'}    onClick={() => setTab('allocation')}    icon={<Zap size={13} />} comingSoon>PDF Auto-Bill</TabBtn>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {tab === 'overview' && (
          <OverviewTab data={data} aevumCost={aevumCost} standaloneCost={standaloneCost} infraProjectsCost={infraProjectsCost} totalCostsUsd={totalCostsUsd} />
        )}
        {tab === 'projects'      && <ProjectsTab projects={buckets.projects} />}
        {tab === 'infra'         && <InfraTab infra={buckets.infra} unassignedClaude={buckets.infra.claude_unassigned_usd} />}
        {tab === 'subscriptions' && <SubscriptionsTab />}
        {tab === 'invoices'      && <InvoicesTab />}
        {tab === 'private'       && <PrivateTab privateBucket={buckets.private} />}
        {tab === 'revenue'       && <RevenueTab revenue={buckets.revenue} />}
        {tab === 'allocation'    && <ComingSoonBillThrough />}
      </div>
    </div>
  );
}

/* ─── KPI ──────────────────────────────────────────────────────────────── */
function BigKpi({ icon, label, value, sub, positive, negative }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  positive?: boolean; negative?: boolean;
}) {
  const valClass = positive ? 'text-[#9be0a8]' : negative ? 'text-[var(--accent)]' : '';
  return (
    <div className="lx-card p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        {icon}{label}
      </div>
      <div className={`lx-kpi-value mt-1 ${valClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] mt-1">{sub}</div>}
    </div>
  );
}

function TabBtn({ active, onClick, icon, comingSoon, children }: {
  active: boolean; onClick: () => void; icon: React.ReactNode;
  comingSoon?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
        active ? 'border-[var(--accent)] text-[var(--text)]'
               : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
      } ${comingSoon ? 'opacity-60' : ''}`}
    >
      {icon}{children}
      {comingSoon && (
        <span className="ml-1 px-1.5 py-0.5 text-[8px] uppercase tracking-widest rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)]">
          Soon
        </span>
      )}
    </button>
  );
}

/* ─── OVERVIEW TAB ─────────────────────────────────────────────────────── */
function OverviewTab({ data, aevumCost, standaloneCost, infraProjectsCost, totalCostsUsd }: {
  data: FinanceOverview;
  aevumCost: number; standaloneCost: number; infraProjectsCost: number; totalCostsUsd: number;
}) {
  const { buckets, kpi } = data;
  const segments = [
    { label: 'AEVUM-Group (Customers)', value: aevumCost,                color: '#d4a847', desc: 'AEVUM + UtilityHub + Ketolabs + Thailand' },
    { label: 'Standalone (GTS+Co)',     value: standaloneCost,           color: '#f5b800', desc: 'GTS + K3ngama + BetterFly' },
    { label: 'LennoxOS Infra (LLM)',    value: kpi.infra_cost_30d_usd + infraProjectsCost, color: '#c8131b', desc: 'Server + LLM-APIs + Personal' },
    { label: 'Private Subs (×1.08 USD)', value: kpi.private_monthly_eur * 1.08, color: '#a0a0a0', desc: 'Persönliche Subscriptions' },
  ];
  const segTotal = segments.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Segmented bar */}
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Cost-Distribution · 30 Tage</div>
        <div className="flex h-8 rounded overflow-hidden border border-[var(--border)]">
          {segments.map(s => {
            const pct = (s.value / segTotal) * 100;
            return (
              <div key={s.label} title={`${s.label}: ${fmtUsd(s.value)} (${pct.toFixed(1)}%)`}
                   style={{ width: pct + '%', background: s.color, minWidth: pct > 0 ? 4 : 0 }} />
            );
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {segments.map(s => {
            const pct = (s.value / segTotal) * 100;
            return (
              <div key={s.label} className="text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded" style={{ background: s.color }} />
                  <span className="font-medium">{s.label}</span>
                </div>
                <div className="text-[var(--text)] font-mono">{fmtUsd(s.value)}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{pct.toFixed(1)}% · {s.desc}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
          Total monatlich: <span className="text-[var(--text)] font-mono">{fmtUsd(totalCostsUsd)}</span> ·
          Revenue: <span className="text-[#9be0a8] font-mono">€{kpi.revenue_30d_eur.toFixed(2)}</span>
        </div>
      </div>

      {/* Top-Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lx-panel p-5">
          <div className="lx-section-title mb-3">Top Project Costs · 30d</div>
          <ProjectBars projects={buckets.projects.slice(0, 8)} />
        </div>
        <div className="lx-panel p-5">
          <div className="lx-section-title mb-3">Infrastructure Mix</div>
          <div className="space-y-2.5 text-xs">
            <RowStat label="Hetzner-Server (monthly)" value={fmtEur(buckets.infra.servers_eur)} unit="EUR" />
            <RowStat label="Cloudflare zones" value={String(buckets.infra.cdn_zones)} unit="count" />
            <RowStat label="Vercel deployments (recent)" value={String(buckets.infra.deploys_count)} unit="count" />
            <RowStat label="LLM-APIs (OpenRouter+OAI+Anthropic)" value={fmtUsd(buckets.infra.llm_apis_usd)} unit="USD" />
            <RowStat label="Claude unassigned (home/personal)" value={fmtUsd(buckets.infra.claude_unassigned_usd)} unit="USD" muted />
          </div>
        </div>
      </div>

      {/* Net at glance */}
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Net Position · 30 Tage</div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Costs</div>
            <div className="text-2xl font-light text-[var(--accent)] mt-1 font-mono">−${totalCostsUsd.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Revenue</div>
            <div className="text-2xl font-light text-[#9be0a8] mt-1 font-mono">+€{kpi.revenue_30d_eur.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Net (est.)</div>
            <div className={`text-2xl font-light mt-1 font-mono ${kpi.net_30d_estimate_usd >= 0 ? 'text-[#9be0a8]' : 'text-[var(--accent)]'}`}>
              {kpi.net_30d_estimate_usd >= 0 ? '+' : ''}${kpi.net_30d_estimate_usd.toFixed(0)}
            </div>
          </div>
        </div>
        <p className="mt-4 text-[10px] text-[var(--text-muted)] text-center uppercase tracking-widest">
          Hinweis: Claude-Max-Subscription (~€90/mo) ist Flatrate — API-equivalent-cost zeigt verbrauchten Token-Wert nicht real-€-burn
        </p>
      </div>
    </div>
  );
}

function RowStat({ label, value, unit, muted }: { label: string; value: string; unit?: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 border-b border-[var(--border)]/30 ${muted ? 'opacity-60' : ''}`}>
      <span className="text-[var(--text-muted)]">{label}</span>
      <div className="text-right">
        <span className="font-mono text-[var(--text)]">{value}</span>
        {unit && <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] ml-2">{unit}</span>}
      </div>
    </div>
  );
}

function ProjectBars({ projects }: { projects: ProjectBucket[] }) {
  const max = Math.max(1, ...projects.map(p => p.cost_30d));
  return (
    <div className="space-y-2">
      {!projects.length && <div className="text-xs text-[var(--text-muted)]">Keine Daten.</div>}
      {projects.map(p => {
        const meta = PROJECT_META[p.project] || { label: p.project, color: '#888', tag: '' };
        const pct = (p.cost_30d / max) * 100;
        return (
          <div key={p.project} className="text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded" style={{ background: meta.color }} />
                <span className="font-medium">{meta.label}</span>
                {meta.tag && <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">{meta.tag}</span>}
              </div>
              <span className="font-mono text-[var(--text)]">{fmtUsd(p.cost_30d)}</span>
            </div>
            <div className="h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
              <div className="h-full" style={{ width: pct + '%', background: `linear-gradient(to right, ${meta.color}, ${meta.color}cc)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── PROJECTS TAB ─────────────────────────────────────────────────────── */
function ProjectsTab({ projects }: { projects: ProjectBucket[] }) {
  const grouped = useMemo(() => {
    const groups: Record<string, ProjectBucket[]> = {
      'AEVUM-Group': projects.filter(p => ['aevum', 'utilityhub', 'ketolabs', 'thailand'].includes(p.project)),
      'Standalone Business': projects.filter(p => ['gts', 'k3ngama', 'betterfly'].includes(p.project)),
      'Infra & Personal': projects.filter(p => ['lennox', 'lennoxos', 'paperclip', 'personal-os'].includes(p.project)),
    };
    return groups;
  }, [projects]);
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([groupName, items]) => {
        const groupTotal = items.reduce((s, p) => s + p.cost_30d, 0);
        return (
          <div key={groupName} className="lx-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="lx-section-title">{groupName}</div>
              <span className="text-xs font-mono text-[var(--accent)]">{fmtUsd(groupTotal)} / 30d</span>
            </div>
            {!items.length && <div className="text-xs text-[var(--text-muted)]">Keine Daten in dieser Gruppe.</div>}
            <div className="space-y-3">
              {items.map(p => {
                const meta = PROJECT_META[p.project] || { label: p.project, color: '#888', tag: '' };
                return (
                  <div key={p.project} className="border-l-2 pl-3 py-1" style={{ borderColor: meta.color }}>
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <div className="font-medium">{meta.label}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{meta.tag}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-[var(--text)]">{fmtUsd(p.cost_30d)}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {Object.entries(p.sources).map(([k, v]) => `${k}:${fmtUsd(v as number)}`).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="lx-panel p-4 text-[11px] text-[var(--text-muted)] flex items-start gap-2">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          Project-Slugs werden aus Claude-Session-cwd + Tool-Call-Pfaden gemined (≥5 matches required for override).
          Ungenaue Zuordnung? Heuristik in <code>claude-jsonl-parser.js</code> erweitern und <code>TRUNCATE claude_usage_daily</code> + Re-Sync.
        </span>
      </div>
    </div>
  );
}

/* ─── INFRA TAB ────────────────────────────────────────────────────────── */
function InfraTab({ infra, unassignedClaude }: { infra: InfraBucket; unassignedClaude: number }) {
  // Group infra-items by vendor
  const byVendor: Record<string, { vendor: string; total: number; rows: typeof infra.items }> = {};
  for (const it of infra.items) {
    if (!byVendor[it.vendor]) byVendor[it.vendor] = { vendor: it.vendor, total: 0, rows: [] };
    byVendor[it.vendor].total += it.cost_usd;
    byVendor[it.vendor].rows.push(it);
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <BigKpi icon={<Server size={14} />}   label="Hetzner monthly"   value={fmtEur(infra.servers_eur)}                  sub="VPS-Server" />
        <BigKpi icon={<Layers size={14} />}   label="LLM APIs (30d)"    value={fmtUsd(infra.llm_apis_usd)}                  sub="OpenRouter+OAI+Anthropic-API" />
        <BigKpi icon={<DollarSign size={14}/>} label="Claude unassigned" value={fmtUsd(unassignedClaude)}                    sub="home/personal-sessions" />
        <BigKpi icon={<Repeat size={14} />}   label="CF Zones / Vercel" value={`${infra.cdn_zones} / ${infra.deploys_count}`} sub="zones / deploys recent" />
      </div>
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">LennoxOS-Infrastruktur · Vendor-Breakdown</div>
        {!Object.keys(byVendor).length && <div className="text-xs text-[var(--text-muted)]">Keine cost-bearing items in den letzten 30 Tagen.</div>}
        <div className="space-y-4">
          {Object.values(byVendor).map(v => (
            <div key={v.vendor}>
              <div className="flex items-center justify-between mb-2 text-xs">
                <div className="font-medium capitalize">{v.vendor}</div>
                <div className="font-mono text-[var(--accent)]">{fmtUsd(v.total)}</div>
              </div>
              <div className="space-y-1">
                {v.rows.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-[var(--text-muted)] py-0.5 border-b border-[var(--border)]/30">
                    <span>{r.metric}{r.scope ? ` · ${r.scope}` : ''}</span>
                    <span>{fmtUsd(r.cost_usd)} <span className="text-[9px]">({r.day})</span></span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── PRIVATE TAB ──────────────────────────────────────────────────────── */
function PrivateTab({ privateBucket }: { privateBucket: { subscriptions: PrivateSub[]; total_monthly_eur: number } }) {
  const { subscriptions, total_monthly_eur } = privateBucket;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BigKpi icon={<Repeat size={14} />}     label="Subscriptions" value={String(subscriptions.length)} sub={`${subscriptions.filter(s => s.active).length} aktiv`} />
        <BigKpi icon={<DollarSign size={14} />} label="Total monatlich" value={fmtEur(total_monthly_eur)} sub="Aktive Subs summiert" />
        <BigKpi icon={<TrendingUp size={14} />} label="Jahres-Run-Rate" value={fmtEur(total_monthly_eur * 12)} sub="Recurring x12" />
      </div>
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Persönliche Subscriptions</div>
        <p className="text-[10px] text-[var(--text-muted)] mb-3 uppercase tracking-widest">
          Quelle: <code>~/personal-os/05-finance/expenses.md</code> · Edit dort → reload hier
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 text-left">Status</th>
                <th className="text-left">Service</th>
                <th className="text-left">Plan</th>
                <th className="text-right">Kosten</th>
                <th className="text-left">Renewal</th>
              </tr>
            </thead>
            <tbody>
              {!subscriptions.length && (
                <tr><td colSpan={5} className="py-6 text-center text-[var(--text-muted)]">Keine Subscriptions in expenses.md gefunden.</td></tr>
              )}
              {subscriptions.map((s, i) => (
                <tr key={i} className={`border-b border-[var(--border)]/40 ${!s.active ? 'opacity-50 line-through' : ''}`}>
                  <td className="py-2">
                    <span className={`lx-dot ${s.active ? 'lx-dot--ok' : 'lx-dot--err'} mr-2`} />
                  </td>
                  <td className="font-medium">{s.name}</td>
                  <td className="text-[var(--text-muted)]">{s.plan}</td>
                  <td className="text-right font-mono">{s.cost_str}</td>
                  <td className="text-[var(--text-muted)]">{s.renewal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── REVENUE TAB ──────────────────────────────────────────────────────── */
function RevenueTab({ revenue }: { revenue: { payments_30d: number; payments_count: number; active_subs_monthly: number } }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <BigKpi icon={<CreditCard size={14} />}  label="Payments (30d)"  value={fmtEur(revenue.payments_30d)} sub={`${revenue.payments_count} transactions`} positive />
        <BigKpi icon={<Repeat size={14} />}      label="Active Subs MRR" value={fmtEur(revenue.active_subs_monthly)} sub="Stripe recurring" positive />
        <BigKpi icon={<TrendingUp size={14} />}  label="Annual Run-Rate" value={fmtEur(revenue.active_subs_monthly * 12)} sub="MRR × 12" positive />
      </div>
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Stripe Incoming (Carlos's Stripe-Account)</div>
        <p className="text-[10px] text-[var(--text-muted)] mb-3 uppercase tracking-widest">
          Quelle: Stripe-API · synced via stripe-sync.js · Detailansicht im Activity-Dashboard → Payments/Subs
        </p>
        {revenue.payments_count === 0 && (
          <div className="text-xs text-[var(--text-muted)]">
            Keine Payments in den letzten 30 Tagen. Falls AEVUM-Shop läuft, Stripe-Sync triggern:
            <code className="block mt-2 p-2 bg-[var(--surface)] rounded font-mono">curl -X POST http://127.0.0.1:4000/api/activity/sync/stripe</code>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SUBSCRIPTIONS INVENTORY TAB ──────────────────────────────────────── */
interface SubRow {
  id: number; vendor: string; product_name: string; plan: string; amount_cents: number;
  currency: string; interval: string; status: string; account_source: string;
  source: string; category: string; notes: string; vendor_url: string;
  uses: { id: number; project_slug: string; billable: boolean }[];
}

const ALL_PROJECTS = ['aevum', 'utilityhub', 'ketolabs', 'thailand', 'gts', 'k3ngama', 'betterfly', 'lennoxos', 'personal'];

function SubscriptionsTab() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const j = await fetch('/api/finance/subscriptions').then(r => r.json());
    setSubs(j.subscriptions || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleAllocation(subId: number, project: string, currentlyAllocated: boolean) {
    await fetch(`/api/finance/subscriptions/${subId}/allocate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_slug: project, billable: currentlyAllocated ? null : true }),
    });
    load();
  }

  const categories = ['all', 'infra', 'ai', 'automation', 'marketing', 'dev', 'personal'];
  const filtered = subs.filter(s => {
    if (filter !== 'all' && s.category !== filter) return false;
    if (search && !(`${s.vendor} ${s.product_name} ${s.plan}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });
  const activeMonthly = filtered.filter(s => s.status === 'active').reduce((sum, s) => {
    const m = s.interval === 'year' ? s.amount_cents / 12 : s.interval === 'usage' ? 0 : s.amount_cents;
    return sum + m;
  }, 0);

  if (loading) return <div className="text-xs text-[var(--text-muted)] py-6 text-center"><RefreshCw className="inline animate-spin mr-2" size={12}/>Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder="Filter Subscription…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="lx-input text-xs px-3 py-2 flex-1 min-w-[200px]"
        />
        <div className="flex gap-1 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-2.5 py-1.5 text-[10px] uppercase tracking-widest rounded border ${
                filter === c ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                             : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}>{c}</button>
          ))}
        </div>
        <button className="lx-btn text-xs flex items-center gap-2" onClick={load}>
          <RefreshCw size={12} /> Reload
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <BigKpi icon={<Repeat size={14} />}     label="Filtered Subs"      value={String(filtered.length)} sub={`${filtered.filter(s => s.status === 'active').length} aktiv`} />
        <BigKpi icon={<DollarSign size={14} />} label="Sum monatlich"      value={fmtEur(activeMonthly / 100)} sub="normalisiert" />
        <BigKpi icon={<TrendingUp size={14} />} label="Reselling-Potential" value={fmtEur(filtered.reduce((s, x) => {
          const allocBillable = x.uses.filter(u => u.billable).length;
          const mo = x.interval === 'year' ? x.amount_cents / 12 : x.interval === 'usage' ? 0 : x.amount_cents;
          return s + (mo * allocBillable / 100);
        }, 0))} sub="Σ(active subs × allokierte Projekte)" positive />
      </div>

      {/* Table */}
      <div className="lx-panel p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest bg-[var(--surface)]/40">
              <tr className="border-b border-[var(--border)]">
                <th className="py-3 px-3 text-left">Vendor / Product</th>
                <th className="text-left">Cat</th>
                <th className="text-right">Cost</th>
                <th className="text-left">Interval</th>
                <th className="text-left">Source</th>
                <th className="text-center">Allocation (Tool-Reselling)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const monthly = s.interval === 'year' ? s.amount_cents / 12 : s.interval === 'usage' ? 0 : s.amount_cents;
                const allocated = new Set(s.uses.filter(u => u.billable).map(u => u.project_slug));
                return (
                  <tr key={s.id} className={`border-b border-[var(--border)]/40 ${s.status !== 'active' ? 'opacity-50' : ''}`}>
                    <td className="py-2.5 px-3">
                      <div className="font-medium">{s.product_name}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{s.vendor} {s.plan ? `· ${s.plan}` : ''}</div>
                    </td>
                    <td className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{s.category || '—'}</td>
                    <td className="text-right font-mono">
                      <div>{(s.currency === 'eur' ? '€' : '$') + (s.amount_cents / 100).toFixed(2)}</div>
                      <div className="text-[9px] text-[var(--text-muted)]">{(s.currency === 'eur' ? '€' : '$') + (monthly / 100).toFixed(2)}/mo</div>
                    </td>
                    <td className="text-[var(--text-muted)]">{s.interval}</td>
                    <td className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{s.source}</td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1 flex-wrap">
                        {ALL_PROJECTS.map(p => {
                          const isAllocated = allocated.has(p);
                          return (
                            <button
                              key={p}
                              onClick={() => toggleAllocation(s.id, p, isAllocated)}
                              title={isAllocated ? `${p} zahlt FULL price` : `${p} → klick zum Hinzufügen`}
                              className={`px-1.5 py-0.5 text-[9px] uppercase tracking-widest rounded ${
                                isAllocated
                                  ? 'bg-[var(--accent)] text-white'
                                  : 'border border-[var(--border)]/40 text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td></td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">Keine Subs gefunden.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lx-panel p-4 text-[11px] text-[var(--text-muted)] flex items-start gap-2">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        <span>
          <strong>Tool-Reselling-Modell:</strong> Klicke einen Projekt-Tag pro Sub → dieses Projekt zahlt den <strong>vollen Abo-Preis</strong>.
          Mehrere Projekte können dasselbe Tool nutzen → jeder zahlt full. Carlos's eigene Kosten bleiben fix.
          <br />
          Initial-Inventar aus expenses.md + intel ({subs.length} Subs).
          Email-Scanner für volle Coverage: <code>node email-receipt-scanner.js</code> (benötigt Google-Reauth, siehe Activity → Missing-Keys).
        </span>
      </div>
    </div>
  );
}

/* ─── CUSTOMER INVOICES TAB ────────────────────────────────────────────── */
interface InvoiceLine {
  kind: 'subscription' | 'api';
  vendor: string; product_name: string; plan?: string;
  period_cost_eur: number; currency: string;
  note: string;
}
interface InvoicePreview {
  project_slug: string; period_days: number; from_date: string; to_date: string;
  lines: InvoiceLine[]; total_eur: number;
  meta: { subscription_count: number; claude_tracked: boolean };
}

const CUSTOMER_PROJECTS = [
  { slug: 'utilityhub', label: 'Miguel · UtilityHub' },
  { slug: 'ketolabs',   label: 'Tommy · Ketolabs' },
  { slug: 'thailand',   label: 'Patrick · Thailand RE' },
  { slug: 'gts',        label: 'GTS · Members (Pool)' },
  { slug: 'aevum',      label: 'AEVUM (Carlos own)' },
];

function InvoicesTab() {
  const [project, setProject] = useState('utilityhub');
  const [days, setDays] = useState(30);
  const [data, setData] = useState<InvoicePreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/finance/invoice/${project}?days=${days}`).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [project, days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {CUSTOMER_PROJECTS.map(p => (
            <button
              key={p.slug}
              onClick={() => setProject(p.slug)}
              className={`px-3 py-1.5 text-xs rounded border transition ${
                project === p.slug
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}>{p.label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-[var(--text-muted)]">
          Period:
          {[7, 30, 90, 180, 365].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-2 py-1 rounded ${days === d ? 'bg-[var(--accent)] text-white' : 'hover:text-[var(--text)]'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="text-xs text-[var(--text-muted)] py-6 text-center"><RefreshCw className="inline animate-spin mr-2" size={12}/>Loading invoice…</div>
      ) : (
        <>
          <div className="lx-panel p-6">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="lx-headline text-xl">Invoice Preview · {project}</h2>
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mt-1">
                  Period: {data.from_date} → {data.to_date} ({data.period_days} Tage)
                </p>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Total</div>
                <div className="text-3xl font-light text-[var(--accent)] font-mono">€{data.total_eur.toFixed(2)}</div>
              </div>
            </div>

            {!data.lines.length ? (
              <div className="py-8 text-center text-[var(--text-muted)] text-sm">
                Keine Allokationen für <code>{project}</code> gefunden. Subscriptions im Inventory-Tab zuordnen.
              </div>
            ) : (
              <table className="w-full text-xs mt-4">
                <thead className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2 text-left">Type</th>
                    <th className="text-left">Vendor / Product</th>
                    <th className="text-left">Note</th>
                    <th className="text-right">Cost (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l, i) => (
                    <tr key={i} className="border-b border-[var(--border)]/40">
                      <td className="py-2">
                        <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-widest rounded ${
                          l.kind === 'subscription' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-[#9be0a8]/15 text-[#9be0a8]'
                        }`}>{l.kind}</span>
                      </td>
                      <td>
                        <div className="font-medium">{l.product_name}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{l.vendor}{l.plan ? ` · ${l.plan}` : ''}</div>
                      </td>
                      <td className="text-[10px] text-[var(--text-muted)] max-w-[300px]">{l.note}</td>
                      <td className="text-right font-mono">€{l.period_cost_eur.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--accent)]">
                    <td colSpan={3} className="py-3 text-right font-medium uppercase tracking-widest text-xs">Total</td>
                    <td className="py-3 text-right font-mono text-[var(--accent)] text-lg">€{data.total_eur.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <div className="lx-panel p-4 text-[11px] text-[var(--text-muted)] flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Berechnungs-Logik: <strong>Subscriptions</strong> = full Abo-Preis (Tool-Reselling) anteilig auf {data.period_days} Tage normalisiert.
              <strong> API-Kosten</strong> = exact pass-through aus claude_usage_daily (project_slug).
              PDF-Export ist <strong>Coming Soon</strong> (siehe Tab "PDF Auto-Bill").
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── COMING SOON ──────────────────────────────────────────────────────── */
function ComingSoonBillThrough() {
  return (
    <div className="lx-panel p-8 max-w-3xl mx-auto text-center opacity-80">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] uppercase tracking-widest mb-4">
        <Zap size={11} /> Phase D · Coming Soon
      </div>
      <h2 className="lx-headline text-xl mb-3">PDF Auto-Bill Engine</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xl mx-auto">
        Invoice-Preview (im Tab nebenan) wird zu echtem <strong>PDF mit Briefkopf/Logo + Stripe-Payment-Link + Email-Versand</strong>.
        Plus: Carlos's Stunden-Tracking, monatlicher Auto-Versand am 1.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {['Miguel · UH', 'Tommy · Ketolabs', 'Patrick · Thailand', 'GTS-Members'].map(p => (
          <div key={p} className="lx-card p-3">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{p}</div>
            <div className="text-lg font-mono text-[var(--text-muted)]/40 mt-1">€—</div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
        Voraussetzung: Subscription-Tracking-Tabelle (ausgehende Tool-Abos manuell befüllt) · ETA: nächste Sessions
      </div>
    </div>
  );
}
