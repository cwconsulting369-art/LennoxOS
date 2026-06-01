import { useEffect, useState, useCallback } from 'react';
import { Moon, RefreshCw, TrendingDown, TrendingUp, Minus, ShieldCheck, AlertTriangle } from 'lucide-react';
import { MarkdownViewer } from '../components/MarkdownViewer';

/* ============================================================
 * Nacht-Optimierung — Cluster 5 (Dashboard-Contract / AEVUM Pin 4)
 * Zeigt den neuesten nightly-improve-Report: Metriken, Delta
 * (besser/schlechter als gestern), Befunde, autonome Fixes.
 * Quelle: GET /api/nightly-improve/status
 * ============================================================ */

interface NightlyStatus {
  date: string | null;
  report_md: string | null;
  baseline: { date: string; metrics: Record<string, number> } | null;
  config: { config_schema?: Array<{ key: string; default?: string[] }> } | null;
  history: string[];
  module_dir: string;
}

// Metriken bei denen ↓ = besser (Health/Findings/Gaps)
const LOWER_IS_BETTER = /pct|down|restart|mb|findings|impaired|gaps|stale|age_h/;

function MetricCard({ k, v, prev }: { k: string; v: number; prev?: number }) {
  const lowerBetter = LOWER_IS_BETTER.test(k);
  let dir: 'better' | 'worse' | 'same' = 'same';
  if (typeof prev === 'number' && prev !== v) {
    const down = v < prev;
    dir = (down === lowerBetter) ? 'better' : 'worse';
  }
  const Icon = dir === 'better' ? TrendingDown : dir === 'worse' ? TrendingUp : Minus;
  const color = dir === 'better' ? 'var(--status-success)' : dir === 'worse' ? 'var(--status-danger)' : 'var(--text-faint)';
  return (
    <div className="lx-stat" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <span className="lx-stat__label">{k.replace(/_/g, ' ')}</span>
      <div className="flex items-baseline gap-2">
        <span className="lx-stat__value">{v}</span>
        {typeof prev === 'number' && prev !== v && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color }}>
            <Icon size={11} /> {prev}→{v}
          </span>
        )}
      </div>
    </div>
  );
}

export default function NightlyImprove() {
  const [data, setData] = useState<NightlyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/nightly-improve/status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setErr(e instanceof Error ? e.message : 'Fehler'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const metrics = data?.baseline?.metrics || {};
  // "prev" haben wir nicht als zweite Reihe persistiert → Delta steht im Report; Cards zeigen aktuellen Wert.
  const fixMode = data?.config?.config_schema?.find(c => c.key === 'fix_mode')?.default?.[0] || '—';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 lg:px-11 py-4 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center" style={{ boxShadow: 'var(--shadow-accent)' }}>
            <Moon size={16} className="text-white" />
          </div>
          <div>
            <div className="lx-section-title mb-1">LennoxOS · Cluster 5</div>
            <h1 className="lx-headline text-lg">
              Nacht-Optimierung
              {data?.date && <span className="ml-3 lx-pill lx-pill--accent">{data.date}</span>}
              <span className="ml-2 lx-pill text-[9px]">fix: {fixMode}</span>
            </h1>
          </div>
        </div>
        <button onClick={fetchStatus} className="lx-btn"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {err && <div className="lx-pill lx-pill--err">Status nicht ladbar: {err}</div>}
        {loading && !data && <div className="lx-empty"><div className="lx-empty__glow"><RefreshCw size={18} className="animate-spin" /></div><p className="text-[12px]">Lade…</p></div>}

        {data && !data.date && (
          <div className="lx-empty"><div className="lx-empty__glow"><Moon size={20} /></div>
            <p className="text-[12px]">Noch kein Nacht-Lauf. Cron 02:00 — oder manuell: <code>node {data.module_dir}/index.js</code></p>
          </div>
        )}

        {data?.date && (
          <>
            {/* Erklärung */}
            <div className="lx-quote-card">
              <div>
                <div className="lx-quote-card__text" style={{ fontSize: 15 }}>„Über Nacht besser als am Abend davor."</div>
                <div className="lx-quote-card__author">Cron-Batch 02:00 · misst System-Health · Knowledge · Projekt-Progress · Cash · deterministisch (Tier 1-3) + LLM nur bei echtem Befund</div>
              </div>
            </div>

            {/* Metriken */}
            <div>
              <div className="lx-section-title mb-3">Metriken — Baseline {data.baseline?.date}</div>
              <div className="lx-stat-strip" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                {Object.entries(metrics).map(([k, v]) => <MetricCard key={k} k={k} v={v as number} />)}
              </div>
            </div>

            {/* Voller Report (Delta/Befunde/Fixes/Urteil) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={13} style={{ color: 'var(--accent)' }} />
                <span className="lx-section-title">Report</span>
                {data.history.length > 1 && (
                  <span className="ml-auto text-[10px] text-[var(--text-faint)]">{data.history.length} Tage Historie</span>
                )}
              </div>
              <div className="rounded-xl px-5 py-4" style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', fontSize: 13.5 }}>
                <MarkdownViewer content={data.report_md || ''} />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)] uppercase tracking-wider">
              <AlertTriangle size={11} /> Memory-Fixes = no-auto-fix · Code-Fixes backup-first · Irreversibles → Approval
            </div>
          </>
        )}
      </div>
    </div>
  );
}
