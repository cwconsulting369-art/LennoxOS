import { useState, useEffect, useCallback } from 'react';
import {
  Activity, RefreshCw, TrendingUp, TrendingDown,
  Shield, Zap, BarChart3, Bot, CircleDollarSign,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────── */
interface BotStatus {
  connected: boolean;
  mt5_connected: boolean;
  mt5_stale?: boolean;
  mt5_login?: number;
  mt5_broker?: string;
  circuit_breaker: boolean;
  consecutive_losses: number;
  account_balance: number;
  account_equity: number;
  open_positions: number;
  symbol: string;
  today: { total_trades: number; wins: number; losses: number; win_rate: number; total_pnl: number };
}

interface Trade {
  id: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp1: number;
  tp2?: number;
  status: string;
  lots: number;
  pnl_pips?: number;
  pnl_currency?: number;
  open_time: string;
  close_time?: string;
  day_of_week?: string;
  session?: string;
}

interface Pattern {
  pattern_type: string;
  pattern_value: string;
  total_signals: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_pnl_pips: number;
}

interface DayStats {
  date: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  circuit_breaker: boolean;
}

/* ─── Helpers ─────────────────────────────────────────────────── */
function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(s: string) {
  if (s?.includes('tp')) return 'text-os-green';
  if (s?.includes('sl')) return 'text-os-red';
  if (s === 'open' || s === 'active') return 'text-os-cyan';
  return 'text-os-muted';
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    open: 'Open', active: 'Active',
    closed_tp1: 'TP1 ✓', closed_tp2: 'TP2 ✓', closed_tp3: 'TP3 ✓',
    closed_sl: 'SL ✗', closed_manual: 'Manual', cancelled: 'Cancelled',
  };
  return map[s] || s;
}

