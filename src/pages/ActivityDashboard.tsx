import { useEffect, useMemo, useState } from 'react';
import {
  Activity, Zap, DollarSign, Cpu, Hash, RefreshCw, Clock,
  CreditCard, Repeat, Lock, Layers, TrendingUp,
} from 'lucide-react';

/* ============================================================
 * ActivityDashboard — Claude / Vendor / Stripe Activity
 * Live-Sicht über Token-Verbrauch, Vendor-Spend, Subscriptions, Payments.
 * Daten aus Lennox-Supabase via /api/activity/*
 * ============================================================ */

type Tab = 'claude' | 'vendors' | 'infra' | 'ai' | 'automation' | 'marketing' | 'subscriptions' | 'payments' | 'missing' | 'allocation';

interface SummaryRange {
  input: number; output: number; cache_creation: number; cache_read: number;
  messages: number; tool_calls: number; cost_usd: number; total_tokens: number;
}
interface Summary {
  today: SummaryRange; last_7d: SummaryRange; last_30d: SummaryRange;
  sessions_total: number;
  recent_syncs: { id: number; source: string; status: string; started_at: string; finished_at?: string; rows_processed?: number; error?: string }[];
}

interface DailyRow {
  day: string; model: string; project_slug: string;
  input_tokens: number; output_tokens: number; cache_creation_tokens: number; cache_read_tokens: number;
  message_count: number; tool_calls: number; effective_cost_usd: number;
}

interface BreakdownItem { model?: string; project_slug?: string; tokens: number; cost: number; messages: number; }

interface SessionRow {
  session_id: string; project_path: string; project_slug: string;
  last_seen_at: string; first_seen_at: string;
  message_count: number;
  total_input_tokens: number; total_output_tokens: number;
  total_cache_creation_tokens: number; total_cache_read_tokens: number;
  total_tool_calls: number; models_used: string[];
}

interface VendorRow {
  day: string; vendor: string; model: string;
  request_count: number; input_tokens: number; output_tokens: number; cost_usd: number;
  raw?: { total_usage?: number; total_credits?: number; note?: string };
}

interface SubRow {
  stripe_id: string; product_name: string; price_nickname: string;
  amount_cents: number; currency: string; interval: string; status: string;
  current_period_end: string; cancel_at_period_end: boolean;
}

interface PayRow {
  stripe_id: string; amount_cents: number; currency: string; status: string;
  description: string; created_at: string;
}

interface MetricRow {
  day: string; vendor: string; metric_name: string; scope: string;
  value: number; unit: string; cost_usd: number; raw?: any;
}

interface MissingKey {
  id: number; vendor: string; needed_key: string; needed_scope: string;
  reason: string; console_url: string; status: string; noted_at: string;
}

const VENDOR_GROUPS: Record<string, { label: string; vendors: string[]; tab: Tab }> = {
  infra:      { label: 'Infrastruktur', vendors: ['vercel', 'cloudflare', 'hetzner'], tab: 'infra' },
  ai:         { label: 'AI-Provider',    vendors: ['gemini', 'perplexity', 'elevenlabs', 'huggingface'], tab: 'ai' },
  automation: { label: 'Automation',     vendors: ['n8n', 'make', 'github'], tab: 'automation' },
  marketing:  { label: 'Marketing/Data', vendors: ['klaviyo', 'airtable', 'notion'], tab: 'marketing' },
};

