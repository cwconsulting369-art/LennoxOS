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

interface Metrics {
  total_trades: number;
  total_pnl: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  win_rate: number;
  wins: number;
  losses: number;
  avg_win: number;
  avg_loss: number;
  best_trade: number;
  worst_trade: number;
  expectancy: number;
  avg_rr: number;
  max_drawdown_pct: number;
  today_pnl: number;
  today_trades: number;
  week_pnl: number;
  week_trades: number;
  month_pnl: number;
  month_trades: number;
}

interface MultiBotEntry {
  id: string;
  profile: string;
  port: number;
  live: LiveData | { error: string };
  daily: { days?: DayStats[] } | { error: string };
}

type BotId = 'ALL' | 'B1' | 'B2' | 'B3' | 'B4';

interface Mt5Status { B1: boolean; B2: boolean; B3: boolean; B4: boolean; }

const PROFILE_CFG: Record<string, { label: string; color: string; dot: string }> = {
  B1: { label: 'CONSERVATIVE', color: 'text-os-cyan',   dot: 'bg-os-cyan' },
  B2: { label: 'AGGRESSIVE',   color: 'text-os-red',    dot: 'bg-os-red' },
  B3: { label: 'SWING',        color: 'text-os-yellow', dot: 'bg-os-yellow' },
  B4: { label: 'SCALP',        color: 'text-os-green',  dot: 'bg-os-green' },
};

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

