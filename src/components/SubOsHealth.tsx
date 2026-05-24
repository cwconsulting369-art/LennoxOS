// Sub-OS Health Section — Wave E3 (2026-05-24)
// Pulls /api/aevum/sub-os (lennox-os proxy → aevum-api /api/sub-os/_all/summary)
// Renders one card per Customer Sub-OS (UH / Ketolabs / GTS / Thailand-RE) with
// top KPIs, alert badges, and last-activity timestamp.

import { useEffect, useState } from 'react';
import {
  Activity, AlertCircle, CheckCircle2, Clock, RefreshCw, Zap,
} from 'lucide-react';
import { DataPanel, HealthDot } from '@aevum/ui-kit';

interface SubOsSummary {
  ok: boolean;
  system: string;
  label: string;
  ts: string;
  kpis: Record<string, unknown>;
  alerts: Array<{ level: string; message: string }>;
  last_activity: string | null;
  source: string;
  cached?: boolean;
  error?: string;
}

interface SubOsPayload {
  ok: boolean;
  ts?: string;
  cached?: boolean;
  systems: Record<string, SubOsSummary>;
  error?: string;
}

const SYSTEM_ORDER = ['utilityhub', 'ketolabs', 'gts', 'thailand-re'];

const SYSTEM_HINT: Record<string, string> = {
  'utilityhub': 'Hausverwaltungs-Datenhub',
  'ketolabs':   'Tommy · DTC Performance',
  'gts':        'Kevin · Trader Community',
  'thailand-re': 'Patrick · Pattaya/Phuket RE',
};

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (v === 'unavailable') return '—';
  if (typeof v === 'number') return v.toLocaleString('de-DE');
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length}` : '…';
  return String(v);
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function pickHeroKpis(system: string, kpis: Record<string, unknown>) {
  // Choose top-3 KPIs per system that look most meaningful at-a-glance.
  const common = [
    { label: 'Accounts',    val: kpis.accounts_total },
    { label: 'Active',      val: kpis.accounts_active },
    { label: 'Leads 7d',    val: kpis.leads_7d },
    { label: 'Projects',    val: kpis.projects_total },
    { label: 'Agent-€ 7d',  val: kpis.agent_cost_eur_7d },
  ];
  const systemSpec: Array<{ label: string; val: unknown }> = (() => {
    if (system === 'utilityhub') return [
      { label: 'Audits',      val: kpis.audits_run_total },
      { label: 'Quicklinks',  val: kpis.quicklinks_total },
    ];
    if (system === 'ketolabs') return [
      { label: 'Ad-Spend 7d', val: kpis.ad_spend_7d_eur },
      { label: 'Shop 7d',     val: kpis.shop_orders_7d },
    ];
    if (system === 'gts') return [
      { label: 'Members',     val: kpis.members_active },
      { label: 'Signals 7d',  val: kpis.signals_published_7d },
    ];
    if (system === 'thailand-re') return [
      { label: 'Props',       val: kpis.properties_inventory },
      { label: 'Bot Msg 7d',  val: kpis.bot_msg_count_7d },
    ];
    return [];
  })();
  // Pick up to 4 non-empty
  const merged = [...common, ...systemSpec].filter(x => x.val !== undefined);
  return merged.slice(0, 4);
}

function healthFor(s: SubOsSummary): 'green' | 'yellow' | 'red' | 'gray' {
  if (s.error || !s.ok) return 'red';
  if (s.alerts?.some(a => a.level === 'warning')) return 'yellow';
  if ((s.kpis.accounts_active as number) > 0 || s.last_activity) return 'green';
  return 'gray';
}

export default function SubOsHealth() {
  const [data, setData] = useState<SubOsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/aevum/sub-os')
      .then(async r => {
        const j = await r.json().catch(() => ({} as SubOsPayload));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j as SubOsPayload;
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

  const systems = data?.systems || {};

  return (
    <DataPanel
      title="Sub-OS Health"
      icon={Activity}
      actions={
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[10px] text-os-muted hover:text-os-text hover:bg-elevated transition-colors"
          title="Refresh"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {data?.cached ? 'cached' : 'live'}
        </button>
      }
    >
      {err && (
        <div className="px-4 py-3 text-[11px] text-status-danger flex items-center gap-2">
          <AlertCircle size={12} /> {err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
        {SYSTEM_ORDER.map(slug => {
          const s = systems[slug];
          if (!s) {
            return (
              <div key={slug} className="rounded-lg border border-border bg-elevated/30 p-3 opacity-60">
                <div className="flex items-center gap-2">
                  <HealthDot health="gray" />
                  <span className="text-xs font-medium">{slug}</span>
                </div>
                <p className="text-[10px] text-os-muted mt-1">no data</p>
              </div>
            );
          }
          const heroKpis = pickHeroKpis(slug, s.kpis || {});
          const health = healthFor(s);
          const lastTs = s.last_activity || s.ts;
          return (
            <div
              key={slug}
              className="rounded-lg border border-border bg-elevated/30 p-3 hover:bg-elevated/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <HealthDot health={health} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{s.label || slug}</div>
                    <div className="text-[10px] text-os-muted truncate">{SYSTEM_HINT[slug] || ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-os-muted shrink-0">
                  <Clock size={10} /> {relTime(lastTs)}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2">
                {heroKpis.map(({ label, val }) => (
                  <div key={label} className="text-center">
                    <div className="text-[10px] uppercase tracking-wide text-os-muted">{label}</div>
                    <div className="text-sm font-semibold mt-0.5 truncate" title={String(val)}>
                      {fmtVal(val)}
                    </div>
                  </div>
                ))}
              </div>

              {s.alerts && s.alerts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.alerts.slice(0, 3).map((a, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${
                        a.level === 'warning'
                          ? 'bg-status-warn/10 text-status-warn'
                          : 'bg-status-danger/10 text-status-danger'
                      }`}
                    >
                      <AlertCircle size={9} /> {a.message}
                    </span>
                  ))}
                </div>
              )}

              {s.cached && (
                <div className="mt-2 flex items-center gap-1 text-[9px] text-os-muted">
                  <Zap size={8} /> cached
                </div>
              )}
              {s.source === 'fallback' && (
                <div className="mt-2 flex items-center gap-1 text-[9px] text-status-warn">
                  <AlertCircle size={8} /> fallback (live upstream failed)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && Object.keys(systems).length === 0 && !err && (
        <div className="px-4 py-6 text-[11px] text-os-muted italic flex items-center gap-2">
          <CheckCircle2 size={12} /> Keine Sub-OS-Daten verfügbar.
        </div>
      )}
    </DataPanel>
  );
}
