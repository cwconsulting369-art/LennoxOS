import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, RefreshCw, TrendingUp, TrendingDown,
  Shield, Zap, BarChart3, Bot, CircleDollarSign,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight, Wifi, WifiOff, Download, RotateCcw,
} from 'lucide-react';

interface LiveData {
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
  unrealized_pnl: number;
  symbol: string;
  today: { total_trades: number; wins: number; losses: number; win_rate: number; total_pnl: number };
  positions: OpenPosition[];
}

interface OpenPosition {
  ticket: number;
  signal_id: string;
  role: string;
  direction: 'BUY' | 'SELL';
  lots: number;
  entry_price: number;
  sl_price: number;
  tp_price: number;
  open_time: string | null;
}

interface Trade {
  ticket: number;
  order: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  entry_type: 'IN' | 'OUT' | 'INOUT';
  lots: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  time: number;
  comment: string;
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

const fmt = (n: number, d = 2) => (n ?? 0).toFixed(d);
const fmtPrice = (n: number) => n ? n.toFixed(2) : '—';
function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
function relTimeUnix(ts: number) {
  const diff = Math.floor((Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function fmtDateTime(ts: number) {
  return new Date(ts * 1000).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Pulse({ active }: { active: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${active ? 'bg-os-green animate-pulse' : 'bg-os-muted'}`} />;
}

function KpiCard({ title, value, sub, icon: Icon, color, flash }: {
  title: string; value: string; sub: string;
  icon: React.ElementType; color: string; flash?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-os-surface p-4 transition-all duration-300 ${flash ? 'border-os-accent/60 shadow-lg shadow-os-accent/10' : 'border-os-border'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={color} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted">{title}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-os-muted">{sub}</p>
    </div>
  );
}

function DirBadge({ dir }: { dir: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${dir === 'BUY' ? 'border-os-green/30 bg-os-green/10 text-os-green' : 'border-os-red/30 bg-os-red/10 text-os-red'}`}>
      {dir === 'BUY' ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}{dir}
    </span>
  );
}

export default function GoldBotDashboard() {
  const [live, setLive] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [flash, setFlash] = useState(false);
  const [tab, setTab] = useState<'history' | 'patterns' | 'daily'>('history');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const prevTradeCount = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch('/api/goldbot/live');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveData = await res.json();
      setLive(data);
      setLastUpdate(new Date());
      setError(null);
      if (!loading) {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlash(true);
        flashTimer.current = setTimeout(() => setFlash(false), 600);
      }
      const newCount = data.today.total_trades;
      if (newCount !== prevTradeCount.current && prevTradeCount.current > 0) {
        loadTab('history', true);
      }
      prevTradeCount.current = newCount;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchLive();
    const iv = setInterval(fetchLive, 5000);
    return () => { clearInterval(iv); if (flashTimer.current) clearTimeout(flashTimer.current); };
  }, []);

  const loadTab = useCallback(async (t: typeof tab, force = false) => {
    if (!force && t === 'history' && trades.length > 0) return;
    if (!force && t === 'patterns' && patterns.length > 0) return;
    if (!force && t === 'daily' && dailyStats.length > 0) return;
    setTabLoading(true);
    try {
      if (t === 'history') {
        const r = await fetch('/api/goldbot/history?limit=50');
        const d = await r.json();
        setTrades(d.trades ?? []);
      } else if (t === 'patterns') {
        const r = await fetch('/api/goldbot/patterns');
        const d = await r.json();
        setPatterns(d.patterns ?? []);
      } else {
        const r = await fetch('/api/goldbot/daily');
        const d = await r.json();
        setDailyStats(d.days ?? []);
      }
    } catch {/* silent */} finally { setTabLoading(false); }
  }, [trades.length, patterns.length, dailyStats.length]);

  useEffect(() => { loadTab(tab); }, [tab]);

  const syncHistory = useCallback(async () => {
    setSyncing(true);
    try {
      await fetch('/api/goldbot/sync-history', { method: 'POST' });
      // Wait 3s for EA to respond + bot to save
      await new Promise(r => setTimeout(r, 3000));
      await loadTab('history', true);
    } catch { /* silent */ } finally { setSyncing(false); }
  }, [loadTab]);

  const pnlColor = (n: number) => n > 0 ? 'text-os-green' : n < 0 ? 'text-os-red' : 'text-os-muted';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-os-yellow" />
          <h1 className="text-lg font-semibold text-os-text">Gold Bot</h1>
          {live && (
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${live.circuit_breaker ? 'border-os-red/30 bg-os-red/10 text-os-red' : live.mt5_connected ? 'border-os-green/30 bg-os-green/10 text-os-green' : 'border-os-yellow/30 bg-os-yellow/10 text-os-yellow'}`}>
              <Pulse active={live.mt5_connected && !live.circuit_breaker} />
              {live.circuit_breaker ? 'Circuit Breaker' : live.mt5_connected ? 'Live' : 'Disconnected'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[10px] text-os-muted flex items-center gap-1">
              <Clock size={10} /> {lastUpdate.toLocaleTimeString('de-DE')}
              <span className="text-os-muted/40"> · 5s poll</span>
            </span>
          )}
          <button onClick={fetchLive} className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-os-surface animate-pulse" />)}
        </div>
      ) : live ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard title="Balance" value={`$${live.account_balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`} sub={live.mt5_login ? `Login #${live.mt5_login}` : live.mt5_broker || live.symbol} icon={CircleDollarSign} color="text-os-yellow" flash={flash} />
            <KpiCard title="Unrealized P&L" value={`${live.unrealized_pnl >= 0 ? '+' : ''}$${fmt(live.unrealized_pnl)}`} sub={`Equity: $${live.account_equity.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`} icon={Activity} color={live.unrealized_pnl > 0 ? 'text-os-green' : live.unrealized_pnl < 0 ? 'text-os-red' : 'text-os-muted'} flash={flash && live.open_positions > 0} />
            <KpiCard title="Today P&L" value={`${live.today.total_pnl >= 0 ? '+' : ''}$${fmt(live.today.total_pnl)}`} sub={`${live.today.wins}W / ${live.today.losses}L — ${fmt(live.today.win_rate, 0)}% WR`} icon={TrendingUp} color={live.today.total_pnl >= 0 ? 'text-os-green' : 'text-os-red'} />
            <KpiCard title="Risk" value={live.circuit_breaker ? 'HALTED' : live.consecutive_losses > 0 ? `${live.consecutive_losses} Losses` : 'Clear'} sub={`${live.open_positions} open · ${live.symbol}`} icon={Shield} color={live.circuit_breaker ? 'text-os-red' : live.consecutive_losses >= 2 ? 'text-os-yellow' : 'text-os-green'} />
          </div>

          {/* Disconnect banner */}
          {!live.mt5_connected && (
            <div className="rounded-xl border border-os-yellow/30 bg-os-yellow/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-os-yellow flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-os-yellow mb-1">MT5 EA nicht verbunden</p>
                  <p className="text-xs text-os-muted mb-2">
                    <strong className="text-os-text">mt5_http_bridge.mq5</strong> in <code className="text-os-cyan">MQL5/Experts/</code> → F7 kompilieren → Tools → Optionen → WebRequest für <code className="text-os-cyan">http://204.168.142.89:8001</code> → EA auf XAUUSD M1 Chart.
                  </p>
                  <a href="/mt5_http_bridge.mq5" download className="inline-flex items-center gap-1.5 rounded-lg border border-os-yellow/30 bg-os-yellow/10 px-3 py-1.5 text-xs font-medium text-os-yellow hover:bg-os-yellow/20 transition-colors">
                    <Download size={12} /> mt5_http_bridge.mq5
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Open Positions */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-os-text">Open Positions</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${live.open_positions > 0 ? 'bg-os-green/10 text-os-green' : 'bg-os-border/60 text-os-muted'}`}>{live.open_positions}</span>
              </div>
              {live.unrealized_pnl !== 0 && (
                <span className={`text-sm font-bold ${pnlColor(live.unrealized_pnl)}`}>{live.unrealized_pnl >= 0 ? '+' : ''}${fmt(live.unrealized_pnl)} unrealized</span>
              )}
            </div>
            {live.positions.length > 0 ? (
              <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 border-b border-os-border px-4 py-2 bg-os-elevated text-[10px] font-bold uppercase tracking-wider text-os-muted">
                  <span>Dir</span><span>Ticket</span><span>Lots</span><span>Entry</span><span>SL / TP</span><span>Time</span>
                </div>
                {live.positions.map((p) => (
                  <div key={p.ticket} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 items-center border-b border-os-border/50 px-4 py-3 last:border-0 hover:bg-os-elevated/50 transition-colors">
                    <DirBadge dir={p.direction} />
                    <div>
                      <p className="text-xs font-medium text-os-text">#{p.ticket}</p>
                      <p className="text-[10px] text-os-muted">{p.role}</p>
                    </div>
                    <span className="text-xs text-os-muted">{p.lots}</span>
                    <span className="text-xs font-medium text-os-text">{fmtPrice(p.entry_price)}</span>
                    <div className="text-[10px]">
                      <p className="text-os-red">SL {fmtPrice(p.sl_price)}</p>
                      <p className="text-os-green">TP {fmtPrice(p.tp_price)}</p>
                    </div>
                    <span className="text-[10px] text-os-muted">{p.open_time ? relTime(p.open_time) : '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 px-4 py-6 text-center">
                <Bot size={20} className="mx-auto mb-2 text-os-muted" />
                <p className="text-sm text-os-muted">{live.mt5_connected ? 'Keine offenen Positionen' : 'Warte auf MT5…'}</p>
              </div>
            )}
          </div>

          {/* Status row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3 flex items-center gap-2">
                {live.mt5_connected ? <Wifi size={11} className="text-os-green" /> : <WifiOff size={11} className="text-os-red" />} Connection
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Bot Server', ok: live.connected },
                  { label: 'MT5 Terminal', ok: live.mt5_connected },
                  { label: 'Circuit Breaker', ok: !live.circuit_breaker },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-os-muted">{label}</span>
                    <div className="flex items-center gap-1">
                      {ok ? <CheckCircle2 size={12} className="text-os-green" /> : <XCircle size={12} className="text-os-red" />}
                      <span className={`text-[11px] font-medium ${ok ? 'text-os-green' : 'text-os-red'}`}>{ok ? 'OK' : 'ALERT'}</span>
                    </div>
                  </div>
                ))}
                {live.mt5_login ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-os-muted">Login</span>
                    <span className="text-[11px] font-bold text-os-cyan">#{live.mt5_login}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3 flex items-center gap-2"><BarChart3 size={11} /> Today</p>
              <div className="space-y-2">
                {[
                  { label: 'Trades', val: String(live.today.total_trades), color: 'text-os-text' },
                  { label: 'Win Rate', val: `${fmt(live.today.win_rate, 0)}%`, color: live.today.win_rate >= 60 ? 'text-os-green' : live.today.win_rate >= 45 ? 'text-os-yellow' : 'text-os-red' },
                  { label: 'P&L', val: `${live.today.total_pnl >= 0 ? '+' : ''}$${fmt(live.today.total_pnl)}`, color: pnlColor(live.today.total_pnl) },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-os-muted">{label}</span>
                    <span className={`text-[11px] font-bold ${color}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-os-border bg-os-surface p-4">
              <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3 flex items-center gap-2"><Shield size={11} /> Risk</p>
              <div className="space-y-2">
                {[
                  { label: 'Symbol', val: live.symbol, color: 'text-os-text' },
                  { label: 'Cons. Losses', val: String(live.consecutive_losses), color: live.consecutive_losses >= 2 ? 'text-os-yellow' : 'text-os-text' },
                  { label: 'Circuit', val: live.circuit_breaker ? 'ACTIVE' : 'OFF', color: live.circuit_breaker ? 'text-os-red' : 'text-os-green' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-os-muted">{label}</span>
                    <span className={`text-[11px] font-bold ${color}`}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div>
            <div className="flex gap-1 mb-4">
              {(['history', 'patterns', 'daily'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? 'bg-os-accent text-white' : 'text-os-muted hover:text-os-text hover:bg-os-surface'}`}>
                  {t === 'history' ? `History${trades.length > 0 ? ` (${trades.length})` : ''}` : t === 'patterns' ? 'Patterns' : 'Daily Stats'}
                </button>
              ))}
              {tabLoading && <RefreshCw size={12} className="ml-2 animate-spin text-os-muted self-center" />}
              {tab === 'history' && (
                <button onClick={syncHistory} disabled={syncing}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:border-os-accent/50 transition-colors disabled:opacity-50">
                  <RotateCcw size={11} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing…' : 'Sync MT5'}
                </button>
              )}
            </div>

            {tab === 'history' && (trades.length === 0 ? (
              <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-8 text-center">
                <TrendingUp size={24} className="mx-auto mb-3 text-os-muted" />
                <p className="text-sm font-medium text-os-text mb-1">Keine Trade-History</p>
                <p className="text-xs text-os-muted mb-4">Klicke "Sync MT5" um Trades aus MT5 zu laden</p>
                <button onClick={syncHistory} disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-os-accent/40 bg-os-accent/10 px-4 py-2 text-xs font-medium text-os-accent hover:bg-os-accent/20 transition-colors disabled:opacity-50">
                  <RotateCcw size={12} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Wird geladen…' : 'Sync von MT5'}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
                <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 border-b border-os-border px-4 py-2 bg-os-elevated text-[10px] font-bold uppercase tracking-wider text-os-muted">
                  <span>Dir</span><span>Typ</span><span>Zeit</span><span>Lots</span><span>Preis</span><span>P&L</span>
                </div>
                {trades.map((t) => {
                  const netPnl = (t.profit || 0) + (t.commission || 0) + (t.swap || 0);
                  return (
                    <div key={t.ticket} className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center border-b border-os-border/50 px-4 py-3 last:border-0 hover:bg-os-elevated/50 transition-colors">
                      <DirBadge dir={t.direction} />
                      <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border ${
                        t.entry_type === 'IN' ? 'bg-os-green/10 text-os-green border-os-green/20' :
                        t.entry_type === 'OUT' ? 'bg-os-border/40 text-os-muted border-os-border' :
                        'bg-os-yellow/10 text-os-yellow border-os-yellow/20'
                      }`}>{t.entry_type}</span>
                      <div>
                        <p className="text-xs font-medium text-os-text">#{t.ticket}</p>
                        <p className="text-[10px] text-os-muted">{fmtDateTime(t.time)} · {relTimeUnix(t.time)}</p>
                      </div>
                      <span className="text-xs text-os-muted">{t.lots}</span>
                      <span className="text-xs text-os-text">{t.price?.toFixed(2) ?? '—'}</span>
                      <div className="text-right">
                        <span className={`text-xs font-semibold ${pnlColor(netPnl)}`}>
                          {netPnl >= 0 ? '+' : ''}${netPnl.toFixed(2)}
                        </span>
                        {(t.commission !== 0 || t.swap !== 0) && (
                          <p className="text-[10px] text-os-muted">comm {t.commission?.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {tab === 'patterns' && (patterns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-8 text-center">
                <BarChart3 size={24} className="mx-auto mb-2 text-os-muted" />
                <p className="text-sm text-os-muted">Noch keine Pattern-Daten</p>
              </div>
            ) : (
              <div className="space-y-2">
                {patterns.map((p, i) => (
                  <div key={i} className="rounded-xl border border-os-border bg-os-surface p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-medium text-os-text">{p.pattern_value}</span>
                        <span className="ml-2 text-[10px] text-os-muted">{p.pattern_type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-os-muted">{p.total_signals} signals</span>
                        <span className={`text-xs font-bold ${p.win_rate >= 60 ? 'text-os-green' : p.win_rate >= 45 ? 'text-os-yellow' : 'text-os-red'}`}>{fmt(p.win_rate, 0)}% WR</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-os-border">
                      <div className={`h-1.5 rounded-full ${p.win_rate >= 60 ? 'bg-os-green' : p.win_rate >= 45 ? 'bg-os-yellow' : 'bg-os-red'}`} style={{ width: `${p.win_rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {tab === 'daily' && (dailyStats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-8 text-center">
                <TrendingDown size={24} className="mx-auto mb-2 text-os-muted" />
                <p className="text-sm text-os-muted">Noch keine Daily-Daten</p>
              </div>
            ) : (
              <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
                <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto] gap-3 border-b border-os-border px-4 py-2 bg-os-elevated text-[10px] font-bold uppercase tracking-wider text-os-muted">
                  <span>Date</span><span>Trades</span><span>W/L</span><span>WR%</span><span>P&L</span><span>CB</span>
                </div>
                {dailyStats.map((d) => (
                  <div key={d.date} className="grid grid-cols-[auto_auto_auto_auto_auto_auto] gap-3 items-center border-b border-os-border/50 px-4 py-3 last:border-0 hover:bg-os-elevated/50 transition-colors">
                    <span className="text-xs text-os-text">{d.date}</span>
                    <span className="text-xs text-os-muted">{d.total_trades}</span>
                    <span className="text-xs text-os-muted">{d.wins}/{d.losses}</span>
                    <span className={`text-xs font-medium ${d.win_rate >= 60 ? 'text-os-green' : 'text-os-yellow'}`}>{fmt(d.win_rate, 0)}%</span>
                    <span className={`text-xs font-bold ${pnlColor(d.total_pnl)}`}>{d.total_pnl >= 0 ? '+' : ''}${fmt(d.total_pnl)}</span>
                    <span>{d.circuit_breaker ? <XCircle size={12} className="text-os-red" /> : <CheckCircle2 size={12} className="text-os-green" />}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
          <Bot size={24} className="mx-auto mb-2 text-os-muted" />
          <p className="text-sm text-os-muted">Gold Bot nicht erreichbar</p>
        </div>
      )}
    </div>
  );
}
