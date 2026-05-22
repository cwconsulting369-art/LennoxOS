import { useState, useEffect, Fragment } from 'react';
import {
  Users, TrendingUp, Layers, DollarSign, ChevronRight, ChevronDown,
  Briefcase, ShieldCheck, AlertTriangle, RefreshCw,
} from 'lucide-react';
import {
  OSHeader, KPIStrip, DataPanel, StatusBadge, HealthDot, eur,
} from '@aevum/ui-kit';

interface AevumProject {
  id?: string;
  slug?: string;
  name?: string;
  status?: string;
  type?: string;
}

interface AevumAccount {
  id?: string;
  slug: string;
  name: string;
  status?: string;
  tier?: string;
  monthlyRetainer?: number;
  health?: string;
  projects?: AevumProject[];
  permissions?: Record<string, unknown> | string[];
  permissionsSummary?: string;
  [k: string]: unknown;
}

interface AggregatePayload {
  generatedAt?: string;
  accounts?: AevumAccount[];
  totals?: {
    accounts?: number;
    active?: number;
    monthlyRetainer?: number;
    projects?: number;
  };
  cached?: boolean;
  error?: string;
  detail?: string;
}

function deriveTotals(data: AggregatePayload | null) {
  if (!data) return { accounts: 0, active: 0, retainer: 0, projects: 0 };
  if (data.totals) {
    return {
      accounts: data.totals.accounts ?? data.accounts?.length ?? 0,
      active: data.totals.active ?? 0,
      retainer: data.totals.monthlyRetainer ?? 0,
      projects: data.totals.projects ?? 0,
    };
  }
  const accs = data.accounts || [];
  return {
    accounts: accs.length,
    active: accs.filter(a => (a.status || '').toLowerCase() === 'active').length,
    retainer: accs.reduce((s, a) => s + (a.monthlyRetainer || 0), 0),
    projects: accs.reduce((s, a) => s + (a.projects?.length || 0), 0),
  };
}