function KpiCard({ title, value, sub, icon: Icon, color = 'text-os-cyan' }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center gap-2 text-os-muted">
        <Icon size={13} />
        <span className="text-[10px] uppercase tracking-wider">{title}</span>
      </div>
      <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-os-muted">{sub}</p>}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function GoldBotDashboard() {
  const [tab, setTab] = useState<'overview' | 'history' | 'patterns' | 'daily'>('overview');
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [daily, setDaily] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [spin, setSpin] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/goldbot/status');
      if (r.ok) setStatus(await r.json());
    } catch {}
  }, []);

  const loadTab = useCallback(async (t: typeof tab) => {
    try {
      if (t === 'history' && trades.length === 0) {
        const r = await fetch('/api/goldbot/history?limit=50');
        if (r.ok) { const d = await r.json(); setTrades(d.trades || []); }
      }
      if (t === 'patterns' && patterns.length === 0) {
        const r = await fetch('/api/goldbot/patterns');
        if (r.ok) { const d = await r.json(); setPatterns(d.patterns || []); }
      }
      if (t === 'daily' && daily.length === 0) {
        const r = await fetch('/api/goldbot/daily');
        if (r.ok) { const d = await r.json(); setDaily(d.days || []); }
      }
    } catch {}
  }, [trades.length, patterns.length, daily.length]);

  const refresh = useCallback(async () => {
    setSpin(true);
    setTrades([]); setPatterns([]); setDaily([]);
    await loadStatus();
    await loadTab(tab);
    setLastUpdate(new Date());
    setSpin(false);
    setLoading(false);
  }, [loadStatus, loadTab, tab]);

  useEffect(() => {
    loadStatus().then(() => { setLoading(false); setLastUpdate(new Date()); });
    const iv = setInterval(loadStatus, 30000);
    return () => clearInterval(iv);
  }, [loadStatus]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const pnlColor = (n: number) => n > 0 ? 'text-os-green' : n < 0 ? 'text-os-red' : 'text-os-muted';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-os-yellow" />
          <h1 className="text-lg font-semibold text-os-text">Gold Bot</h1>
          {status && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
              status.circuit_breaker
                ? 'border-os-red/30 bg-os-red/10 text-os-red'
                : status.mt5_connected
                ? 'border-os-green/30 bg-os-green/10 text-os-green'
                : 'border-os-yellow/30 bg-os-yellow/10 text-os-yellow'
            }`}>
              {status.circuit_breaker ? 'Circuit Breaker' : status.mt5_connected ? 'MT5 Live' : 'Disconnected'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[10px] text-os-muted flex items-center gap-1">
              <Clock size={10} /> {relTime(lastUpdate.toISOString())}
            </span>
          )}
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors"
          >
            <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-os-surface animate-pulse" />)}
        </div>
      ) : status ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard
              title="Account Balance"
              value={`$${status.account_balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
              sub={`Equity: $${status.account_equity.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`}
              icon={CircleDollarSign}
              color="text-os-yellow"
            />
            <KpiCard
              title="Today P&L"
              value={`${status.today.total_pnl >= 0 ? '+' : ''}$${fmt(status.today.total_pnl)}`}
              sub={`${status.today.wins}W / ${status.today.losses}L — ${fmt(status.today.win_rate, 0)}% WR`}
              icon={TrendingUp}
              color={status.today.total_pnl >= 0 ? 'text-os-green' : 'text-os-red'}
            />
            <KpiCard
              title="Open Positions"
              value={String(status.open_positions)}
              sub={`Symbol: ${status.symbol}`}
              icon={Activity}
              color="text-os-cyan"
            />
            <KpiCard
              title="Risk Status"
              value={status.circuit_breaker ? 'CIRCUIT BREAKER' : status.consecutive_losses > 0 ? `${status.consecutive_losses} Losses` : 'OK'}
              sub={status.circuit_breaker ? 'Trading paused today' : 'No circuit breaker'}
              icon={Shield}
              color={status.circuit_breaker ? 'text-os-red' : status.consecutive_losses >= 2 ? 'text-os-yellow' : 'text-os-green'}
            />
          </div>


          {/* MT5 disconnected banner */}
          {!status.mt5_connected && (
            <div className="rounded-xl border border-os-yellow/30 bg-os-yellow/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-os-yellow flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-os-yellow mb-1">MT5 EA nicht verbunden</p>
                  <p className="text-xs text-os-muted mb-3">
                    Installiere <strong className="text-os-text">mt5_http_bridge.mq5</strong> in MT5:
                  </p>
                  <ol className="text-xs text-os-muted space-y-1 list-decimal list-inside mb-3">
                    <li>MT5 → Datei → Datenordner → <code className="text-os-cyan">MQL5/Experts/</code></li>
                    <li>EA kopieren, kompilieren (F7)</li>
                    <li>Tools → Optionen → Expert Advisors → WebRequest für <code className="text-os-cyan">http://204.168.142.89:8001</code> erlauben</li>
                    <li>EA auf XAUUSD M1 ziehen → AutoTrading an</li>
                  </ol>
                  <a href="/mt5_http_bridge.mq5" download
                     className="inline-flex items-center gap-1.5 rounded-lg border border-os-yellow/30 bg-os-yellow/10 px-3 py-1.5 text-xs font-medium text-os-yellow hover:bg-os-yellow/20 transition-colors">
                    ↓ mt5_http_bridge.mq5 herunterladen
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Status Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3">Connection Status</p>
              <div className="space-y-2">
                {[
                  { label: 'Bot', ok: status.connected },
                  { label: 'MT5 Terminal', ok: status.mt5_connected },
                  ...(status.mt5_login ? [{ label: `Login #${status.mt5_login}`, ok: true }] : []),
                  { label: 'Circuit Breaker', ok: !status.circuit_breaker, invertColor: true },
                ].map(({ label, ok, invertColor }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-os-muted">{label}</span>
                    <div className="flex items-center gap-1.5">
                      {ok
                        ? <CheckCircle2 size={13} className={invertColor ? 'text-os-green' : 'text-os-green'} />
                        : <XCircle size={13} className="text-os-red" />
                      }
                      <span className={`text-[11px] font-medium ${ok ? 'text-os-green' : 'text-os-red'}`}>
                        {ok ? 'OK' : 'ALERT'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3">Today's Trades</p>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-2xl font-bold text-os-text">{status.today.total_trades}</p>
                  <p className="text-[10px] text-os-muted">total signals</p>
                </div>
                <div className="flex gap-4 pb-1">
                  <div className="flex items-center gap-1">
                    <ArrowUpRight size={13} className="text-os-green" />
                    <span className="text-sm font-bold text-os-green">{status.today.wins}</span>
                    <span className="text-[10px] text-os-muted">wins</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDownRight size={13} className="text-os-red" />
                    <span className="text-sm font-bold text-os-red">{status.today.losses}</span>
                    <span className="text-[10px] text-os-muted">losses</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-os-border">
                <div
                  className="h-full bg-os-green rounded-full transition-all"
                  style={{ width: `${status.today.win_rate}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-os-muted">{fmt(status.today.win_rate, 0)}% Win Rate</p>
            </div>

            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3">Risk Metrics</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-os-muted">Consecutive Losses</span>
                  <span className={`text-xs font-bold ${status.consecutive_losses >= 2 ? 'text-os-red' : 'text-os-green'}`}>
                    {status.consecutive_losses} / 3
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-os-muted">Circuit Breaker</span>
                  <span className={`text-xs font-bold ${status.circuit_breaker ? 'text-os-red' : 'text-os-green'}`}>
                    {status.circuit_breaker ? 'ACTIVE' : 'Clear'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-os-muted">Open Positions</span>
                  <span className="text-xs font-bold text-os-text">{status.open_positions}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-os-red/20 bg-os-red/5 p-6 text-center">
          <AlertTriangle size={20} className="text-os-red mx-auto mb-2" />
          <p className="text-sm text-os-text">Gold Bot nicht erreichbar</p>
          <p className="text-[11px] text-os-muted mt-1">Port 8001 — prüfe pm2 status</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-os-border bg-os-surface p-1 w-fit">
        {(['history', 'patterns', 'daily'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-os-bg text-os-cyan' : 'text-os-muted hover:text-os-text'
            }`}
          >
            {t === 'history' ? <BarChart3 size={12} /> : t === 'patterns' ? <Bot size={12} /> : <Activity size={12} />}
            {t === 'history' ? 'Trade History' : t === 'patterns' ? 'Patterns' : 'Daily Stats'}
          </button>
        ))}
      </div>

      {/* Trade History */}
      {tab === 'history' && (
        <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-os-border">
                {['ID', 'Dir', 'Entry', 'SL', 'TP1', 'Lots', 'Status', 'P&L Pips', 'P&L $', 'Time'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-os-muted font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-os-muted text-sm">
                    Noch keine Trades — Bot wartet auf Signale
                  </td>
                </tr>
              ) : trades.map(t => (
                <tr key={t.id} className="border-t border-os-border hover:bg-os-bg/50 transition-colors">
                  <td className="px-3 py-2 font-mono text-[10px] text-os-muted">{t.id.slice(-8)}</td>
                  <td className="px-3 py-2">
                    <span className={`flex items-center gap-1 font-bold text-[11px] ${t.direction === 'BUY' ? 'text-os-green' : 'text-os-red'}`}>
                      {t.direction === 'BUY' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {t.direction}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-os-text">{fmt(t.entry)}</td>
                  <td className="px-3 py-2 font-mono text-os-red">{fmt(t.sl)}</td>
                  <td className="px-3 py-2 font-mono text-os-green">{fmt(t.tp1)}</td>
                  <td className="px-3 py-2 text-os-muted">{t.lots}</td>
                  <td className="px-3 py-2">
                    <span className={`font-medium ${statusColor(t.status)}`}>{statusLabel(t.status)}</span>
                  </td>
                  <td className={`px-3 py-2 font-mono font-bold ${pnlColor(t.pnl_pips ?? 0)}`}>
                    {t.pnl_pips != null ? `${t.pnl_pips > 0 ? '+' : ''}${fmt(t.pnl_pips, 0)}` : '—'}
                  </td>
                  <td className={`px-3 py-2 font-mono font-bold ${pnlColor(t.pnl_currency ?? 0)}`}>
                    {t.pnl_currency != null ? `${t.pnl_currency > 0 ? '+' : ''}$${fmt(t.pnl_currency)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-os-muted text-[10px]">
                    {t.open_time ? relTime(t.open_time) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Patterns */}
      {tab === 'patterns' && (
        <div className="space-y-3">
          {patterns.length === 0 ? (
            <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
              <Bot size={24} className="text-os-muted mx-auto mb-2" />
              <p className="text-sm text-os-muted">Noch keine Pattern-Daten</p>
              <p className="text-[11px] text-os-muted mt-1">Wird nach ersten Trades gefüllt</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(['direction', 'day', 'session'] as const).map(pType => {
                const group = patterns.filter(p => p.pattern_type === pType);
                if (!group.length) return null;
                return (
                  <div key={pType} className="rounded-xl border border-os-border bg-os-surface p-4">
                    <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3 capitalize">{pType}</p>
                    <div className="space-y-2">
                      {group.map(p => (
                        <div key={p.pattern_value} className="flex items-center gap-3">
                          <span className="text-xs text-os-text w-20 font-medium capitalize">{p.pattern_value}</span>
                          <div className="flex-1 h-1.5 bg-os-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${p.win_rate >= 65 ? 'bg-os-green' : p.win_rate >= 50 ? 'bg-os-yellow' : 'bg-os-red'}`}
                              style={{ width: `${p.win_rate}%` }}
                            />
                          </div>
                          <span className={`text-[11px] font-bold w-10 text-right ${p.win_rate >= 65 ? 'text-os-green' : p.win_rate >= 50 ? 'text-os-yellow' : 'text-os-red'}`}>
                            {fmt(p.win_rate, 0)}%
                          </span>
                          <span className="text-[10px] text-os-muted w-8">{p.total_signals}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Daily Stats */}
      {tab === 'daily' && (
        <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-os-border">
                {['Datum', 'Trades', 'W/L', 'Win Rate', 'P&L', 'Circuit Breaker'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-os-muted font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-os-muted text-sm">
                    Noch keine Daily-Daten
                  </td>
                </tr>
              ) : daily.map(d => (
                <tr key={d.date} className="border-t border-os-border hover:bg-os-bg/50 transition-colors">
                  <td className="px-3 py-2 font-medium text-os-text">{new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                  <td className="px-3 py-2 text-os-muted">{d.total_trades}</td>
                  <td className="px-3 py-2">
                    <span className="text-os-green">{d.wins}W</span>
                    <span className="text-os-muted"> / </span>
                    <span className="text-os-red">{d.losses}L</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-bold ${d.win_rate >= 60 ? 'text-os-green' : d.win_rate >= 50 ? 'text-os-yellow' : 'text-os-red'}`}>
                      {fmt(d.win_rate, 0)}%
                    </span>
                  </td>
                  <td className={`px-3 py-2 font-bold font-mono ${pnlColor(d.total_pnl)}`}>
                    {d.total_pnl >= 0 ? '+' : ''}${fmt(d.total_pnl)}
                  </td>
                  <td className="px-3 py-2">
                    {d.circuit_breaker
                      ? <span className="text-os-red flex items-center gap-1"><XCircle size={11} /> Active</span>
                      : <span className="text-os-green flex items-center gap-1"><CheckCircle2 size={11} /> Clear</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