function fmtNum(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}
function fmtUsd(n: number) { return '$' + n.toFixed(2); }
function fmtEur(cents: number, currency = 'eur') {
  const sym = currency === 'eur' ? '€' : currency === 'usd' ? '$' : currency.toUpperCase() + ' ';
  return sym + (cents / 100).toFixed(2);
}
function timeAgo(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function shortDate(iso: string) {
  try { return iso.slice(0, 10); } catch { return iso; }
}

export default function ActivityDashboard() {
  const [tab, setTab] = useState<Tab>('claude');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [byModel, setByModel] = useState<BreakdownItem[]>([]);
  const [byProject, setByProject] = useState<BreakdownItem[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [missing, setMissing] = useState<MissingKey[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, d, b, ses, v, su, p, mt, mk] = await Promise.all([
        fetch('/api/activity/summary').then(r => r.json()),
        fetch('/api/activity/daily').then(r => r.json()),
        fetch('/api/activity/breakdown').then(r => r.json()),
        fetch('/api/activity/sessions?limit=30').then(r => r.json()),
        fetch('/api/activity/vendors').then(r => r.json()),
        fetch('/api/activity/subscriptions').then(r => r.json()),
        fetch('/api/activity/payments?limit=50').then(r => r.json()),
        fetch('/api/activity/metrics').then(r => r.json()),
        fetch('/api/activity/missing-keys').then(r => r.json()),
      ]);
      setSummary(s);
      setDaily(d.rows || []);
      setByModel(b.by_model || []);
      setByProject(b.by_project || []);
      setSessions(ses.rows || []);
      setVendors(v.rows || []);
      setSubs(su.rows || []);
      setPayments(p.rows || []);
      setMetrics(mt.rows || []);
      setMissing(mk.rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function triggerSync(source: string) {
    setSyncing(source);
    try {
      await fetch(`/api/activity/sync/${source}`, { method: 'POST' });
      // Wait briefly then reload
      setTimeout(() => { loadAll(); setSyncing(null); }, 6000);
    } catch {
      setSyncing(null);
    }
  }

  // Aggregate daily by date (sum across model/project)
  const dailyTotals = useMemo(() => {
    const map: Record<string, { day: string; tokens: number; cost: number; messages: number }> = {};
    for (const r of daily) {
      const tot = Number(r.input_tokens) + Number(r.output_tokens) + Number(r.cache_creation_tokens) + Number(r.cache_read_tokens);
      if (!map[r.day]) map[r.day] = { day: r.day, tokens: 0, cost: 0, messages: 0 };
      map[r.day].tokens += tot;
      map[r.day].cost += Number(r.effective_cost_usd || 0);
      map[r.day].messages += Number(r.message_count || 0);
    }
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
  }, [daily]);

  const maxDailyTokens = useMemo(() => Math.max(1, ...dailyTotals.map(d => d.tokens)), [dailyTotals]);
  const totalSubsMonthly = useMemo(() => {
    return subs.filter(s => s.status === 'active').reduce((sum, s) => {
      const monthly = s.interval === 'year' ? s.amount_cents / 12 : s.amount_cents;
      return sum + monthly;
    }, 0);
  }, [subs]);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
        <RefreshCw className="animate-spin mr-2" size={18} />
        Loading activity data…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="lx-headline text-2xl flex items-center gap-3">
            <Activity size={22} className="text-[var(--accent)]" />
            Activity Dashboard
          </h1>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mt-1">
            Claude · Vendors · Subscriptions · Payments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="lx-btn flex items-center gap-2 text-xs"
            disabled={syncing === 'claude'}
            onClick={() => triggerSync('claude')}
          >
            <RefreshCw size={12} className={syncing === 'claude' ? 'animate-spin' : ''} />
            {syncing === 'claude' ? 'Syncing…' : 'Sync Claude'}
          </button>
          <button
            className="lx-btn flex items-center gap-2 text-xs"
            disabled={syncing === 'vendors'}
            onClick={() => triggerSync('vendors')}
          >
            <RefreshCw size={12} className={syncing === 'vendors' ? 'animate-spin' : ''} />
            Vendors
          </button>
          <button
            className="lx-btn flex items-center gap-2 text-xs"
            disabled={syncing === 'stripe'}
            onClick={() => triggerSync('stripe')}
          >
            <RefreshCw size={12} className={syncing === 'stripe' ? 'animate-spin' : ''} />
            Stripe
          </button>
          <button
            className="lx-btn lx-btn--primary flex items-center gap-2 text-xs"
            disabled={syncing === 'all'}
            onClick={async () => {
              setSyncing('all');
              await Promise.all(['claude', 'vendors', 'stripe', 'infra', 'ai', 'automation', 'marketing']
                .map(s => fetch(`/api/activity/sync/${s}`, { method: 'POST' })));
              setTimeout(() => { loadAll(); setSyncing(null); }, 10000);
            }}
          >
            <RefreshCw size={12} className={syncing === 'all' ? 'animate-spin' : ''} />
            Sync ALL
          </button>
        </div>
      </div>

      {/* KPI-Strip */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <KpiCard
          icon={<Zap size={14} />}
          label="Heute · Tokens"
          value={summary ? fmtNum(summary.today.total_tokens) : '—'}
          sub={summary ? `${summary.today.messages} msgs · ${summary.today.tool_calls} tools` : ''}
        />
        <KpiCard
          icon={<DollarSign size={14} />}
          label="Heute · API-equivalent"
          value={summary ? fmtUsd(summary.today.cost_usd) : '—'}
          sub="vs $200/mo Max Flat"
          accent
        />
        <KpiCard
          icon={<TrendingUp size={14} />}
          label="7d · API-equivalent"
          value={summary ? fmtUsd(summary.last_7d.cost_usd) : '—'}
          sub={summary ? fmtNum(summary.last_7d.total_tokens) + ' tokens' : ''}
        />
        <KpiCard
          icon={<Repeat size={14} />}
          label="30d · API-equivalent"
          value={summary ? fmtUsd(summary.last_30d.cost_usd) : '—'}
          sub={summary ? `${summary.sessions_total} sessions tracked` : ''}
        />
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-[var(--border)] flex gap-1 flex-shrink-0 overflow-x-auto">
        <TabBtn active={tab === 'claude'}        onClick={() => setTab('claude')}        icon={<Cpu size={13} />}>Claude</TabBtn>
        <TabBtn active={tab === 'vendors'}       onClick={() => setTab('vendors')}       icon={<Layers size={13} />}>LLM-APIs</TabBtn>
        <TabBtn active={tab === 'infra'}         onClick={() => setTab('infra')}         icon={<Cpu size={13} />}>Infra</TabBtn>
        <TabBtn active={tab === 'ai'}            onClick={() => setTab('ai')}            icon={<Activity size={13} />}>AI-Stack</TabBtn>
        <TabBtn active={tab === 'automation'}    onClick={() => setTab('automation')}    icon={<RefreshCw size={13} />}>Automation</TabBtn>
        <TabBtn active={tab === 'marketing'}     onClick={() => setTab('marketing')}     icon={<Hash size={13} />}>Marketing</TabBtn>
        <TabBtn active={tab === 'subscriptions'} onClick={() => setTab('subscriptions')} icon={<Repeat size={13} />}>Subs</TabBtn>
        <TabBtn active={tab === 'payments'}      onClick={() => setTab('payments')}      icon={<CreditCard size={13} />}>Payments</TabBtn>
        <TabBtn active={tab === 'missing'}       onClick={() => setTab('missing')}       icon={<Lock size={13} />}>Missing-Keys{missing.filter(m => m.status === 'pending').length > 0 ? ` (${missing.filter(m => m.status === 'pending').length})` : ''}</TabBtn>
        <TabBtn active={tab === 'allocation'}    onClick={() => setTab('allocation')}    icon={<Lock size={13} />} comingSoon>Allocation</TabBtn>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {tab === 'claude' && (
          <ClaudeTab dailyTotals={dailyTotals} maxDailyTokens={maxDailyTokens} byModel={byModel} byProject={byProject} sessions={sessions} syncRuns={summary?.recent_syncs || []} />
        )}
        {tab === 'vendors' && <VendorsTab rows={vendors} />}
        {tab === 'infra'      && <MetricsTab metrics={metrics} vendors={VENDOR_GROUPS.infra.vendors}      title="Infrastruktur (Vercel · Cloudflare · Hetzner)" />}
        {tab === 'ai'         && <MetricsTab metrics={metrics} vendors={VENDOR_GROUPS.ai.vendors}         title="AI-Stack (Gemini · Perplexity · ElevenLabs · HuggingFace)" />}
        {tab === 'automation' && <MetricsTab metrics={metrics} vendors={VENDOR_GROUPS.automation.vendors} title="Automation (n8n · Make · GitHub Actions)" />}
        {tab === 'marketing'  && <MetricsTab metrics={metrics} vendors={VENDOR_GROUPS.marketing.vendors}  title="Marketing & Data (Klaviyo · Airtable · Notion)" />}
        {tab === 'subscriptions' && <SubsTab rows={subs} totalMonthly={totalSubsMonthly} />}
        {tab === 'payments' && <PaymentsTab rows={payments} />}
        {tab === 'missing' && <MissingKeysTab rows={missing} />}
        {tab === 'allocation' && <ComingSoonAllocation />}
      </div>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function KpiCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="lx-card p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
        {icon}{label}
      </div>
      <div className={`lx-kpi-value mt-1 ${accent ? 'text-[var(--accent)]' : ''}`}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] mt-1">{sub}</div>}
    </div>
  );
}

function TabBtn({ active, onClick, icon, comingSoon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; comingSoon?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
        active
          ? 'border-[var(--accent)] text-[var(--text)]'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
      } ${comingSoon ? 'opacity-60' : ''}`}
    >
      {icon}
      {children}
      {comingSoon && (
        <span className="ml-1 px-1.5 py-0.5 text-[8px] uppercase tracking-widest rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)]">
          Soon
        </span>
      )}
    </button>
  );
}

function ClaudeTab({ dailyTotals, maxDailyTokens, byModel, byProject, sessions, syncRuns }: {
  dailyTotals: { day: string; tokens: number; cost: number; messages: number }[];
  maxDailyTokens: number;
  byModel: BreakdownItem[]; byProject: BreakdownItem[];
  sessions: SessionRow[];
  syncRuns: Summary['recent_syncs'];
}) {
  return (
    <div className="space-y-6">
      {/* Daily bars */}
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-4">Tokens · letzte 30 Tage</div>
        <div className="flex items-end gap-1 h-40 relative">
          {dailyTotals.map(d => {
            const h = Math.max(2, Math.round((d.tokens / maxDailyTokens) * 100));
            return (
              <div key={d.day} className="flex-1 group relative flex flex-col justify-end" title={`${d.day}: ${fmtNum(d.tokens)} tokens · ${fmtUsd(d.cost)}`}>
                <div className="bg-gradient-to-t from-[var(--accent-strong)] to-[var(--accent)] rounded-t-sm transition-all" style={{ height: `${h}%` }} />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-[var(--surface)] border border-[var(--border)] rounded text-[10px] px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                  {d.day}<br />{fmtNum(d.tokens)} tok<br />{fmtUsd(d.cost)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-2 uppercase tracking-widest">
          <span>{dailyTotals[0]?.day || '—'}</span>
          <span>{dailyTotals[dailyTotals.length - 1]?.day || '—'}</span>
        </div>
      </div>

      {/* Two columns: by model + by project */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownPanel title="By Model · 30d" rows={byModel} keyField="model" />
        <BreakdownPanel title="By Project · 30d" rows={byProject} keyField="project_slug" />
      </div>

      {/* Recent sessions */}
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Recent Sessions</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 text-left">Last seen</th>
                <th className="text-left">Project</th>
                <th className="text-left">Models</th>
                <th className="text-right">Msgs</th>
                <th className="text-right">Tokens</th>
                <th className="text-right">Tools</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => {
                const tot = Number(s.total_input_tokens) + Number(s.total_output_tokens) + Number(s.total_cache_creation_tokens) + Number(s.total_cache_read_tokens);
                return (
                  <tr key={s.session_id} className="border-b border-[var(--border)]/40 hover:bg-[var(--surface)]/40">
                    <td className="py-2 text-[var(--text-muted)]">{timeAgo(s.last_seen_at)}</td>
                    <td className="font-medium">{s.project_slug}</td>
                    <td className="text-[var(--text-muted)] truncate max-w-[160px]">{(s.models_used || []).join(', ') || '—'}</td>
                    <td className="text-right">{s.message_count}</td>
                    <td className="text-right">{fmtNum(tot)}</td>
                    <td className="text-right">{s.total_tool_calls}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync runs */}
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Recent Syncs</div>
        <div className="space-y-2">
          {syncRuns.map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className={`lx-dot ${r.status === 'ok' ? 'lx-dot--ok' : r.status === 'error' ? 'lx-dot--err' : 'lx-dot--warn'}`} />
                <span className="font-medium w-24">{r.source}</span>
                <span className="text-[var(--text-muted)]">{timeAgo(r.started_at)}</span>
                <span className="text-[var(--text-muted)]">{r.rows_processed ?? '—'} rows</span>
              </div>
              {r.error && <span className="text-[var(--status-danger)] text-[10px] truncate max-w-[300px]">{r.error}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({ title, rows, keyField }: { title: string; rows: BreakdownItem[]; keyField: 'model' | 'project_slug' }) {
  const maxCost = Math.max(1, ...rows.map(r => r.cost));
  return (
    <div className="lx-panel p-5">
      <div className="lx-section-title mb-3">{title}</div>
      <div className="space-y-2">
        {rows.slice(0, 10).map((r, i) => {
          const label = (r as any)[keyField] || 'unknown';
          const pct = (r.cost / maxCost) * 100;
          return (
            <div key={label + i} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="font-medium truncate max-w-[60%]">{label}</span>
                <span className="text-[var(--text-muted)]">{fmtUsd(r.cost)} · {fmtNum(r.tokens)} tok</span>
              </div>
              <div className="h-1.5 bg-[var(--surface)] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)]" style={{ width: pct + '%' }} />
              </div>
            </div>
          );
        })}
        {!rows.length && <div className="text-xs text-[var(--text-muted)]">Keine Daten.</div>}
      </div>
    </div>
  );
}

function VendorsTab({ rows }: { rows: VendorRow[] }) {
  // Group by vendor
  const byVendor: Record<string, VendorRow[]> = {};
  for (const r of rows) {
    if (!byVendor[r.vendor]) byVendor[r.vendor] = [];
    byVendor[r.vendor].push(r);
  }
  const vendors = Object.keys(byVendor).sort();

  return (
    <div className="space-y-4">
      {!vendors.length && (
        <div className="lx-panel p-6 text-center text-sm text-[var(--text-muted)]">
          Keine Vendor-Daten. <code>node services/activity-sync/vendor-sync.js</code> ausführen oder Sync-Button klicken.
        </div>
      )}
      {vendors.map(v => {
        const list = byVendor[v];
        const totalCost = list.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
        const totalReq = list.reduce((s, r) => s + Number(r.request_count || 0), 0);
        return (
          <div key={v} className="lx-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="lx-section-title">{v}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {totalReq} requests · <span className="text-[var(--accent)] font-medium">{fmtUsd(totalCost)}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-2 text-left">Day</th>
                    <th className="text-left">Model</th>
                    <th className="text-right">Reqs</th>
                    <th className="text-right">In</th>
                    <th className="text-right">Out</th>
                    <th className="text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, 30).map(r => (
                    <tr key={r.day + r.model} className="border-b border-[var(--border)]/40">
                      <td className="py-1.5 text-[var(--text-muted)]">{r.day}</td>
                      <td className="font-medium truncate max-w-[200px]">{r.model}</td>
                      <td className="text-right">{r.request_count}</td>
                      <td className="text-right">{fmtNum(r.input_tokens)}</td>
                      <td className="text-right">{fmtNum(r.output_tokens)}</td>
                      <td className="text-right">{fmtUsd(Number(r.cost_usd))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {list[0]?.raw?.total_credits != null && (
              <div className="mt-3 text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                Account: ${list[0].raw.total_usage?.toFixed(2)} used · ${list[0].raw.total_credits} credits
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubsTab({ rows, totalMonthly }: { rows: SubRow[]; totalMonthly: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={<Repeat size={14} />} label="Subs Total" value={String(rows.length)} sub={`${rows.filter(r => r.status === 'active').length} aktiv`} />
        <KpiCard icon={<DollarSign size={14} />} label="Monatlich (aktiv)" value={fmtEur(totalMonthly)} sub="normalisiert auf monthly" accent />
        <KpiCard icon={<Clock size={14} />} label="Jahres-Run-Rate" value={fmtEur(totalMonthly * 12)} />
      </div>
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Eingehende Subs (Carlos's Stripe-Account)</div>
        <p className="text-[10px] text-[var(--text-muted)] mb-3">
          Dies sind Subscriptions die <strong>auf</strong> Carlos's Stripe-Konto laufen (AEVUM-Shop Customer-Abos etc.).
          Für <strong>ausgehende</strong> Tool-Abos (Vercel, Cloudflare, Anthropic-Max etc.) → siehe Subscription-Tracking-Tabelle [folgt].
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 text-left">Status</th>
                <th className="text-left">Product</th>
                <th className="text-right">Amount</th>
                <th className="text-left">Interval</th>
                <th className="text-left">Renews</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr><td colSpan={5} className="py-6 text-center text-[var(--text-muted)]">Keine Subscriptions im Stripe-Account.</td></tr>
              )}
              {rows.map(s => (
                <tr key={s.stripe_id} className="border-b border-[var(--border)]/40">
                  <td className="py-2">
                    <span className={`lx-dot ${s.status === 'active' ? 'lx-dot--ok' : 'lx-dot--warn'} mr-2`} />
                    {s.status}
                  </td>
                  <td className="font-medium">{s.product_name || s.price_nickname || '—'}</td>
                  <td className="text-right">{fmtEur(s.amount_cents, s.currency)}</td>
                  <td className="text-[var(--text-muted)]">{s.interval}</td>
                  <td className="text-[var(--text-muted)]">{s.current_period_end ? shortDate(s.current_period_end) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PaymentsTab({ rows }: { rows: PayRow[] }) {
  const totalSucceeded = rows.filter(r => r.status === 'succeeded').reduce((s, r) => s + r.amount_cents, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={<Hash size={14} />} label="Payments" value={String(rows.length)} />
        <KpiCard icon={<DollarSign size={14} />} label="Succeeded" value={fmtEur(totalSucceeded)} accent />
        <KpiCard icon={<Clock size={14} />} label="Failed" value={String(rows.filter(r => r.status === 'failed').length)} />
      </div>
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-3">Letzte Payments</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[var(--text-muted)] text-[10px] uppercase tracking-widest">
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 text-left">When</th>
                <th className="text-left">Status</th>
                <th className="text-left">Description</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr><td colSpan={4} className="py-6 text-center text-[var(--text-muted)]">Keine Payments im Stripe-Account.</td></tr>
              )}
              {rows.map(p => (
                <tr key={p.stripe_id} className="border-b border-[var(--border)]/40">
                  <td className="py-2 text-[var(--text-muted)]">{timeAgo(p.created_at)}</td>
                  <td>
                    <span className={`lx-dot ${p.status === 'succeeded' ? 'lx-dot--ok' : p.status === 'failed' ? 'lx-dot--err' : 'lx-dot--warn'} mr-2`} />
                    {p.status}
                  </td>
                  <td className="truncate max-w-[400px]">{p.description || '—'}</td>
                  <td className="text-right font-medium">{fmtEur(p.amount_cents, p.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricsTab({ metrics, vendors, title }: { metrics: MetricRow[]; vendors: string[]; title: string }) {
  // Group by vendor → only latest day per (vendor,metric,scope)
  const filtered = metrics.filter(m => vendors.includes(m.vendor));
  const latestPerKey: Record<string, MetricRow> = {};
  for (const r of filtered) {
    const k = `${r.vendor}|${r.metric_name}|${r.scope}`;
    if (!latestPerKey[k] || latestPerKey[k].day < r.day) latestPerKey[k] = r;
  }
  const byVendor: Record<string, MetricRow[]> = {};
  for (const r of Object.values(latestPerKey)) {
    if (!byVendor[r.vendor]) byVendor[r.vendor] = [];
    byVendor[r.vendor].push(r);
  }

  function fmtVal(v: number, unit: string) {
    if (unit === 'bytes') {
      const u = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0; let n = v;
      while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
      return `${n.toFixed(1)} ${u[i]}`;
    }
    if (unit === 'eur') return '€' + v.toFixed(2);
    if (unit === 'usd') return '$' + v.toFixed(2);
    if (unit === 'state') return v === 1 ? '✓' : '×';
    if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k';
    return String(v);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="lx-headline text-lg">{title}</h2>
      </div>
      {!Object.keys(byVendor).length && (
        <div className="lx-panel p-6 text-center text-sm text-[var(--text-muted)]">
          Noch keine Daten. Sync ausführen oder API-Key fehlt — siehe Missing-Keys-Tab.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {vendors.map(v => {
          const items = byVendor[v] || [];
          return (
            <div key={v} className="lx-panel p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="lx-section-title capitalize">{v}</div>
                {!items.length && <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">no data</span>}
              </div>
              {items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border-b border-[var(--border)]/30 py-1.5">
                      <div className="flex-1">
                        <div className="text-[var(--text)] font-medium">{r.metric_name}</div>
                        {r.scope && <div className="text-[10px] text-[var(--text-muted)] truncate">{r.scope}</div>}
                      </div>
                      <div className="text-right">
                        <div className={`font-mono ${r.unit === 'eur' || r.unit === 'usd' ? 'text-[var(--accent)]' : ''}`}>{fmtVal(Number(r.value), r.unit)}</div>
                        <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest">{r.day}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[var(--text-muted)]">Sync ausstehend oder API-Key fehlt.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MissingKeysTab({ rows }: { rows: MissingKey[] }) {
  const pending = rows.filter(r => r.status === 'pending');
  const resolved = rows.filter(r => r.status === 'resolved');
  return (
    <div className="space-y-4">
      <div className="lx-panel p-5">
        <div className="lx-section-title mb-2">Pending — {pending.length}</div>
        <p className="text-[10px] text-[var(--text-muted)] mb-3 uppercase tracking-widest">
          Diese Endpoints konnten nicht abgerufen werden. Action: Token in der jeweiligen Console nachgenerieren und in ~/.claude/.env hinterlegen.
        </p>
        {!pending.length && <div className="text-xs text-[var(--text-muted)]">Alles abgedeckt.</div>}
        <div className="space-y-3">
          {pending.map(r => (
            <div key={r.id} className="border-l-2 border-[var(--accent)] pl-3 py-1">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div className="font-medium text-sm">
                  <span className="text-[var(--accent)]">{r.vendor}</span> · <code className="text-xs">{r.needed_key}</code>
                </div>
                {r.needed_scope && (
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">scope: {r.needed_scope}</span>
                )}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{r.reason}</div>
              {r.console_url && (
                <a href={r.console_url} target="_blank" rel="noopener" className="text-[10px] text-[var(--accent)] hover:underline mt-1 inline-block">
                  → {r.console_url}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
      {resolved.length > 0 && (
        <div className="lx-panel p-5 opacity-60">
          <div className="lx-section-title mb-2">Resolved — {resolved.length}</div>
          <div className="space-y-1 text-xs">
            {resolved.map(r => (
              <div key={r.id}>✓ <span className="text-[var(--accent)]">{r.vendor}</span> · <code>{r.needed_key}</code></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoonAllocation() {
  return (
    <div className="lx-panel p-8 max-w-3xl mx-auto text-center opacity-80">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] uppercase tracking-widest mb-4">
        <Lock size={11} /> Phase D · Coming Soon
      </div>
      <h2 className="lx-headline text-xl mb-3">Cost-per-Project Allocation</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xl mx-auto">
        Master-View die Claude-Tokens, Vendor-Spend, eingehende Customer-Subs und ausgehende
        Tool-Abos in eine <strong>echte Project-P&amp;L-Heat-Map</strong> verbindet — pro Projekt,
        pro Monat, mit Markup-Logic für Kunden-Weiterberechnung.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {['AEVUM', 'GTS', 'UtilityHub', 'Ketolabs', 'Thailand', 'K3ngama', 'BetterFly', 'LennoxOS'].map(p => (
          <div key={p} className="lx-card p-3">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{p}</div>
            <div className="text-lg font-medium text-[var(--text-muted)]/40 mt-1">—</div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
        Voraussetzung: Subscription-Tracking-Tabelle (separater Build) · ETA: nächste Session
      </div>
    </div>
  );
}