export default function AevumCustomers() {
  const [data, setData] = useState<AggregatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/aevum/aggregate')
      .then(async r => {
        const j = await r.json().catch(() => ({} as AggregatePayload));
        if (!r.ok) throw new Error(j.error || j.detail || `HTTP ${r.status}`);
        return j as AggregatePayload;
      })
      .then(d => { setData(d); setErr(null); })
      .catch(e => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  const totals = deriveTotals(data);
  const accounts = data?.accounts || [];

  return (
    <div className="os-aevum flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Header — shared OSHeader */}
          <OSHeader
            title="AEVUM Customers"
            subtitle="Productized Agency · Account aggregate"
            subdomain="api.aevum-system.de"
            health="green"
            status="active"
            meta={data?.generatedAt
              ? `Last sync: ${new Date(data.generatedAt).toLocaleString('de-DE')}${data?.cached ? ' · cached' : ''}`
              : '—'}
            actions={
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-elevated transition-colors"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            }
          />

          {/* KPI strip — shared KPIStrip */}
          <KPIStrip
            cols={4}
            items={[
              {
                label: 'Accounts',
                value: totals.accounts,
                sub: 'Total',
                icon: Users,
              },
              {
                label: 'Active',
                value: totals.active,
                sub: `${totals.accounts ? Math.round(totals.active * 100 / totals.accounts) : 0}% live`,
                icon: TrendingUp,
                valueClassName: 'text-status-success',
              },
              {
                label: 'Monthly Retainer',
                value: eur(totals.retainer),
                sub: 'Sum aller Accounts',
                icon: DollarSign,
                valueClassName: 'text-status-success',
              },
              {
                label: 'Projects',
                value: totals.projects,
                sub: 'Über alle Accounts',
                icon: Briefcase,
              },
            ]}
          />

          {/* Error */}
          {err && (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-4 flex items-start gap-2">
              <AlertTriangle size={14} className="text-status-danger mt-0.5" />
              <div>
                <p className="text-xs font-medium text-status-danger">Aggregate konnte nicht geladen werden</p>
                <p className="text-[11px] text-os-muted mt-0.5">{err}</p>
              </div>
            </div>
          )}

          {/* Accounts — shared DataPanel */}
          <DataPanel
            title={`Accounts (${accounts.length})`}
            icon={Layers}
            flush
          >
            {accounts.length === 0 && !loading && !err && (
              <p className="px-4 py-6 text-[11px] text-os-muted italic">— keine Accounts —</p>
            )}

            {accounts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-os-muted bg-elevated/40">
                      <th className="text-left font-semibold px-4 py-2 w-6"></th>
                      <th className="text-left font-semibold px-2 py-2">Slug</th>
                      <th className="text-left font-semibold px-2 py-2">Name</th>
                      <th className="text-left font-semibold px-2 py-2">Status</th>
                      <th className="text-left font-semibold px-2 py-2">Tier</th>
                      <th className="text-right font-semibold px-2 py-2">Projects</th>
                      <th className="text-right font-semibold px-2 py-2">Retainer</th>
                      <th className="text-center font-semibold px-2 py-2 w-12">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a, idx) => {
                      const key = a.id || a.slug || String(idx);
                      const isOpen = expanded === key;
                      return (
                        <Fragment key={key}>
                          <tr
                            onClick={() => setExpanded(isOpen ? null : key)}
                            className="border-t border-border/60 hover:bg-elevated/40 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-2 text-os-muted">
                              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </td>
                            <td className="px-2 py-2 font-mono text-[11px] text-accent">{a.slug || '—'}</td>
                            <td className="px-2 py-2 text-os-text">{a.name || '—'}</td>
                            <td className="px-2 py-2"><StatusBadge status={a.status} /></td>
                            <td className="px-2 py-2 text-os-muted">{a.tier || '—'}</td>
                            <td className="px-2 py-2 text-right text-os-text">{a.projects?.length ?? 0}</td>
                            <td className="px-2 py-2 text-right text-status-success font-medium">{eur(a.monthlyRetainer)}</td>
                            <td className="px-2 py-2 text-center"><HealthDot health={a.health} /></td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-elevated/20">
                              <td colSpan={8} className="px-6 py-4">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-os-muted mb-2 flex items-center gap-1.5">
                                      <Briefcase size={11} /> Projects ({a.projects?.length || 0})
                                    </h4>
                                    {a.projects?.length ? (
                                      <ul className="space-y-1">
                                        {a.projects.map((p, i) => (
                                          <li
                                            key={p.id || p.slug || i}
                                            className="flex items-center justify-between rounded bg-surface px-2 py-1.5"
                                          >
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-medium text-os-text truncate">{p.name || p.slug || '—'}</p>
                                              {p.type && <p className="text-[10px] text-os-muted">{p.type}</p>}
                                            </div>
                                            {p.status && <StatusBadge status={p.status} />}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : <p className="text-[11px] text-os-muted italic">— keine Projects —</p>}
                                  </div>
                                  <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-os-muted mb-2 flex items-center gap-1.5">
                                      <ShieldCheck size={11} /> Permissions
                                    </h4>
                                    {a.permissionsSummary ? (
                                      <p className="text-[11px] text-os-text leading-relaxed">{a.permissionsSummary}</p>
                                    ) : a.permissions ? (
                                      <pre className="text-[10px] text-os-muted bg-surface rounded p-2 overflow-x-auto max-h-48">
{JSON.stringify(a.permissions, null, 2)}
                                      </pre>
                                    ) : (
                                      <p className="text-[11px] text-os-muted italic">— keine Permissions-Daten —</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DataPanel>

          <p className="text-[10px] text-os-muted italic">
            Daten via Lennox-OS Proxy → <code>/api/aevum/aggregate</code> (cache 60s, admin-token never exposed to browser).
          </p>
        </div>
      </div>
    </div>
  );
}
