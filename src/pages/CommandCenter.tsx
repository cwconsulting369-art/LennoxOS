import { DollarSign, Cpu, Layers, Lightbulb, Server, Zap, TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { useApi } from '../hooks/useApi';
import HealthStrip, { HEALTH_ICONS, type HealthMetric } from '../components/cc/HealthStrip';
import LiveTicker from '../components/cc/LiveTicker';
import MomentumBand from '../components/cc/MomentumBand';
import DomainTile, { Stat, Pill } from '../components/cc/DomainTile';
import ServicesGrid from '../components/cc/ServicesGrid';
import OperationsDeck from '../components/cc/OperationsDeck';
import Sparkline from '../components/cc/Sparkline';
import Gauge from '../components/cc/Gauge';
import AnimatedNumber from '../components/cc/AnimatedNumber';
import { fmt } from '../lib/cc-api';
import type {
  MonitorData, MasterOverview, HermesCostSummary, HermesCostDaily,
  RegistryStats, IdeasStats, ServiceRow, FinanceOverview,
} from '../lib/cc-api';

type Nav = (section: string) => void;

function diskPct(d?: MonitorData['disk']): number {
  if (!d?.pct) return 0;
  return parseInt(d.pct.replace('%', ''), 10) || 0;
}

export default function CommandCenter({ onNavigate }: { onNavigate: Nav }) {
  const monitor = useApi<MonitorData>('/api/monitor', 5_000);
  const master = useApi<MasterOverview>('/api/master/overview', 30_000);
  const hermes = useApi<HermesCostSummary>('/api/hermes/cost-summary', 20_000);
  const hermesDaily = useApi<HermesCostDaily>('/api/hermes/cost-daily?days=14', 60_000);
  const registry = useApi<RegistryStats>('/api/registry/stats', 30_000);
  const ideas = useApi<IdeasStats>('/api/ideas/stats', 30_000);
  const services = useApi<ServiceRow[]>('/api/services', 15_000);
  const finance = useApi<FinanceOverview>('/api/finance/overview', 60_000);
  const today = useApi<{ content: string }>('/api/today', 120_000);

  /* ---------- derived ---------- */
  const m = monitor.data;
  const ramPct = m ? (m.memory.used / m.memory.total) * 100 : 0;
  const dPct = diskPct(m?.disk);

  const svc = services.data ?? [];
  const svcOnline = svc.filter((s) => s.status === 'online').length;
  const svcErr = svc.filter((s) => s.status === 'errored' || s.status === 'stopped').length;
  const svcTotal = svc.length || master.data?.services.total || 0;

  const agentsActive = registry.data?.by_status.active ?? 0;
  const agentsErr = registry.data?.by_status.error ?? 0;
  const agentsPlanned = registry.data?.by_status.planned ?? 0;
  const agentsTotal = registry.data?.total ?? 0;

  const burnToday = hermes.data?.today.cost_cents ?? 0;
  const burnMonth = hermes.data?.month.cost_cents ?? 0;
  const runsToday = hermes.data?.today.runs ?? 0;
  const succToday = hermes.data?.today.success ?? 0;
  const failToday = hermes.data?.today.failed ?? 0;
  const successRate = runsToday > 0 ? (succToday / runsToday) * 100 : 100;
  const costSeries = (hermesDaily.data?.items ?? []).map((i) => i.total_cents);
  const runsSeries = (hermesDaily.data?.items ?? []).map((i) => i.runs);

  const vercelCount = master.data?.vercel.total ?? 0;
  const osHealth = master.data?.osHealth ?? [];
  const mrr = master.data?.cashflow.mrr.mrr ?? 0;

  const financeProjects = (finance.data?.buckets.projects ?? [])
    .filter((p) => p.cost_30d > 0)
    .sort((a, b) => b.cost_30d - a.cost_30d)
    .slice(0, 5);
  const financeMax = financeProjects[0]?.cost_30d ?? 1;
  const serversEur = (finance.data?.buckets as { infra?: { servers_eur?: number } } | undefined)?.infra?.servers_eur ?? 0;

  /* ---------- health strip ---------- */
  const tone = (v: number, warn: number, danger: number): 'ok' | 'warn' | 'err' =>
    v >= danger ? 'err' : v >= warn ? 'warn' : 'ok';

  const metrics: HealthMetric[] = [
    { icon: HEALTH_ICONS.HardDrive, label: 'Disk', value: dPct, suffix: '%', tone: tone(dPct, 70, 88), hint: m ? `${m.disk.used} / ${m.disk.total}` : '' },
    { icon: HEALTH_ICONS.Cpu, label: 'RAM', value: ramPct, suffix: '%', tone: tone(ramPct, 75, 90), hint: m ? `${fmt.bytesGB(m.memory.used)} / ${fmt.bytesGB(m.memory.total)}` : '' },
    { icon: HEALTH_ICONS.Activity, label: 'Load', value: m?.cpu.loadPct ?? 0, suffix: '%', tone: tone(m?.cpu.loadPct ?? 0, 70, 90), hint: m ? `1m ${m.loadAvg['1m']}` : '' },
    { icon: HEALTH_ICONS.Server, label: 'Services', value: svcOnline, suffix: `/${svcTotal}`, tone: svcErr > 0 ? 'err' : 'ok', hint: `${svcErr} errored/stopped` },
    { icon: HEALTH_ICONS.Bot, label: 'Agents', value: agentsActive, suffix: `/${agentsTotal}`, tone: agentsErr > 0 ? 'warn' : 'ok', hint: `${agentsErr} error · ${agentsPlanned} planned` },
    { icon: HEALTH_ICONS.Flame, label: 'Burn heute', value: burnToday / 100, decimals: 2, prefix: '$', tone: 'neutral' as const, hint: `Monat ${fmt.cents(burnMonth)}` },
  ];

  const systemDots: Array<'ok' | 'warn' | 'err'> = [
    svcErr > 0 ? 'err' : 'ok',
    agentsErr > 0 ? 'warn' : 'ok',
    tone(dPct, 70, 88),
    tone(ramPct, 75, 90),
    failToday > 0 ? 'warn' : 'ok',
  ];

  const healthLoading = monitor.loading && !monitor.loaded;

  return (
    <div className="cc-root">
      <HealthStrip metrics={metrics} systemDots={systemDots} loading={healthLoading} />
      <MomentumBand onOpen={() => onNavigate('momentum')} />

      <div className="cc-layout">
        {/* ===== Main column ===== */}
        <div className="cc-main">
        <div className="cc-bento">
          {/* FINANCE */}
          <DomainTile label="Finance" icon={DollarSign} color="emerald" badge={<span className="cc-badge-dim">30d</span>} onOpen={() => onNavigate('finance')} error={finance.error && !finance.loaded}>
            <div className="cc-row-2">
              <Stat label="MRR (real)" accent={mrr > 0 ? 'var(--status-success)' : 'var(--text-muted)'}>
                <AnimatedNumber value={mrr} prefix="€" />
              </Stat>
              <Stat label="Server / Monat">
                <AnimatedNumber value={serversEur} decimals={0} prefix="€" />
              </Stat>
            </div>
            <div className="cc-bars">
              <div className="cc-bars__title">Claude-Last 30d · Anteil</div>
              {financeProjects.map((p) => (
                <div key={p.project} className="cc-bar">
                  <span className="cc-bar__label">{p.project}</span>
                  <div className="cc-bar__track">
                    <div className="cc-bar__fill" style={{ width: `${(p.cost_30d / financeMax) * 100}%`, background: 'linear-gradient(90deg, rgba(74,222,128,0.5), rgba(74,222,128,0.9))' }} />
                  </div>
                </div>
              ))}
            </div>
          </DomainTile>

          {/* HERMES */}
          <DomainTile label="Hermes Schwarm" icon={Cpu} color="crimson" badge={<Pill tone={failToday > 0 ? 'warn' : 'ok'}>{fmt.pct(successRate)} ok</Pill>} onOpen={() => onNavigate('hermes')} error={hermes.error && !hermes.loaded}>
            <div className="cc-row-2">
              <Stat label="Runs heute"><AnimatedNumber value={runsToday} /></Stat>
              <Stat label="Kosten heute"><AnimatedNumber value={burnToday / 100} decimals={2} prefix="$" /></Stat>
            </div>
            <div className="cc-spark-block">
              <div className="cc-spark-row">
                <span className="cc-spark-cap">Kosten 14d</span>
                <Sparkline data={costSeries} width={150} height={34} color="var(--accent-glow)" />
              </div>
              <div className="cc-spark-row">
                <span className="cc-spark-cap">Runs 14d</span>
                <Sparkline data={runsSeries} width={150} height={34} color="var(--status-info)" fill={false} />
              </div>
            </div>
          </DomainTile>

          {/* AGENTS */}
          <DomainTile label="Agent Registry" icon={Layers} color="violet" badge={<span className="cc-badge-dim">{agentsTotal} total</span>} onOpen={() => onNavigate('agents')} error={registry.error && !registry.loaded}>
            <div className="cc-row-3">
              <Stat label="Aktiv" accent="var(--status-success)"><AnimatedNumber value={agentsActive} /></Stat>
              <Stat label="Error" accent={agentsErr > 0 ? 'var(--status-danger)' : 'var(--text-muted)'}><AnimatedNumber value={agentsErr} /></Stat>
              <Stat label="Geplant"><AnimatedNumber value={agentsPlanned} /></Stat>
            </div>
            <div className="cc-chips">
              {Object.entries(registry.data?.by_project ?? {}).map(([proj, n]) => (
                <span key={proj} className="cc-chip"><span className="cc-chip__n">{n}</span>{proj}</span>
              ))}
            </div>
          </DomainTile>

          {/* IDEAS */}
          <DomainTile label="Idea Factory" icon={Lightbulb} color="amber" badge={ideas.data && ideas.data.offen_hoch > 0 ? <Pill tone="accent">{ideas.data.offen_hoch} hoch</Pill> : undefined} onOpen={() => onNavigate('ideas')} error={ideas.error && !ideas.loaded}>
            <div className="cc-row-2">
              <Stat label="Gesamt"><AnimatedNumber value={ideas.data?.total ?? 0} /></Stat>
              <Stat label="Backlog (neu+arbeit)" accent="var(--status-warning)">
                <AnimatedNumber value={(ideas.data?.neu ?? 0) + (ideas.data?.in_arbeit ?? 0)} />
              </Stat>
            </div>
            <div className="cc-mini-legend">
              <span><CheckCircle2 size={11} className="cc-ic-ok" /> {ideas.data?.erledigt ?? 0} erledigt</span>
              <span><XCircle size={11} className="cc-ic-muted" /> {ideas.data?.verworfen ?? 0} verworfen</span>
              <span><Layers size={11} className="cc-ic-muted" /> {ideas.data?.duplicates ?? 0} dup</span>
            </div>
          </DomainTile>

          {/* INFRA */}
          <DomainTile label="Infrastructure" icon={Server} color="info" badge={<span className="cc-badge-dim">VPS · pm2</span>} onOpen={() => onNavigate('infra')} error={monitor.error && !monitor.loaded}>
            <div className="cc-gauges">
              <Gauge value={dPct} label="Disk" sublabel={m ? `${m.disk.free} frei` : ''} />
              <Gauge value={ramPct} label="RAM" warnAt={75} dangerAt={90} />
              <Gauge value={m?.cpu.loadPct ?? 0} label="Load" warnAt={70} dangerAt={90} />
            </div>
            <div className="cc-infra-foot">
              <span><Server size={11} /> {svcOnline}/{svcTotal} online</span>
              {svcErr > 0 ? <span className="cc-ic-err"><XCircle size={11} /> {svcErr} down</span> : <span className="cc-ic-ok"><CheckCircle2 size={11} /> stabil</span>}
              {m && <span><Clock size={11} /> {fmt.uptime(m.uptime)}</span>}
            </div>
          </DomainTile>

          {/* CUSTOMERS / AEVUM */}
          <DomainTile label="AEVUM · Customers" icon={Zap} color="rose" badge={<span className="cc-badge-dim">{vercelCount} deploys</span>} onOpen={() => onNavigate('aevum')} error={master.error && !master.loaded}>
            <div className="cc-row-2">
              <Stat label="Sub-OS Health"><AnimatedNumber value={osHealth.length} /></Stat>
              <Stat label="Vercel Live"><AnimatedNumber value={vercelCount} /></Stat>
            </div>
            <div className="cc-oslist">
              {osHealth.slice(0, 6).map((o) => (
                <span key={o.id} className="cc-chip"><span className="cc-dot cc-dot--ok" />{o.name}</span>
              ))}
            </div>
          </DomainTile>

          {/* SERVICES GRID (spans wide) */}
          <div className="cc-span-2">
            <ServicesGrid services={svc} onOpen={() => onNavigate('infra')} />
          </div>
        </div>

        <OperationsDeck onNavigate={onNavigate} />
        </div>

        {/* ===== Right rail ===== */}
        <aside className="cc-rail">
          <LiveTicker />
          <div className="cc-today">
            <div className="cc-tile__head cc-today__head">
              <span className="cc-tile__chip" style={{ background: 'rgba(255,43,58,0.12)', color: 'rgb(255,43,58)' }}><TrendingUp size={13} /></span>
              <span className="cc-tile__label">Heute</span>
            </div>
            <div className="cc-today__body">
              {today.error && !today.loaded && <div className="cc-ticker__empty">Briefing nicht verfügbar</div>}
              {today.data?.content && <MarkdownViewer content={today.data.content} />}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
