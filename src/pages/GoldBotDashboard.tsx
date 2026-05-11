import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Activity, Clock, Target,
  Shield, Zap, BarChart3, CircleDollarSign, AlertTriangle,
  CheckCircle2, XCircle, Pause, Play, RotateCcw,
  ArrowUpRight, ArrowDownRight, Minus, Bot, Radio,
  Signal, Wallet, Percent, ChevronRight, History,
  Settings, Filter, Calendar, ArrowRight,
  Layers, FileText, Globe, Smartphone, Megaphone, BookOpen,
  Cpu, GitBranch, Rocket, Lock, Eye
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────── */

interface Trade {
  id: string;
  signal_id: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  sl: number;
  tp1: number;
  tp2?: number;
  tp3?: number;
  status: 'open' | 'closed_tp1' | 'closed_tp2' | 'closed_sl' | 'closed_manual';
  lots: number;
  pnl_pips?: number;
  pnl_currency?: number;
  open_time: string;
  close_time?: string;
}

interface DailyStats {
  date: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  consecutive_losses: number;
  circuit_breaker: boolean;
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

interface BotStatus {
  connected: boolean;
  mt5_connected: boolean;
  circuit_breaker: boolean;
  mode: 'demo' | 'live';
  account_balance: number;
  account_equity: number;
  open_positions: number;
  today_pnl: number;
  total_pnl: number;
  uptime_hours: number;
}

/* ─── Mock Data ──────────────────────────────────────────────── */

const MOCK_TRADES: Trade[] = [
  { id: '1', signal_id: 'sig_001', direction: 'BUY', entry: 2350.50, sl: 2340.00, tp1: 2365.00, tp2: 2380.00, status: 'closed_tp1', lots: 0.10, pnl_pips: 145, pnl_currency: 145.00, open_time: '2025-06-11 08:30:00', close_time: '2025-06-11 10:15:00' },
  { id: '2', signal_id: 'sig_002', direction: 'SELL', entry: 3380.00, sl: 3390.00, tp1: 3365.00, tp2: 3350.00, status: 'closed_sl', lots: 0.10, pnl_pips: -100, pnl_currency: -100.00, open_time: '2025-06-11 09:00:00', close_time: '2025-06-11 09:45:00' },
  { id: '3', signal_id: 'sig_003', direction: 'BUY', entry: 2345.00, sl: 2335.00, tp1: 2360.00, tp2: 2375.00, tp3: 2400.00, status: 'closed_tp2', lots: 0.15, pnl_pips: 300, pnl_currency: 450.00, open_time: '2025-06-11 11:00:00', close_time: '2025-06-11 14:30:00' },
  { id: '4', signal_id: 'sig_004', direction: 'SELL', entry: 3395.00, sl: 3405.00, tp1: 3380.00, status: 'open', lots: 0.10, open_time: '2025-06-11 13:00:00' },
  { id: '5', signal_id: 'sig_005', direction: 'BUY', entry: 2360.00, sl: 2350.00, tp1: 2375.00, tp2: 2390.00, status: 'open', lots: 0.10, open_time: '2025-06-11 14:00:00' },
  { id: '6', signal_id: 'sig_006', direction: 'BUY', entry: 2355.00, sl: 2345.00, tp1: 2370.00, status: 'closed_tp1', lots: 0.10, pnl_pips: 150, pnl_currency: 150.00, open_time: '2025-06-10 08:00:00', close_time: '2025-06-10 11:00:00' },
  { id: '7', signal_id: 'sig_007', direction: 'SELL', entry: 3400.00, sl: 3410.00, tp1: 3385.00, status: 'closed_tp1', lots: 0.10, pnl_pips: 150, pnl_currency: 150.00, open_time: '2025-06-10 09:30:00', close_time: '2025-06-10 12:00:00' },
  { id: '8', signal_id: 'sig_008', direction: 'BUY', entry: 2348.00, sl: 2338.00, tp1: 2363.00, status: 'closed_sl', lots: 0.10, pnl_pips: -100, pnl_currency: -100.00, open_time: '2025-06-10 10:00:00', close_time: '2025-06-10 10:30:00' },
];

const MOCK_PATTERNS: Pattern[] = [
  { pattern_type: 'direction', pattern_value: 'BUY', total_signals: 12, wins: 9, losses: 3, win_rate: 75, avg_pnl_pips: 85 },
  { pattern_type: 'direction', pattern_value: 'SELL', total_signals: 8, wins: 5, losses: 3, win_rate: 62.5, avg_pnl_pips: 45 },
  { pattern_type: 'day', pattern_value: 'Tue', total_signals: 6, wins: 5, losses: 1, win_rate: 83.3, avg_pnl_pips: 120 },
  { pattern_type: 'day', pattern_value: 'Wed', total_signals: 5, wins: 4, losses: 1, win_rate: 80, avg_pnl_pips: 95 },
  { pattern_type: 'day', pattern_value: 'Fri', total_signals: 4, wins: 2, losses: 2, win_rate: 50, avg_pnl_pips: 20 },
  { pattern_type: 'session', pattern_value: 'london', total_signals: 10, wins: 8, losses: 2, win_rate: 80, avg_pnl_pips: 110 },
  { pattern_type: 'session', pattern_value: 'ny', total_signals: 7, wins: 4, losses: 3, win_rate: 57.1, avg_pnl_pips: 40 },
  { pattern_type: 'session', pattern_value: 'asian', total_signals: 3, wins: 2, losses: 1, win_rate: 66.7, avg_pnl_pips: 65 },
];

const MOCK_STATUS: BotStatus = {
  connected: true,
  mt5_connected: true,
  circuit_breaker: false,
  mode: 'demo',
  account_balance: 100000.00,
  account_equity: 100695.00,
  open_positions: 2,
  today_pnl: 495.00,
  total_pnl: 695.00,
  uptime_hours: 72,
};

/* ─── Mini Chart (SVG Sparkline) ─────────────────────────────── */

function MiniChart({ data, color = '#d4a847', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 120;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Components ─────────────────────────────────────────────── */

function StatusBadge({ status, text }: { status: 'green' | 'yellow' | 'red' | 'blue'; text: string }) {
  const colors = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    yellow: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    blue: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'green' ? 'bg-emerald-400' : status === 'yellow' ? 'bg-amber-400' : status === 'red' ? 'bg-red-400' : 'bg-sky-400'}`} />
      {text}
    </span>
  );
}

function KPICard({ title, value, subtitle, icon: Icon, trend, color = 'gold' }: {
  title: string; value: string; subtitle?: string; icon: React.ElementType; trend?: 'up' | 'down' | 'neutral'; color?: string;
}) {
  const colorMap: Record<string, string> = {
    gold: 'text-amber-400',
    green: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-sky-400',
    purple: 'text-violet-400',
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-white/[0.04] p-2">
          <Icon size={18} className={colorMap[color] || 'text-amber-400'} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-gray-500'}`}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : trend === 'down' ? <ArrowDownRight size={14} /> : <Minus size={14} />}
          </span>
        )}
      </div>
      <p className={`mt-3 text-2xl font-bold ${colorMap[color] || 'text-white'}`}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-600">{subtitle}</p>}
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isBuy = trade.direction === 'BUY';
  const isWin = (trade.pnl_pips || 0) > 0;
  const statusColors: Record<string, string> = {
    open: 'text-sky-400 bg-sky-400/10',
    closed_tp1: 'text-emerald-400 bg-emerald-400/10',
    closed_tp2: 'text-emerald-400 bg-emerald-400/10',
    closed_sl: 'text-red-400 bg-red-400/10',
    closed_manual: 'text-gray-400 bg-gray-400/10',
  };
  const statusLabels: Record<string, string> = {
    open: 'OPEN', closed_tp1: 'TP1', closed_tp2: 'TP2', closed_sl: 'SL', closed_manual: 'MANUAL',
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-white/[0.04] bg-[#0e0e0e] px-4 py-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isBuy ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
        {isBuy ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{trade.direction}</span>
          <span className="text-xs text-gray-500">XAUUSD</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${statusColors[trade.status]}`}>{statusLabels[trade.status]}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-600">
          <span>@{trade.entry.toFixed(2)}</span>
          <span>SL {trade.sl.toFixed(2)}</span>
          <span>TP1 {trade.tp1.toFixed(2)}</span>
          {trade.tp2 && <span>TP2 {trade.tp2.toFixed(2)}</span>}
        </div>
      </div>
      <div className="text-right">
        {trade.pnl_pips !== undefined && (
          <p className={`text-sm font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
            {isWin ? '+' : ''}{trade.pnl_pips.toFixed(0)} pips
          </p>
        )}
        {trade.pnl_currency !== undefined && (
          <p className={`text-xs ${isWin ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
            ${isWin ? '+' : ''}{trade.pnl_currency.toFixed(2)}
          </p>
        )}
        {trade.status === 'open' && (
          <p className="text-xs text-sky-400 animate-pulse">LIVE</p>
        )}
      </div>
    </div>
  );
}

function PatternBar({ pattern }: { pattern: Pattern }) {
  const winWidth = `${pattern.win_rate}%`;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400 capitalize">{pattern.pattern_value}</span>
        <span className="font-semibold text-amber-400">{pattern.win_rate.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-500"
          style={{ width: winWidth }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-600">
        <span>{pattern.wins}W / {pattern.losses}L</span>
        <span>{pattern.avg_pnl_pips > 0 ? '+' : ''}{pattern.avg_pnl_pips.toFixed(0)} pips</span>
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────── */

export default function GoldBotDashboard() {
  const [status, setStatus] = useState<BotStatus>(MOCK_STATUS);
  const [trades] = useState<Trade[]>(MOCK_TRADES);
  const [patterns] = useState<Pattern[]>(MOCK_PATTERNS);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'patterns' | 'roadmap' | 'settings'>('overview');

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(prev => ({
        ...prev,
        account_equity: prev.account_equity + (Math.random() - 0.4) * 10,
        today_pnl: prev.today_pnl + (Math.random() - 0.4) * 2,
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const closedTrades = trades.filter(t => t.status !== 'open');
  const openTrades = trades.filter(t => t.status === 'open');
  const winRate = closedTrades.length > 0 ? (closedTrades.filter(t => (t.pnl_pips || 0) > 0).length / closedTrades.length * 100) : 0;
  const totalPips = closedTrades.reduce((sum, t) => sum + (t.pnl_pips || 0), 0);
  const equityHistory = [100000, 100050, 100120, 100080, 100200, 100350, 100500, 100480, 100600, 100695];

  const filteredTrades = filter === 'all' ? trades : filter === 'open' ? openTrades : closedTrades;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-[#0e0e0e]">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Bot size={20} className="text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Gold Bot</h1>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[10px] text-gray-500">
                    <Radio size={10} className={status.connected ? 'text-emerald-400' : 'text-red-400'} />
                    {status.connected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                  <span className="text-gray-700">|</span>
                  <StatusBadge status={status.mode === 'demo' ? 'blue' : status.circuit_breaker ? 'red' : 'green'} text={status.mode === 'demo' ? 'DEMO' : status.circuit_breaker ? 'PAUSED' : 'LIVE'} />
                  <StatusBadge status={status.mt5_connected ? 'green' : 'red'} text={status.mt5_connected ? 'MT5 OK' : 'MT5 DOWN'} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {status.circuit_breaker ? (
                <button className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                  <Play size={14} /> Resume
                </button>
              ) : (
                <button className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors">
                  <Pause size={14} /> Pause
                </button>
              )}
              <button className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-400 hover:bg-white/[0.08] transition-colors">
                <RotateCcw size={14} /> Restart
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KPICard
            title="Balance"
            value={`$${status.account_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            subtitle="Demo Account"
            icon={Wallet}
            color="gold"
          />
          <KPICard
            title="Equity"
            value={`$${status.account_equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            subtitle={`+$${(status.account_equity - status.account_balance).toFixed(2)}`}
            icon={TrendingUp}
            trend="up"
            color="green"
          />
          <KPICard
            title="Today's PnL"
            value={`+$${status.today_pnl.toFixed(2)}`}
            subtitle="3 trades today"
            icon={CircleDollarSign}
            trend="up"
            color="green"
          />
          <KPICard
            title="Win Rate"
            value={`${winRate.toFixed(0)}%`}
            subtitle={`${closedTrades.filter(t => (t.pnl_pips || 0) > 0).length}W / ${closedTrades.filter(t => (t.pnl_pips || 0) < 0).length}L`}
            icon={Target}
            trend="up"
            color="gold"
          />
        </div>

        {/* Second Row */}
        <div className="mt-3 grid grid-cols-3 gap-3 lg:grid-cols-6">
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4 text-center">
            <p className="text-lg font-bold text-amber-400">{openTrades.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Open Pos</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4 text-center">
            <p className="text-lg font-bold text-emerald-400">+{totalPips.toFixed(0)}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Total Pips</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4 text-center">
            <p className="text-lg font-bold text-sky-400">{trades.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Total Trades</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4 text-center">
            <p className="text-lg font-bold text-violet-400">{status.uptime_hours}h</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Uptime</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4 text-center">
            <p className="text-lg font-bold text-amber-400">1:{(closedTrades.reduce((sum, t) => sum + Math.abs((t.pnl_pips || 0)), 0) / Math.abs(closedTrades.reduce((sum, t) => sum + (t.pnl_pips || 0) < 0 ? (t.pnl_pips || 0) : 0, 0)) || 0).toFixed(1)}</p>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Avg R:R</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-4 text-center">
            <MiniChart data={equityHistory} color="#d4a847" />
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Equity Curve</p>
          </div>
        </div>

        {/* Equity Chart Placeholder */}
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#111111] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold">Equity Curve</h2>
            </div>
            <div className="flex items-center gap-2">
              {['1D', '1W', '1M', '3M', 'ALL'].map((period) => (
                <button
                  key={period}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${period === '1W' ? 'bg-amber-500/10 text-amber-400' : 'text-gray-600 hover:text-gray-400'}`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex h-48 items-end justify-between gap-1">
            {equityHistory.map((v, i) => {
              const height = `${((v - 100000) / 700) * 100}%`;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all hover:bg-amber-400/30"
                  style={{
                    height: `calc(${height} + 20%)`,
                    background: `linear-gradient(to top, rgba(212,168,71,0.1), rgba(212,168,71,0.4))`,
                    minHeight: '10%',
                  }}
                  title={`$${v.toFixed(2)}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-gray-600">
            <span>Jun 01</span>
            <span>Jun 03</span>
            <span>Jun 05</span>
            <span>Jun 07</span>
            <span>Jun 09</span>
            <span>Jun 11</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 rounded-lg border border-white/[0.06] bg-[#111111] p-1">
          {[
            { id: 'overview', label: 'Trades', icon: History },
            { id: 'patterns', label: 'Patterns', icon: Target },
            { id: 'roadmap', label: 'Roadmap', icon: Rocket },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                selectedTab === tab.id ? 'bg-[#1a1a1a] text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {selectedTab === 'overview' && (
            <div className="space-y-3">
              {/* Filter */}
              <div className="flex items-center gap-2">
                {(['all', 'open', 'closed'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      filter === f ? 'bg-amber-500/10 text-amber-400' : 'text-gray-500 hover:bg-white/[0.04]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-600">{filteredTrades.length} trades</span>
              </div>

              {/* Trade List */}
              <div className="space-y-2">
                {filteredTrades.map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'patterns' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Target size={14} className="text-amber-400" />
                  Direction Performance
                </h3>
                <div className="mt-4 space-y-4">
                  {patterns.filter(p => p.pattern_type === 'direction').map((p) => (
                    <PatternBar key={`${p.pattern_type}-${p.pattern_value}`} pattern={p} />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar size={14} className="text-amber-400" />
                  Day of Week
                </h3>
                <div className="mt-4 space-y-4">
                  {patterns.filter(p => p.pattern_type === 'day').map((p) => (
                    <PatternBar key={`${p.pattern_type}-${p.pattern_value}`} pattern={p} />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Clock size={14} className="text-amber-400" />
                  Session Performance
                </h3>
                <div className="mt-4 space-y-4">
                  {patterns.filter(p => p.pattern_type === 'session').map((p) => (
                    <PatternBar key={`${p.pattern_type}-${p.pattern_value}`} pattern={p} />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Zap size={14} className="text-amber-400" />
                  Best Combinations
                </h3>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'BUY + London Session', win_rate: 85, trades: 8 },
                    { label: 'BUY + Tuesday', win_rate: 83, trades: 6 },
                    { label: 'SELL + Asian Session', win_rate: 75, trades: 4 },
                    { label: 'BUY + Wednesday', win_rate: 80, trades: 5 },
                  ].map((combo, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-gray-300">{combo.label}</p>
                        <p className="text-[10px] text-gray-600">{combo.trades} trades</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">{combo.win_rate}%</p>
                        <p className="text-[10px] text-gray-600">win rate</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'roadmap' && (
            <div className="space-y-4">
              {/* Phase 0: MVP Live */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400">Phase 0 — MVP Live</h3>
                    <p className="text-[11px] text-gray-500">Jetzt — 01.06.2025</p>
                  </div>
                  <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">Active</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {[
                    { icon: Bot, label: 'Single Gold Bot', desc: 'Telegram → ZeroMQ → MT5', status: 'done' },
                    { icon: Target, label: 'Signal Tracking', desc: 'Entry/SL/TP/Exit geloggt', status: 'done' },
                    { icon: Shield, label: 'Risk Management', desc: '1% Risk, Circuit Breaker', status: 'done' },
                    { icon: BarChart3, label: 'Pattern Learning', desc: 'Win Rate nach Tag/Session', status: 'done' },
                    { icon: Radio, label: 'MT5 Connected', desc: 'ZeroMQ Bridge läuft', status: 'done' },
                    { icon: History, label: 'Trade History', desc: 'Alle Trades in PostgreSQL', status: 'done' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-lg bg-[#0e0e0e] px-3 py-2">
                      <item.icon size={14} className="text-emerald-400" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-300">{item.label}</p>
                        <p className="text-[10px] text-gray-600">{item.desc}</p>
                      </div>
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase 1: Multi-Bot System */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                    <Layers size={16} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-400">Phase 1 — Multi-Bot System</h3>
                    <p className="text-[11px] text-gray-500">Geplant: Juni 2025</p>
                  </div>
                  <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 uppercase">Planned</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {[
                    { icon: Shield, label: 'Conservative Bot', desc: '1% Risk, R:R 1:1.5, alle Signale' },
                    { icon: Zap, label: 'Aggressive Bot', desc: '3% Risk, R:R 1:2.0, nur beste Signale' },
                    { icon: TrendingUp, label: 'Swing Bot', desc: 'Nur TP2/TP3, länger halten' },
                    { icon: Activity, label: 'Scalp Bot', desc: 'Schneller BE, schnell rein/raus' },
                    { icon: Cpu, label: 'Analyzer Bot', desc: 'Vergleicht alle Bots, empfiehlt beste Strategie' },
                    { icon: GitBranch, label: 'Shared Database', desc: 'Alle Bots schreiben in gleiche DB' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-lg bg-[#0e0e0e] px-3 py-2">
                      <item.icon size={14} className="text-amber-400" />
                      <div>
                        <p className="text-xs font-medium text-gray-300">{item.label}</p>
                        <p className="text-[10px] text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase 2: Content Engine */}
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10">
                    <Megaphone size={16} className="text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-sky-400">Phase 2 — Content Engine (International)</h3>
                    <p className="text-[11px] text-gray-500">Geplant: Juli 2025</p>
                  </div>
                  <span className="ml-auto rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400 uppercase">Planned</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {[
                    { icon: FileText, label: 'Signal Chart Generator', desc: 'Auto-Grafiken aus Signalen für Social Media' },
                    { icon: Globe, label: '12-Sprachen Übersetzung', desc: 'DE/EN/ES/FR/IT/PT/TR/AR/TH/VI/ID/PL' },
                    { icon: Smartphone, label: 'Auto-Posting', desc: 'TikTok 3x/Tag, Instagram 2x/Tag, FB 1x/Tag' },
                    { icon: Bot, label: 'Telegram Onboarding Bot', desc: 'Auto-Gruppenbeitritt + 7-Tage Drip-Sequenz' },
                    { icon: Signal, label: 'Free Signal Gruppe', desc: '3 Signale/Tag als Lead-Magnet' },
                    { icon: ChevronRight, label: 'Upsell Funnel', desc: 'Free → Premium ($29/Mo) → Kurs ($99)' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-lg bg-[#0e0e0e] px-3 py-2">
                      <item.icon size={14} className="text-sky-400" />
                      <div>
                        <p className="text-xs font-medium text-gray-300">{item.label}</p>
                        <p className="text-[10px] text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase 3: Monetization */}
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <BookOpen size={16} className="text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-violet-400">Phase 3 — Monetization</h3>
                    <p className="text-[11px] text-gray-500">Geplant: August 2025</p>
                  </div>
                  <span className="ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400 uppercase">Planned</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {[
                    { icon: FileText, label: 'Setup Guide PDF', desc: '$49 — Bot Setup Schritt für Schritt', price: '$49' },
                    { icon: BookOpen, label: 'Trading System Kurs', desc: '$299 — Komplettes Multi-Bot System', price: '$299' },
                    { icon: Cpu, label: 'Agent Workflows', desc: '$149 — Automate Your Trading Templates', price: '$149' },
                    { icon: Rocket, label: 'Done-For-You Setup', desc: '$1,000+ — Komplettes Setup Service', price: '$1,000+' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-lg bg-[#0e0e0e] px-3 py-2">
                      <item.icon size={14} className="text-violet-400" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-300">{item.label}</p>
                        <p className="text-[10px] text-gray-600">{item.desc}</p>
                      </div>
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400">{item.price}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase 4: Autonomous System */}
              <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
                    <Eye size={16} className="text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-400">Phase 4 — Autonomous System</h3>
                    <p className="text-[11px] text-gray-600">Vision: Q4 2025</p>
                  </div>
                  <span className="ml-auto rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-gray-500 uppercase">Vision</span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {[
                    { icon: Bot, label: 'Self-Healing Agents', desc: 'Bot findet Workarounds bei Errors' },
                    { icon: Cpu, label: 'Cross-Agent Learning', desc: 'Bots lernen voneinander' },
                    { icon: Globe, label: 'International Scale', desc: '10,000+ Kunden, 12 Sprachen' },
                    { icon: Lock, label: 'Autonomous Trading', desc: 'System entscheidet selbst, ich approven nur' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-lg bg-[#0e0e0e] px-3 py-2 opacity-60">
                      <item.icon size={14} className="text-gray-500" />
                      <div>
                        <p className="text-xs font-medium text-gray-500">{item.label}</p>
                        <p className="text-[10px] text-gray-700">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'settings' && (
            <div className="rounded-xl border border-white/[0.06] bg-[#111111] p-5">
              <h3 className="text-sm font-semibold">Bot Configuration</h3>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {[
                  { label: 'Risk Per Trade', value: '1.0%', desc: 'Maximum risk per trade' },
                  { label: 'Max Daily Loss', value: '5.0%', desc: 'Circuit breaker threshold' },
                  { label: 'Max Consecutive Losses', value: '3', desc: '24h pause trigger' },
                  { label: 'Signal Age Limit', value: '15 min', desc: 'Ignore older signals' },
                  { label: 'Magic Number', value: '260501', desc: 'MT5 order identifier' },
                  { label: 'Duplicate Window', value: '30 sec', desc: 'Filter duplicate signals' },
                ].map((setting) => (
                  <div key={setting.label} className="rounded-lg border border-white/[0.04] bg-[#0e0e0e] p-4">
                    <p className="text-xs text-gray-500">{setting.label}</p>
                    <p className="mt-1 text-lg font-bold text-amber-400">{setting.value}</p>
                    <p className="text-[10px] text-gray-600">{setting.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <h4 className="flex items-center gap-2 text-sm font-medium text-red-400">
                  <AlertTriangle size={14} />
                  Danger Zone
                </h4>
                <p className="mt-2 text-xs text-gray-500">These actions affect trading immediately.</p>
                <div className="mt-3 flex gap-3">
                  <button className="rounded-md border border-red-500/30 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                    Reset Stats
                  </button>
                  <button className="rounded-md border border-red-500/30 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors">
                    Emergency Stop
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 border-t border-white/[0.06] pt-4 text-center">
          <p className="text-[10px] text-gray-600">
            Lennox Gold Bot v1.0 — Powered by Lennox OS — {status.mode === 'demo' ? 'Demo Mode' : 'Live Trading'}
          </p>
        </div>
      </div>
    </div>
  );
}