function MiniSparkline({ data, height = 80 }: { data: DayStats[]; height?: number }) {
  if (data.length < 2) return null;
  const pnls = data.map(d => d.total_pnl);
  const min = Math.min(...pnls, 0);
  const max = Math.max(...pnls, 0);
  const range = max - min || 1;
  const w = 300;
  const h = height;
  const pts = pnls.map((p, i) => {
    const x = (i / (pnls.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  const lastPnl = pnls[pnls.length - 1];
  const color = lastPnl >= 0 ? '#22c55e' : '#ef4444';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="0" y1={h - ((0 - min) / range) * h} x2={w} y2={h - ((0 - min) / range) * h}
        stroke="#ffffff10" strokeWidth="1" strokeDasharray="3,3" />
    </svg>
  );
}

export default function GoldBotDashboard() {
  const [selectedBot, setSelectedBot] = useState<BotId>('B1');
  const [live, setLive] = useState<LiveData | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [flash, setFlash] = useState(false);
  const [tab, setTab] = useState<'history' | 'patterns' | 'daily' | 'roadmap'>('history');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [multiBots, setMultiBots] = useState<MultiBotEntry[]>([]);
  const [mt5Status, setMt5Status] = useState<Mt5Status | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [tradingEnabled, setTradingEnabled] = useState<boolean>(true);
  const prevTradeCount = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBot = useRef<BotId>('B1');

  const apiBase = (bot: BotId) =>
    bot === 'ALL' ? '/api/goldbot-multi' : `/api/goldbot-multi/${bot}`;

  const fetchMultiBots = useCallback(async () => {
    try {
      const r = await fetch('/api/goldbot-multi/all');
      if (r.ok) {
        const d = await r.json();
        setMultiBots(d.bots ?? []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchMt5Status = useCallback(async () => {
    try {
      const r = await fetch('http://localhost:8090/status', { signal: AbortSignal.timeout(2000) });
      if (r.ok) setMt5Status((await r.json()).bots ?? null);
    } catch { setMt5Status(null); }
  }, []);

  const launchMt5 = useCallback(async (botId: string) => {
    setLaunching(botId);
    try {
      const r = await fetch(`http://localhost:8090/start/${botId}`, { method: 'POST', signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      if (d.ok) {
        setTimeout(fetchMt5Status, 3000);
      }
    } catch { /* launcher not running */ } finally { setLaunching(null); }
  }, [fetchMt5Status]);

  const toggleTrading = useCallback(async (botId: string, enable: boolean) => {
    setActivating(botId);
    try {
      const endpoint = enable ? 'activate' : 'deactivate';
      await fetch(`/api/goldbot-multi/${botId}/${endpoint}`, { method: 'POST' });
      if (botId === selectedBot) setTradingEnabled(enable);
      fetchMultiBots();
    } catch { /* silent */ } finally { setActivating(null); }
  }, [selectedBot, fetchMultiBots]);

  const fetchMetrics = useCallback(async (bot: BotId) => {
    if (bot === 'ALL') return;
    try {
      const r = await fetch(`/api/goldbot-multi/${bot}/metrics`);
      if (r.ok) setMetrics(await r.json());
    } catch { /* silent */ }
  }, []);

  const fetchLive = useCallback(async (bot?: BotId) => {
    const b = bot ?? selectedBot;
    if (b === 'ALL') { await fetchMultiBots(); setLoading(false); return; }
    try {
      const res = await fetch(`/api/goldbot-multi/${b}/live`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveData = await res.json();
      setLive(data);
      if (typeof (data as any).trading_enabled === 'boolean') setTradingEnabled((data as any).trading_enabled);
      setLastUpdate(new Date());
      setError(null);
      if (!loading) {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlash(true);
        flashTimer.current = setTimeout(() => setFlash(false), 600);
      }
      const newCount = data.today.total_trades;
      if (newCount !== prevTradeCount.current && prevTradeCount.current > 0) {
        loadTab('history', true, b);
      }
      prevTradeCount.current = newCount;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [selectedBot, loading]);

  useEffect(() => {
    if (prevBot.current !== selectedBot) {
      prevBot.current = selectedBot;
      setLive(null);
      setMetrics(null);
      setTrades([]);
      setPatterns([]);
      setDailyStats([]);
      setLoading(true);
      prevTradeCount.current = 0;
    }
    fetchLive(selectedBot);
    if (selectedBot !== 'ALL') fetchMetrics(selectedBot);
    else fetchMultiBots();
  }, [selectedBot]);

  useEffect(() => {
    fetchLive(selectedBot);
    if (selectedBot !== 'ALL') fetchMetrics(selectedBot);
    else fetchMultiBots();
    fetchMt5Status();
    const mt5iv = setInterval(fetchMt5Status, 10000);
    const iv = setInterval(() => fetchLive(selectedBot), 5000);
    const miv = setInterval(() => {
      if (selectedBot !== 'ALL') fetchMetrics(selectedBot);
      else fetchMultiBots();
    }, 30000);
    return () => {
      clearInterval(iv); clearInterval(miv); clearInterval(mt5iv);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  const loadTab = useCallback(async (t: typeof tab, force = false, bot?: BotId) => {
    const b = bot ?? selectedBot;
    if (b === 'ALL') return;
    if (!force && t === 'history' && trades.length > 0) return;
    if (!force && t === 'patterns' && patterns.length > 0) return;
    if (!force && t === 'daily' && dailyStats.length > 0) return;
    setTabLoading(true);
    try {
      if (t === 'history') {
        const r = await fetch(`/api/goldbot-multi/${b}/history?limit=50`);
        const d = await r.json();
        setTrades(d.trades ?? []);
      } else if (t === 'patterns') {
        const r = await fetch(`/api/goldbot-multi/${b}/patterns`);
        const d = await r.json();
        setPatterns(d.patterns ?? []);
      } else {
        const r = await fetch(`/api/goldbot-multi/${b}/daily`);
        const d = await r.json();
        setDailyStats(d.days ?? []);
      }
    } catch {/* silent */} finally { setTabLoading(false); }
  }, [selectedBot, trades.length, patterns.length, dailyStats.length]);

  useEffect(() => {
    if (selectedBot !== 'ALL') loadTab(tab);
  }, [tab, selectedBot]);

  const syncHistory = useCallback(async () => {
    if (selectedBot === 'ALL') return;
    setSyncing(true);
    try {
      await fetch(`/api/goldbot-multi/${selectedBot}/sync-history`, { method: 'POST' });
      await new Promise(r => setTimeout(r, 3000));
      await Promise.all([loadTab('history', true), fetchMetrics(selectedBot)]);
    } catch { /* silent */ } finally { setSyncing(false); }
  }, [selectedBot, loadTab, fetchMetrics]);

  const pnlColor = (n: number) => n > 0 ? 'text-os-green' : n < 0 ? 'text-os-red' : 'text-os-muted';

  const botIsLive = (entry: MultiBotEntry): boolean => {
    const l = entry.live as LiveData;
    return !('error' in entry.live) && l.mt5_connected === true;
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-os-yellow" />
          <h1 className="text-lg font-semibold text-os-text">Gold Bot</h1>
          {selectedBot !== 'ALL' && live && (
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${live.circuit_breaker ? 'border-os-red/30 bg-os-red/10 text-os-red' : live.mt5_connected ? 'border-os-green/30 bg-os-green/10 text-os-green' : 'border-os-yellow/30 bg-os-yellow/10 text-os-yellow'}`}>
              <Pulse active={live.mt5_connected && !live.circuit_breaker} />
              {live.circuit_breaker ? 'Circuit Breaker' : live.mt5_connected ? 'Live' : 'Disconnected'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && selectedBot !== 'ALL' && (
            <span className="text-[10px] text-os-muted flex items-center gap-1">
              <Clock size={10} /> {lastUpdate.toLocaleTimeString('de-DE')}
              <span className="text-os-muted/40"> · 5s</span>
            </span>
          )}
          <button onClick={() => { fetchLive(selectedBot); if (selectedBot !== 'ALL') fetchMetrics(selectedBot); else fetchMultiBots(); }}
            className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Bot Selector + MT5 Control Bar */}
      <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
        {/* Selector row */}
        <div className="flex items-center gap-2 p-1.5 border-b border-os-border/50">
          <button
            onClick={() => setSelectedBot('ALL')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${selectedBot === 'ALL' ? 'bg-os-accent text-white' : 'text-os-muted hover:text-os-text hover:bg-os-elevated'}`}>
            <Activity size={12} /> Overview
          </button>
          {(['B1', 'B2', 'B3', 'B4'] as const).map((id) => {
            const cfg = PROFILE_CFG[id];
            const botEntry = multiBots.find(b => b.id === id);
            const online = botEntry ? botIsLive(botEntry) : (selectedBot === id && live?.mt5_connected);
            return (
              <button key={id} onClick={() => setSelectedBot(id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${selectedBot === id ? 'bg-os-elevated border border-os-border text-os-text' : 'text-os-muted hover:text-os-text hover:bg-os-elevated'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${online ? cfg.dot : 'bg-os-muted/30'}`} />
                <span className={selectedBot === id ? cfg.color : ''}>{id}</span>
                <span className="text-[9px] text-os-muted/60 hidden sm:inline">{cfg.label}</span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5">
            {mt5Status === null && (
              <span className="text-[10px] text-os-muted/50 italic">Launcher offline</span>
            )}
          </div>
        </div>
        {/* MT5 Controls row */}
        <div className="grid grid-cols-4 divide-x divide-os-border/50">
          {(['B1', 'B2', 'B3', 'B4'] as const).map((id) => {
            const cfg = PROFILE_CFG[id];
            const botEntry = multiBots.find(b => b.id === id);
            const mt5Live = botEntry ? botIsLive(botEntry) : (selectedBot === id && live?.mt5_connected);
            const mt5Running = mt5Status ? mt5Status[id] : undefined;
            const botEnabled = botEntry
              ? !('error' in botEntry.live) && (botEntry.live as any).trading_enabled !== false
              : (selectedBot === id ? tradingEnabled : true);
            const isActivating = activating === id;
            const isLaunching = launching === id;
            return (
              <div key={id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[10px] font-bold ${cfg.color}`}>{id}</span>
                  <span className="text-[9px] text-os-muted">{cfg.label}</span>
                </div>
                {/* MT5 Launch button */}
                <button
                  onClick={() => launchMt5(id)}
                  disabled={isLaunching || mt5Status === null}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
                    mt5Live
                      ? 'border-os-green/30 bg-os-green/10 text-os-green cursor-default'
                      : mt5Running
                      ? 'border-os-yellow/30 bg-os-yellow/10 text-os-yellow'
                      : 'border-os-border bg-os-elevated text-os-muted hover:text-os-text hover:border-os-accent/40'
                  }`}>
                  {isLaunching ? <RefreshCw size={10} className="animate-spin" /> : <Bot size={10} />}
                  {mt5Live ? 'MT5 Live' : mt5Running ? 'MT5 Starting…' : mt5Status === null ? 'No Agent' : 'Launch MT5'}
                </button>
                {/* Bot Activate toggle */}
                <button
                  onClick={() => toggleTrading(id, !botEnabled)}
                  disabled={isActivating || !mt5Live}
                  title={!mt5Live ? 'MT5 muss zuerst verbunden sein' : ''}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
                    botEnabled && mt5Live
                      ? 'border-os-green/30 bg-os-green/10 text-os-green hover:bg-os-red/10 hover:text-os-red hover:border-os-red/30'
                      : mt5Live
                      ? 'border-os-border bg-os-elevated text-os-muted hover:bg-os-green/10 hover:text-os-green hover:border-os-green/30'
                      : 'border-os-border/40 bg-os-surface/50 text-os-muted/40'
                  }`}>
                  {isActivating ? <RefreshCw size={10} className="animate-spin" /> : botEnabled && mt5Live ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                  {botEnabled && mt5Live ? 'Trading AN' : 'Trading AUS'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">{error}</div>}

      {/* ALL Overview */}
      {selectedBot === 'ALL' && (
        <div className="space-y-4">
          {multiBots.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-os-surface animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Aggregate row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {(() => {
                  const liveBots = multiBots.filter(b => !('error' in b.live));
                  const online = liveBots.filter(b => (b.live as LiveData).mt5_connected).length;
                  const totalBal = liveBots.reduce((s, b) => s + ((b.live as LiveData).account_balance ?? 0), 0);
                  const totalEq  = liveBots.reduce((s, b) => s + ((b.live as LiveData).account_equity ?? 0), 0);
                  const totalUnr = liveBots.reduce((s, b) => s + ((b.live as LiveData).unrealized_pnl ?? 0), 0);
                  const todayPnl = liveBots.reduce((s, b) => s + ((b.live as LiveData).today?.total_pnl ?? 0), 0);
                  return [
                    { t: 'Bots Online',      v: `${online}/4`,              c: online === 4 ? 'text-os-green' : online > 0 ? 'text-os-yellow' : 'text-os-red',    icon: Activity },
                    { t: 'Total Balance',    v: `$${totalBal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, c: 'text-os-yellow', icon: CircleDollarSign },
                    { t: 'Total Equity',     v: `$${totalEq.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`,  c: 'text-os-cyan',   icon: TrendingUp },
                    { t: 'Unrealized',       v: `${totalUnr >= 0 ? '+' : ''}$${fmt(totalUnr)}`, c: totalUnr >= 0 ? 'text-os-green' : 'text-os-red', icon: BarChart3 },
                    { t: "Today P&L",        v: `${todayPnl >= 0 ? '+' : ''}$${fmt(todayPnl)}`, c: todayPnl >= 0 ? 'text-os-green' : 'text-os-red', icon: Zap },
                  ].map(({ t, v, c, icon: Icon }) => (
                    <div key={t} className="rounded-xl border border-os-border bg-os-surface p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon size={11} className={c} />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted">{t}</span>
                      </div>
                      <p className={`text-xl font-bold ${c}`}>{v}</p>
                    </div>
                  ));
                })()}
              </div>

              {/* Comparison table */}
              <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
                <div className="grid grid-cols-[2fr_auto_auto_auto_auto_auto_auto] gap-3 border-b border-os-border px-4 py-2 bg-os-elevated text-[10px] font-bold uppercase tracking-wider text-os-muted">
                  <span>Bot</span><span>Status</span><span>Balance</span><span>Equity</span><span>Today P&L</span><span>Win Rate</span><span>Pos</span>
                </div>
                {multiBots.map((bot) => {
                  const isErr = 'error' in bot.live;
                  const l = isErr ? null : (bot.live as LiveData);
                  const cfg = PROFILE_CFG[bot.id];
                  return (
                    <div key={bot.id}
                      onClick={() => setSelectedBot(bot.id as BotId)}
                      className="grid grid-cols-[2fr_auto_auto_auto_auto_auto_auto] gap-3 items-center border-b border-os-border/50 px-4 py-3 last:border-0 hover:bg-os-elevated/50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${cfg.color}`}>{bot.id}</span>
                        <span className="text-[10px] text-os-muted">{cfg.label}</span>
                      </div>
                      <span>
                        {isErr ? (
                          <span className="text-[10px] text-os-red font-medium">Offline</span>
                        ) : l!.circuit_breaker ? (
                          <span className="text-[10px] text-os-red font-medium">CB</span>
                        ) : l!.mt5_connected ? (
                          <span className="flex items-center gap-1 text-[10px] text-os-green font-medium"><Pulse active /> Live</span>
                        ) : (
                          <span className="text-[10px] text-os-yellow font-medium">No MT5</span>
                        )}
                      </span>
                      <span className="text-xs font-medium text-os-text">{l ? `$${l.account_balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '—'}</span>
                      <span className="text-xs text-os-muted">{l ? `$${l.account_equity.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '—'}</span>
                      <span className={`text-xs font-bold ${l ? pnlColor(l.today.total_pnl) : 'text-os-muted'}`}>
                        {l ? `${l.today.total_pnl >= 0 ? '+' : ''}$${fmt(l.today.total_pnl)}` : '—'}
                      </span>
                      <span className={`text-xs font-medium ${l ? (l.today.win_rate >= 60 ? 'text-os-green' : l.today.win_rate >= 45 ? 'text-os-yellow' : 'text-os-red') : 'text-os-muted'}`}>
                        {l ? `${fmt(l.today.win_rate, 0)}%` : '—'}
                      </span>
                      <span className="text-xs text-os-muted">{l ? l.open_positions : '—'}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Single Bot View */}
      {selectedBot !== 'ALL' && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-os-surface animate-pulse" />)}
            </div>
          ) : live ? (
            <>
              {/* Row 1: Balance / Equity / Unrealized */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-os-border bg-os-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-os-muted mb-1 flex items-center gap-1.5">
                    <CircleDollarSign size={11} className="text-os-yellow" /> Balance
                  </p>
                  <p className="text-xl font-bold text-os-yellow">${live.account_balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-os-muted mt-0.5">{live.mt5_broker || live.symbol} · #{live.mt5_login}</p>
                </div>
                <div className="rounded-xl border border-os-border bg-os-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-os-muted mb-1 flex items-center gap-1.5">
                    <TrendingUp size={11} className="text-os-cyan" /> Equity
                  </p>
                  <p className="text-xl font-bold text-os-cyan">${live.account_equity.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
                  <p className={`text-[10px] mt-0.5 font-medium ${pnlColor(live.account_equity - live.account_balance)}`}>
                    {live.account_equity - live.account_balance >= 0 ? '+' : ''}${fmt(live.account_equity - live.account_balance)} floating
                  </p>
                </div>
                <div className="rounded-xl border border-os-border bg-os-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-os-muted mb-1 flex items-center gap-1.5">
                    <Activity size={11} className={pnlColor(live.unrealized_pnl)} /> Unrealized
                  </p>
                  <p className={`text-xl font-bold ${pnlColor(live.unrealized_pnl)}`}>
                    {live.unrealized_pnl >= 0 ? '+' : ''}${fmt(live.unrealized_pnl)}
                  </p>
                  <p className="text-[10px] text-os-muted mt-0.5">{live.open_positions} open pos</p>
                </div>
              </div>

              {/* Row 2: 4 stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard title="Today P&L" value={`${live.today.total_pnl >= 0 ? '+' : ''}$${fmt(live.today.total_pnl)}`}
                  sub={`${live.today.total_trades}T · ${live.today.wins}W/${live.today.losses}L`}
                  icon={TrendingUp} color={pnlColor(live.today.total_pnl)} flash={flash} />
                <KpiCard title="All-Time P&L" value={metrics ? `${metrics.total_pnl >= 0 ? '+' : ''}$${fmt(metrics.total_pnl)}` : '—'}
                  sub={metrics ? `${metrics.total_trades}T · ${metrics.wins}W/${metrics.losses}L` : 'Lade…'}
                  icon={CircleDollarSign} color={metrics ? (metrics.total_pnl >= 0 ? 'text-os-green' : 'text-os-red') : 'text-os-muted'} />
                <KpiCard title="Win Rate" value={metrics ? `${fmt(metrics.win_rate, 1)}%` : `${fmt(live.today.win_rate, 0)}%`}
                  sub={metrics ? `Ø Win $${fmt(metrics.avg_win)} / Loss $${fmt(metrics.avg_loss)}` : 'Heute'}
                  icon={BarChart3} color={(() => { const wr = metrics?.win_rate ?? live.today.win_rate; return wr >= 60 ? 'text-os-green' : wr >= 45 ? 'text-os-yellow' : 'text-os-red'; })()} />
                <KpiCard title="Profit Factor" value={metrics ? (metrics.profit_factor === 99 ? '∞' : fmt(metrics.profit_factor)) : '—'}
                  sub={metrics ? `Expectancy $${fmt(metrics.expectancy)}` : `Open: ${live.open_positions}`}
                  icon={Zap} color={metrics ? (metrics.profit_factor >= 2 ? 'text-os-green' : metrics.profit_factor >= 1 ? 'text-os-yellow' : 'text-os-red') : 'text-os-muted'} />
              </div>

              {/* Row 3: Performance Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-os-border bg-os-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3">P&L Zeitraum</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Heute', pnl: metrics?.today_pnl ?? live.today.total_pnl, trades: metrics?.today_trades ?? live.today.total_trades },
                      { label: 'Woche', pnl: metrics?.week_pnl ?? 0, trades: metrics?.week_trades ?? 0 },
                      { label: 'Monat', pnl: metrics?.month_pnl ?? 0, trades: metrics?.month_trades ?? 0 },
                    ].map(({ label, pnl, trades: tc }) => (
                      <div key={label} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-os-muted w-10">{label}</span>
                          <span className="text-[10px] text-os-muted/60">{tc}T</span>
                        </div>
                        <span className={`text-xs font-bold ${pnlColor(pnl)}`}>{pnl >= 0 ? '+' : ''}${fmt(pnl)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-os-border bg-os-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3">Trade-Statistik</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Bester Trade', val: metrics ? `+$${fmt(metrics.best_trade)}` : '—', color: 'text-os-green' },
                      { label: 'Schlechtester', val: metrics ? `$${fmt(metrics.worst_trade)}` : '—', color: 'text-os-red' },
                      { label: 'Ø R:R', val: metrics ? `${fmt(metrics.avg_rr)}:1` : '—', color: metrics ? (metrics.avg_rr >= 1.5 ? 'text-os-green' : metrics.avg_rr >= 1 ? 'text-os-yellow' : 'text-os-red') : 'text-os-muted' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-os-muted">{label}</span>
                        <span className={`text-xs font-bold ${color}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-os-border bg-os-surface p-4">
                  <p className="text-[10px] uppercase tracking-wider text-os-muted mb-3">Risk</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Max Drawdown', val: metrics ? `${fmt(metrics.max_drawdown_pct)}%` : '—', color: metrics ? (metrics.max_drawdown_pct < 5 ? 'text-os-green' : metrics.max_drawdown_pct < 15 ? 'text-os-yellow' : 'text-os-red') : 'text-os-muted' },
                      { label: 'Cons. Losses', val: String(live.consecutive_losses), color: live.consecutive_losses >= 2 ? 'text-os-yellow' : 'text-os-green' },
                      { label: 'Circuit', val: live.circuit_breaker ? 'AKTIV' : `Clear`, color: live.circuit_breaker ? 'text-os-red' : 'text-os-green' },
                    ].map(({ label, val, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-os-muted">{label}</span>
                        <span className={`text-xs font-bold ${color}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Disconnect banner */}
              {!live.mt5_connected && (
                <div className="rounded-xl border border-os-yellow/30 bg-os-yellow/5 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={16} className="text-os-yellow flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-os-yellow mb-1">MT5 EA nicht verbunden — {selectedBot}</p>
                      <p className="text-xs text-os-muted mb-2">
                        <strong className="text-os-text">mt5_http_bridge_{selectedBot.toLowerCase()}.mq5</strong> → F7 kompilieren → WebRequest für{' '}
                        <code className="text-os-cyan">http://204.168.142.89:{selectedBot === 'B1' ? 8001 : selectedBot === 'B2' ? 8002 : selectedBot === 'B3' ? 8003 : 8004}</code>
                      </p>
                      <a href={`/mt5_http_bridge.mq5`} download className="inline-flex items-center gap-1.5 rounded-lg border border-os-yellow/30 bg-os-yellow/10 px-3 py-1.5 text-xs font-medium text-os-yellow hover:bg-os-yellow/20 transition-colors">
                        <Download size={12} /> Download EA
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 4: Open Positions + Mini Equity Curve side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Open Positions */}
                <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-os-border">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-os-text">Open Positions</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${live.open_positions > 0 ? 'bg-os-green/10 text-os-green' : 'bg-os-border/60 text-os-muted'}`}>{live.open_positions}</span>
                    </div>
                    {live.unrealized_pnl !== 0 && (
                      <span className={`text-xs font-bold ${pnlColor(live.unrealized_pnl)}`}>{live.unrealized_pnl >= 0 ? '+' : ''}${fmt(live.unrealized_pnl)}</span>
                    )}
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {live.positions.length > 0 ? live.positions.map((p) => (
                      <div key={p.ticket} className="flex items-center gap-3 px-4 py-2.5 border-b border-os-border/40 last:border-0 hover:bg-os-elevated/50">
                        <DirBadge dir={p.direction} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-os-text">#{p.ticket}</p>
                          <p className="text-[10px] text-os-muted">{p.role}</p>
                        </div>
                        <div className="text-right text-[10px]">
                          <p className="text-os-text">{p.lots} @ {fmtPrice(p.entry_price)}</p>
                          <p className="text-os-muted">{p.open_time ? relTime(p.open_time) : '—'}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="p-6 text-center">
                        <Bot size={16} className="mx-auto mb-1.5 text-os-muted" />
                        <p className="text-xs text-os-muted">{live.mt5_connected ? 'Keine Positionen' : 'Warte auf MT5…'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Daily Equity Curve + Status */}
                <div className="space-y-3">
                  {dailyStats.length >= 2 && (
                    <div className="rounded-xl border border-os-border bg-os-surface p-3">
                      <p className="text-[10px] uppercase tracking-wider text-os-muted mb-2">Equity Curve (Daily P&L)</p>
                      <MiniSparkline data={dailyStats} height={80} />
                    </div>
                  )}
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
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div>
                <div className="flex gap-1 mb-4">
                  {(['history', 'patterns', 'daily', 'roadmap'] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === t ? 'bg-os-accent text-white' : 'text-os-muted hover:text-os-text hover:bg-os-surface'}`}>
                      {t === 'history' ? `History${trades.length > 0 ? ` (${trades.length})` : ''}` : t === 'patterns' ? 'Patterns' : t === 'daily' ? 'Daily Stats' : 'Roadmap'}
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
                    <p className="text-xs text-os-muted mb-4">Klicke "Sync MT5" um Trades zu laden</p>
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

                {tab === 'roadmap' && (
                  <div className="space-y-3">
                    {[
                      {
                        phase: 'Phase 1', title: 'Infrastruktur & Live-Connection', status: 'done' as const,
                        items: [
                          { label: 'VPS Setup + PostgreSQL', done: true },
                          { label: 'HTTP Bridge EA (mt5_http_bridge.mq5)', done: true },
                          { label: 'PING — echte Balance / Equity / Login', done: true },
                          { label: 'LennoxOS Dashboard — Live-Poll 5s', done: true },
                          { label: 'Open Positions Panel + Unrealized P&L', done: true },
                          { label: 'MT5 History Sync (SYNC_HISTORY)', done: true },
                          { label: '4-Bot Multi-Instance (B1–B4)', done: true },
                        ],
                      },
                      {
                        phase: 'Phase 2', title: 'Signal-Parser & Auto-Execution', status: 'next' as const,
                        items: [
                          { label: 'Telegram Signal-Gruppe anbinden', done: false },
                          { label: 'SignalParser: Entry / SL / TP aus Text', done: false },
                          { label: 'Auto-Order via /pending Queue', done: false },
                          { label: 'Multi-TP: TP1 (50%) → TP2 (25%) → TP3 (25%)', done: false },
                          { label: 'Telegram Commands: /status /pause /resume', done: false },
                        ],
                      },
                      {
                        phase: 'Phase 3', title: 'Risk-Management', status: 'planned' as const,
                        items: [
                          { label: 'Circuit Breaker (5% Daily Loss → Stop)', done: false },
                          { label: '3 Consecutive Losses → 24h Pause', done: false },
                          { label: 'Min R:R 1:1.5 Validator', done: false },
                          { label: 'Dynamische Lot-Size (1% Risk pro Trade)', done: false },
                          { label: 'Max Entry Zone (30 Pips) Check', done: false },
                        ],
                      },
                      {
                        phase: 'Phase 4', title: 'Pattern Learning', status: 'planned' as const,
                        items: [
                          { label: 'Win-Rate nach Richtung (BUY/SELL)', done: false },
                          { label: 'Win-Rate nach Tag (Mon–Sun)', done: false },
                          { label: 'Win-Rate nach Stunde (0–23)', done: false },
                          { label: 'Win-Rate nach Session (Asian/London/NY)', done: false },
                          { label: 'Auto-Filter: schlechte Bedingungen = Skip', done: false },
                        ],
                      },
                      {
                        phase: 'Phase 5', title: 'Vollautonomie', status: 'planned' as const,
                        items: [
                          { label: 'Täglicher Report via Telegram', done: false },
                          { label: 'Rebate-Tracking (PU Prime Pool)', done: false },
                          { label: 'Kein manueller Eingriff nötig', done: false },
                          { label: 'Ziel: 1.000 € passiv / Tag', done: false },
                        ],
                      },
                    ].map(({ phase, title, status, items }) => {
                      const doneCount = items.filter(i => i.done).length;
                      const pct = Math.round((doneCount / items.length) * 100);
                      const statusStyle =
                        status === 'done'    ? { badge: 'bg-os-green/10 text-os-green border-os-green/20', bar: 'bg-os-green' } :
                        status === 'next'    ? { badge: 'bg-os-accent/10 text-os-accent border-os-accent/20', bar: 'bg-os-accent' } :
                                              { badge: 'bg-os-border/60 text-os-muted border-os-border', bar: 'bg-os-muted' };
                      const statusLabel = status === 'done' ? 'Abgeschlossen' : status === 'next' ? 'Als nächstes' : 'Geplant';
                      return (
                        <div key={phase} className="rounded-xl border border-os-border bg-os-surface p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold text-os-muted uppercase tracking-wider">{phase}</span>
                                <span className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${statusStyle.badge}`}>{statusLabel}</span>
                              </div>
                              <p className="text-sm font-semibold text-os-text">{title}</p>
                            </div>
                            <span className={`text-sm font-bold ${status === 'done' ? 'text-os-green' : status === 'next' ? 'text-os-accent' : 'text-os-muted'}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-os-border mb-3">
                            <div className={`h-1.5 rounded-full transition-all ${statusStyle.bar}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="space-y-1.5">
                            {items.map((item) => (
                              <div key={item.label} className="flex items-center gap-2">
                                {item.done
                                  ? <CheckCircle2 size={12} className="text-os-green flex-shrink-0" />
                                  : <div className="h-3 w-3 rounded-full border border-os-border flex-shrink-0" />
                                }
                                <span className={`text-xs ${item.done ? 'text-os-text' : 'text-os-muted'}`}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
              <Bot size={24} className="mx-auto mb-2 text-os-muted" />
              <p className="text-sm text-os-muted">Gold Bot {selectedBot} nicht erreichbar</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
