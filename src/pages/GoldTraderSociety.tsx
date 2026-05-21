import { useState, useEffect } from 'react';
import {
  TrendingUp, Users, Globe, Zap, Activity, BarChart3,
  ExternalLink, CheckCircle2, Clock, Target, Radio,
  MessageSquare, FileText, Play, Layers, ChevronRight,
} from 'lucide-react';
import GoldBotDashboard from './GoldBotDashboard';
import { RoadmapPanel } from '../components/RoadmapPanel';

const GTS_GITHUB = 'https://github.com/cwconsulting369-art/goldtradersociety';
const GTS_VERCEL = 'https://vercel.com/cwconsulting369-9599s-projects/goldtradersociety';
const GTS_DOMAIN = 'https://goldtradersociety.com';
const GTS_CHANNEL = 'https://t.me/goldtradersociety';

interface BotStatus {
  mt5_connected: boolean;
  open_positions: number;
  account_balance: number;
  today: { total_trades: number; total_pnl: number };
}

function StatCard({ label, value, sub, color = 'text-os-text', icon: Icon }: {
  label: string; value: React.ReactNode; sub?: string;
  color?: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-os-muted mt-0.5">{sub}</p>}
    </div>
  );
}

interface GtsStats {
  channel: null | { title: string; memberCount: number | null; inviteLink: string };
  signals: null | {
    total: number;
    lastSignal: string | null;
    recent: Array<{ signal_id: string; direction: string; entry_mid: string; tg_message_id: string | null; created_at: string }>;
    outcomes: { tp1_hits: number; tp2_hits: number; tp3_hits: number; sl_hits: number };
  };
}

