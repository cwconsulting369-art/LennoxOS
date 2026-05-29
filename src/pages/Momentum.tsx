import { Flame, Target, GitCommitHorizontal, AlertTriangle, ArrowRight } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import MomentumHeatmap from '../components/cc/MomentumHeatmap';
import AnimatedNumber from '../components/cc/AnimatedNumber';
import type { MomentumData, MomentumProject, MomentumStatus } from '../lib/cc-api';

const STATUS_LABEL: Record<MomentumStatus, string> = {
  hot: 'heiß', warm: 'aktiv', cool: 'kühlt ab', idle: 'liegt', stale: 'verwaist', none: 'kein Repo',
};
const STATUS_TONE: Record<MomentumStatus, 'ok' | 'warn' | 'err' | 'neutral' | 'accent'> = {
  hot: 'ok', warm: 'ok', cool: 'warn', idle: 'warn', stale: 'err', none: 'neutral',
};
const SEVERITY: Record<MomentumStatus, number> = { stale: 5, none: 4, idle: 3, cool: 2, warm: 1, hot: 0 };

function ProjectCard({ p }: { p: MomentumProject }) {
  const tone = STATUS_TONE[p.status];
  return (
    <div className={`cc-tile cc-mom-card cc-mom-card--${tone}`}>
      <div className="cc-mom-top">
        <span className={`cc-dot cc-dot--${tone === 'accent' ? 'neutral' : tone}`} />
        <span className="cc-mom-name">{p.label}</span>
        <span className={`cc-pill cc-pill--${tone === 'neutral' ? 'neutral' : tone}`}>{STATUS_LABEL[p.status]}</span>
        <span className="cc-mom-last">{p.lastRel ?? '—'}</span>
      </div>

      {p.phase && <div className="cc-mom-phase">{p.phase}</div>}

      <div className="cc-mom-heat">
        <MomentumHeatmap daily={p.daily} />
        <div className="cc-mom-counts">
          <span><b>{p.d7}</b> 7d</span>
          <span><b>{p.d14}</b> 14d</span>
        </div>
      </div>

      {p.nextAction ? (
        <div className="cc-mom-next">
          <ArrowRight size={13} className="cc-mom-next__ic" />
          <span>{p.nextAction}</span>
        </div>
      ) : (
        <div className="cc-mom-next cc-mom-next--empty">
          <AlertTriangle size={12} /> kein nächster Schritt definiert
        </div>
      )}
    </div>
  );
}

export default function Momentum() {
  const mom = useApi<MomentumData>('/api/momentum', 60_000);
  const d = mom.data;

  const sorted = [...(d?.projects ?? [])].sort((a, b) =>
    SEVERITY[b.status] - SEVERITY[a.status] || a.prio - b.prio || a.d14 - b.d14
  );
  const needs = sorted.filter((p) => ['stale', 'none', 'idle', 'cool'].includes(p.status));
  const running = sorted
    .filter((p) => ['warm', 'hot'].includes(p.status))
    .sort((a, b) => b.today - a.today || b.d14 - a.d14);

  return (
    <div className="cc-root">
      {/* ===== Momentum header ===== */}
      <div className="cc-mom-hero">
        <div className="cc-mom-hero__streak">
          <Flame size={26} className="cc-mom-flame" />
          <div>
            <div className="cc-mom-hero__big"><AnimatedNumber value={d?.streak ?? 0} /></div>
            <div className="cc-mom-hero__cap">Tage Streak</div>
          </div>
        </div>
        <div className="cc-mom-hero__div" />
        <div className="cc-mom-hero__stat">
          <div className="cc-mom-hero__big">
            <AnimatedNumber value={d?.touchedToday ?? 0} /><span className="cc-mom-hero__of">/{d?.totalProjects ?? 0}</span>
          </div>
          <div className="cc-mom-hero__cap">heute bewegt</div>
        </div>
        <div className="cc-mom-hero__stat">
          <div className="cc-mom-hero__big"><AnimatedNumber value={d?.totalCommits14d ?? 0} /></div>
          <div className="cc-mom-hero__cap"><GitCommitHorizontal size={11} /> Commits · 14 Tage</div>
        </div>
        <div className="cc-mom-hero__msg">
          {d && d.touchedToday === 0 && <span>Heute noch nichts bewegt — pack ein Projekt aus „Braucht dich".</span>}
          {d && d.touchedToday > 0 && d.touchedToday < d.totalProjects && <span>{d.touchedToday} bewegt. Schnapp dir noch eins von oben — klein reicht.</span>}
          {d && d.touchedToday >= d.totalProjects && <span>Alle bewegt. Sauber.</span>}
        </div>
      </div>

      {/* ===== Needs attention ===== */}
      <div className="cc-ops">
        <div className="cc-zone-title"><Target size={13} className="cc-zone-title__ic" />Braucht dich · {needs.length}</div>
        <div className="cc-mom-grid">
          {needs.map((p) => <ProjectCard key={p.key} p={p} />)}
          {needs.length === 0 && <div className="cc-ticker__empty">Nichts vernachlässigt — alles in Bewegung 🔥</div>}
        </div>
      </div>

      {/* ===== Running ===== */}
      <div className="cc-ops">
        <div className="cc-zone-title"><Flame size={13} className="cc-zone-title__ic" />Läuft · {running.length}</div>
        <div className="cc-mom-grid">
          {running.map((p) => <ProjectCard key={p.key} p={p} />)}
        </div>
      </div>
    </div>
  );
}