function OverviewTab({ botStatus }: { botStatus: BotStatus | null }) {
  const [stats, setStats] = useState<GtsStats | null>(null);
  useEffect(() => {
    const load = () => fetch('/api/gts/stats').then(r => r.json()).then(setStats).catch(() => {});
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, []);

  const pnlColor = (n: number) => n > 0 ? 'text-os-green' : n < 0 ? 'text-os-red' : 'text-os-muted';
  const totalTP = (stats?.signals?.outcomes.tp1_hits || 0) +
                  (stats?.signals?.outcomes.tp2_hits || 0) +
                  (stats?.signals?.outcomes.tp3_hits || 0);
  const totalSig = stats?.signals?.total || 0;
  const winRate = totalSig > 0 ? Math.round((totalTP / (totalSig * 3)) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* GTS Live Stats Strip (real channel + signals) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Channel Subscriber"
          value={stats?.channel?.memberCount ?? '—'}
          sub={stats?.channel?.title || 'GoldTraderSocietySignals'}
          color={(stats?.channel?.memberCount || 0) > 20 ? 'text-os-green' : 'text-os-yellow'}
          icon={Users}
        />
        <StatCard
          label="Signals Total"
          value={totalSig}
          sub={stats?.signals?.lastSignal ? `letzter: ${new Date(stats.signals.lastSignal).toLocaleDateString('de-DE')}` : 'noch keine'}
          color="text-os-yellow"
          icon={Target}
        />
        <StatCard
          label="TP-Hits"
          value={totalTP}
          sub={`TP1: ${stats?.signals?.outcomes.tp1_hits || 0} · TP2: ${stats?.signals?.outcomes.tp2_hits || 0} · TP3: ${stats?.signals?.outcomes.tp3_hits || 0}`}
          color="text-os-green"
          icon={CheckCircle2}
        />
        <StatCard
          label="SL-Hits"
          value={stats?.signals?.outcomes.sl_hits ?? '—'}
          sub={`${winRate}% TP-Rate`}
          color={(stats?.signals?.outcomes.sl_hits || 0) === 0 ? 'text-os-green' : 'text-os-red'}
          icon={Activity}
        />
      </div>

      {/* Recent Signals */}
      {stats?.signals?.recent && stats.signals.recent.length > 0 && (
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
            <Target size={13} className="text-os-yellow" /> Letzte Signale ({stats.signals.recent.length})
          </h3>
          <table className="w-full text-[11px]">
            <thead className="border-b border-os-border text-os-muted text-left">
              <tr>
                <th className="py-2">Signal-ID</th>
                <th>Direction</th>
                <th>Entry</th>
                <th>TG-Msg</th>
                <th className="text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {stats.signals.recent.map(s => (
                <tr key={s.signal_id} className="border-b border-os-border/40">
                  <td className="py-2 font-bold text-os-yellow">{s.signal_id}</td>
                  <td className={s.direction === 'BUY' ? 'text-os-green' : 'text-os-red'}>{s.direction}</td>
                  <td>{parseFloat(s.entry_mid).toFixed(2)}</td>
                  <td className="text-os-muted">{s.tg_message_id ? `#${s.tg_message_id}` : '—'}</td>
                  <td className="text-right text-os-muted">{new Date(s.created_at).toLocaleString('de-DE')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.channel?.inviteLink && (
            <p className="text-[10px] text-os-muted italic mt-3">
              Channel Invite: <a href={stats.channel.inviteLink} target="_blank" rel="noreferrer" className="text-os-cyan hover:underline">{stats.channel.inviteLink}</a>
            </p>
          )}
        </div>
      )}

      {/* MT5/Bot KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Bot Status"
          value={botStatus?.mt5_connected ? 'LIVE' : 'OFFLINE'}
          sub={botStatus ? `${botStatus.open_positions} offene Positionen` : 'Verbinde…'}
          color={botStatus?.mt5_connected ? 'text-os-green' : 'text-os-red'}
          icon={Radio}
        />
        <StatCard
          label="Balance"
          value={botStatus ? `$${botStatus.account_balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })}` : '—'}
          sub="MT5 Account"
          color="text-os-yellow"
          icon={TrendingUp}
        />
        <StatCard
          label="Heute Trades"
          value={botStatus?.today.total_trades ?? '—'}
          sub={botStatus ? `PnL ${botStatus.today.total_pnl >= 0 ? '+$' : '-$'}${Math.abs(botStatus.today.total_pnl).toFixed(2)}` : ''}
          color={botStatus ? pnlColor(botStatus.today.total_pnl) : 'text-os-muted'}
          icon={BarChart3}
        />
        <StatCard
          label="Revenue Ziel"
          value="€1k / Tag"
          sub="via Rebate-Pool"
          color="text-os-yellow"
          icon={Target}
        />
      </div>

      {/* Projekt-Komponenten */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-4 flex items-center gap-2">
          <Layers size={13} className="text-os-yellow" /> Projekt-Komponenten
        </h3>
        <div className="space-y-2">
          {[
            {
              label: 'Gold Bot', sub: 'Auto-Trading · MT5 · Port 8001',
              status: botStatus?.mt5_connected ? 'live' : 'offline',
              icon: Activity,
            },
            {
              label: 'Chart Generator', sub: 'Signal-Grafiken · Port 8080',
              status: 'live', icon: BarChart3,
            },
            {
              label: 'GTS Website', sub: 'goldtradersociety.com · Vercel',
              status: 'live', icon: Globe,
            },
            {
              label: 'Telegram Community', sub: '-1003728330496 · Gold Trader Society Signals',
              status: 'live', icon: MessageSquare,
            },
            {
              label: 'Content Pipeline', sub: 'TikTok / Instagram / Social',
              status: 'planned', icon: Play,
            },
            {
              label: 'Trading Kurs (60 Teile)', sub: 'Rohdaten vorhanden · PDF-Build ausstehend',
              status: 'planned', icon: FileText,
            },
          ].map(({ label, sub, status, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg bg-os-elevated/50 px-3 py-2.5">
              <Icon size={13} className={status === 'live' ? 'text-os-green' : status === 'offline' ? 'text-os-red' : 'text-os-muted'} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-os-text">{label}</p>
                <p className="text-[10px] text-os-muted truncate">{sub}</p>
              </div>
              <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                status === 'live' ? 'bg-os-green/10 text-os-green' :
                status === 'offline' ? 'bg-os-red/10 text-os-red' :
                'bg-os-border/60 text-os-muted'
              }`}>{status === 'planned' ? 'Geplant' : status === 'live' ? 'Live' : 'Offline'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Website', url: GTS_DOMAIN, sub: 'goldtradersociety.com', icon: Globe },
          { label: 'GitHub', url: GTS_GITHUB, sub: 'cwconsulting369-art/goldtradersociety', icon: FileText },
          { label: 'Vercel', url: GTS_VERCEL, sub: 'Deployments', icon: Zap },
        ].map(({ label, url, sub, icon: Icon }) => (
          <a key={label} href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-os-border bg-os-surface p-3 hover:border-os-accent/40 hover:bg-os-elevated transition-colors group">
            <Icon size={14} className="text-os-muted group-hover:text-os-accent transition-colors" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-os-text">{label}</p>
              <p className="text-[10px] text-os-muted truncate">{sub}</p>
            </div>
            <ExternalLink size={11} className="text-os-muted/40 group-hover:text-os-accent transition-colors" />
          </a>
        ))}
      </div>

      {/* Signal Flow */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <Radio size={13} className="text-os-yellow" /> Signal Flow
        </h3>
        <div className="flex items-center gap-1 flex-wrap text-[11px]">
          {[
            { label: 'Source Channel', sub: '-5128775409', color: 'border-os-muted/30 text-os-muted' },
            null,
            { label: 'Gold Bot Parser', sub: 'Risk Check + Lot Sizing', color: 'border-os-yellow/30 text-os-yellow' },
            null,
            { label: 'MT5 Order', sub: 'via HTTP Bridge EA', color: 'border-os-green/30 text-os-green' },
            null,
            { label: 'Chart Generator', sub: 'Port 8080', color: 'border-os-cyan/30 text-os-cyan' },
            null,
            { label: 'GTS Channel', sub: '-1003728330496', color: 'border-os-accent/30 text-os-accent' },
          ].map((item, i) =>
            item === null ? (
              <ChevronRight key={i} size={14} className="text-os-muted/40" />
            ) : (
              <div key={i} className={`rounded-lg border px-2 py-1 ${item.color}`}>
                <p className="font-medium">{item.label}</p>
                <p className="text-[9px] opacity-70">{item.sub}</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Nächste Schritte */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <CheckCircle2 size={13} className="text-os-yellow" /> Nächste Schritte
        </h3>
        <div className="space-y-2">
          {[
            { label: 'GTS Bot als Admin in -1003728330496 adden', done: false },
            { label: 'Ersten Live-Signal durch die Pipeline testen', done: false },
            { label: 'Content-Pipeline aufsetzen (TikTok / Instagram)', done: false },
            { label: '60-Teile Trading-Kurs PDF generieren', done: false },
            { label: 'Website SSH-Key hinterlegen → Clone auf VPS', done: false },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2.5 text-xs">
              <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${done ? 'border-os-green bg-os-green/20' : 'border-os-border'}`}>
                {done && <CheckCircle2 size={10} className="text-os-green" />}
              </div>
              <span className={done ? 'text-os-muted line-through' : 'text-os-text'}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-os-muted mb-3">Roadmap</p>
        <RoadmapPanel path="/home/carlos/personal-os/01-business/gold-trader-society/ROADMAP.md" />
      </div>
    </div>
  );
}

function WebsiteTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-4 flex items-center gap-2">
          <Globe size={13} className="text-os-yellow" /> GTS Website
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Domain', value: 'goldtradersociety.com', color: 'text-os-green' },
            { label: 'Hosting', value: 'Vercel', color: 'text-os-text' },
            { label: 'GitHub Repo', value: 'cwconsulting369-art/goldtradersociety', color: 'text-os-cyan' },
            { label: 'Status', value: 'Live (80% fertig)', color: 'text-os-yellow' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg bg-os-elevated p-3">
              <p className="text-[10px] text-os-muted uppercase tracking-wider">{label}</p>
              <p className={`text-xs font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          <a href={GTS_DOMAIN} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-os-green/30 bg-os-green/10 px-3 py-1.5 text-xs font-medium text-os-green hover:bg-os-green/20 transition-colors">
            <Globe size={12} /> Website öffnen
          </a>
          <a href={GTS_GITHUB} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-elevated transition-colors">
            <FileText size={12} /> GitHub Repo
          </a>
          <a href={GTS_VERCEL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-elevated transition-colors">
            <Zap size={12} /> Vercel Dashboard
          </a>
        </div>
      </div>
      <div className="rounded-xl border border-os-yellow/20 bg-os-yellow/5 p-4">
        <h4 className="text-xs font-medium text-os-yellow mb-2">Offene Website-Tasks</h4>
        <ul className="space-y-1.5 text-xs text-os-muted">
          <li className="flex items-start gap-2"><span className="text-os-yellow mt-0.5">·</span> SSH-Key auf VPS zu GitHub hinzufügen → Repo lokal klonen</li>
          <li className="flex items-start gap-2"><span className="text-os-yellow mt-0.5">·</span> Kundenlogin-Dashboard vervollständigen</li>
          <li className="flex items-start gap-2"><span className="text-os-yellow mt-0.5">·</span> Live Trade-Feed auf Website einbinden</li>
          <li className="flex items-start gap-2"><span className="text-os-yellow mt-0.5">·</span> Lead-Funnel: Free Signals → Premium ($29/Mo)</li>
        </ul>
      </div>
    </div>
  );
}

function ContentTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-4 flex items-center gap-2">
          <Play size={13} className="text-os-yellow" /> Content Pipeline
        </h3>
        <div className="space-y-3">
          {[
            {
              platform: 'TikTok', status: 'planned', target: '3x / Tag',
              desc: 'Live-Trade-Clips + Signal-Breakdowns + P&L-Reveals',
              color: 'text-os-red',
            },
            {
              platform: 'Instagram', status: 'planned', target: '2x / Tag',
              desc: 'Signal-Charts (chart-api) + Performance-Grafiken',
              color: 'text-os-accent',
            },
            {
              platform: 'Telegram GTS', status: 'live', target: 'Bei jedem Signal',
              desc: 'Auto-Chart-Post via chart-api + GTS Bot (port 8080)',
              color: 'text-os-cyan',
            },
            {
              platform: 'YouTube Shorts', status: 'planned', target: '1x / Tag',
              desc: 'Screen-Recording Trade-Entries mit Erklärung',
              color: 'text-os-yellow',
            },
          ].map(({ platform, status, target, desc, color }) => (
            <div key={platform} className="flex items-start gap-3 rounded-lg border border-os-border/50 bg-os-elevated/50 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold ${color}`}>{platform}</span>
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${status === 'live' ? 'bg-os-green/10 text-os-green' : 'bg-os-border/60 text-os-muted'}`}>
                    {status === 'live' ? 'Live' : 'Geplant'}
                  </span>
                  <span className="text-[10px] text-os-muted ml-auto">{target}</span>
                </div>
                <p className="text-[11px] text-os-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <Clock size={13} className="text-os-yellow" /> Content Workflow (geplant)
        </h3>
        <div className="flex items-center gap-1 flex-wrap text-[11px]">
          {[
            'Signal feuert',
            'Chart generiert (DE/EN)',
            'TG GTS-Channel',
            'Screenshot → Clip-Tool',
            'TikTok / Insta',
          ].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-1">
              <span className="rounded-lg border border-os-border/50 bg-os-elevated px-2 py-1 text-os-muted">{step}</span>
              {i < arr.length - 1 && <ChevronRight size={12} className="text-os-muted/40" />}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-os-muted mt-3">Make-Workflow aufsetzen: Signal → Chart → Auto-Post TikTok/Insta via Zapier/Make.</p>
      </div>
    </div>
  );
}

interface SyncBoard {
  blueprints: Array<{ name: string; mtime: string; size: number }>;
  submissions: Array<{ name: string; isDir: boolean; mtime: string }>;
  bots: Array<{ name: string; status: string; uptime: number; memory: number; restarts: number }>;
  web: null | { state: string; url: string; deployedAt: string; branch: string; commit: string };
  generatedAt: string;
}

function SyncTab() {
  const [data, setData] = useState<SyncBoard | null>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    const load = () => fetch('/api/gts/board').then(r => r.json()).then(setData).catch(e => setErr(String(e)));
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  if (err) return <div className="text-os-red text-sm">{err}</div>;
  if (!data) return <div className="text-os-muted text-sm">lädt…</div>;

  const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  const fmtUptime = (ms: number) => {
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  return (
    <div className="space-y-5">
      {/* Kevin Status Strip */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-os-text flex items-center gap-2">
            <Users size={13} className="text-os-yellow" /> Kevin (K3ngama) — Live Sync
          </h3>
          <a href="https://kevin.lennoxos.com" target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1 text-[11px] text-os-muted hover:text-os-text">
            <ExternalLink size={11} /> Kevin-OS
          </a>
        </div>
        <p className="text-[11px] text-os-muted">
          Single Source of Truth — diese Daten lesen Kevin-OS UND lennox-os.
          Aktualisiert {fmt(data.generatedAt)}.
        </p>
      </div>

      {/* Grid: Blueprints + Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Blueprints */}
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
            <FileText size={13} className="text-os-yellow" /> Blueprints ({data.blueprints.length})
          </h3>
          {data.blueprints.length === 0 ? (
            <p className="text-[11px] text-os-muted italic">Keine offenen Tasks</p>
          ) : (
            <ul className="space-y-1">
              {data.blueprints.map(b => (
                <li key={b.name} className="flex justify-between items-center text-[12px] py-1 px-2 rounded hover:bg-os-elevated">
                  <span className="text-os-text">📋 {b.name}</span>
                  <span className="text-[10px] text-os-muted">{fmt(b.mtime)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Submissions */}
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
            <CheckCircle2 size={13} className="text-os-green" /> Submissions ({data.submissions.length})
          </h3>
          {data.submissions.length === 0 ? (
            <p className="text-[11px] text-os-muted italic">Noch keine Submissions</p>
          ) : (
            <ul className="space-y-1">
              {data.submissions.map(s => (
                <li key={s.name} className="flex justify-between items-center text-[12px] py-1 px-2 rounded hover:bg-os-elevated">
                  <span className="text-os-text">{s.isDir ? '📦' : '📄'} {s.name}</span>
                  <span className="text-[10px] text-os-muted">{fmt(s.mtime)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Services */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <Activity size={13} className="text-os-yellow" /> Kevin Services ({data.bots.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {data.bots.map(b => (
            <div key={b.name} className="rounded-lg border border-os-border bg-os-elevated p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-os-text">{b.name}</span>
                <span className={`flex items-center gap-1 text-[9px] font-bold ${b.status === 'online' ? 'text-os-green' : 'text-os-red'}`}>
                  <Radio size={8} /> {b.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[9px] text-os-muted">↑ {fmtUptime(b.uptime)} · ↻ {b.restarts}</p>
              <p className="text-[9px] text-os-muted">RAM {Math.round(b.memory / 1024 / 1024)}MB</p>
            </div>
          ))}
        </div>
      </div>

      {/* Vercel Deployment */}
      {data.web && (
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
            <Globe size={13} className="text-os-yellow" /> Website Deployment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div>
              <p className="text-os-muted">State</p>
              <p className={`font-bold ${data.web.state === 'READY' ? 'text-os-green' : 'text-os-yellow'}`}>{data.web.state}</p>
            </div>
            <div>
              <p className="text-os-muted">Branch</p>
              <p className="font-bold text-os-text">{data.web.branch}</p>
            </div>
            <div>
              <p className="text-os-muted">Deployed</p>
              <p className="font-bold text-os-text">{fmt(data.web.deployedAt)}</p>
            </div>
          </div>
          <p className="text-[10px] text-os-muted mt-3 italic">{data.web.commit}</p>
        </div>
      )}
    </div>
  );
}

export default function GoldTraderSociety() {
  const [tab, setTab] = useState<'overview' | 'sync' | 'bot' | 'website' | 'content'>('overview');
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);

  useEffect(() => {
    const load = () => {
      fetch('/api/goldbot/live')
        .then(r => r.json())
        .then(d => setBotStatus(d))
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: Layers },
    { id: 'sync', label: 'Kevin Sync', icon: Users },
    { id: 'bot', label: 'Gold Bot', icon: Activity },
    { id: 'website', label: 'Website', icon: Globe },
    { id: 'content', label: 'Content', icon: Play },
  ] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-yellow/10">
              <span className="text-lg">🥇</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-os-text leading-tight">Gold Trader Society</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-os-muted">goldtradersociety.com</span>
                <span className={`flex items-center gap-1 text-[10px] font-bold ${botStatus?.mt5_connected ? 'text-os-green' : 'text-os-muted'}`}>
                  <Radio size={9} /> {botStatus?.mt5_connected ? 'BOT LIVE' : 'BOT OFFLINE'}
                </span>
              </div>
            </div>
          </div>
          <a href={GTS_DOMAIN} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors">
            <ExternalLink size={12} /> Website
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-os-border pb-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-os-yellow text-os-yellow'
                  : 'border-transparent text-os-muted hover:text-os-text'
              }`}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' && (
          <div className="p-6">
            <OverviewTab botStatus={botStatus} />
          </div>
        )}
        {tab === 'sync' && (
          <div className="p-6">
            <SyncTab />
          </div>
        )}
        {tab === 'bot' && <GoldBotDashboard />}
        {tab === 'website' && (
          <div className="p-6">
            <WebsiteTab />
          </div>
        )}
        {tab === 'content' && (
          <div className="p-6">
            <ContentTab />
          </div>
        )}
      </div>
    </div>
  );
}
