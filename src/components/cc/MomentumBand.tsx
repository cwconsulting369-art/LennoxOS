import { Flame, ChevronRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import type { MomentumData, MomentumStatus } from '../../lib/cc-api';

const DOT: Record<MomentumStatus, string> = {
  hot: 'ok', warm: 'ok', cool: 'warn', idle: 'warn', stale: 'err', none: 'neutral',
};

/**
 * Slim momentum band for the War Room landing. Shows streak + today-touched
 * + a per-project mini heatmap so progress is the FIRST thing seen, never buried.
 */
export default function MomentumBand({ onOpen }: { onOpen: () => void }) {
  const mom = useApi<MomentumData>('/api/momentum', 60_000);
  const d = mom.data;
  if (mom.error && !d) return null;

  const projects = [...(d?.projects ?? [])].sort((a, b) => b.today - a.today || b.d14 - a.d14);

  return (
    <div className="cc-mband" onClick={onOpen} role="button" tabIndex={0}>
      <div className="cc-mband__lead">
        <Flame size={16} className="cc-mom-flame" />
        <div className="cc-mband__streak"><b>{d?.streak ?? 0}</b><span>Tage</span></div>
        <div className="cc-mband__today">{d?.touchedToday ?? 0}/{d?.totalProjects ?? 0}<span>heute</span></div>
      </div>
      <div className="cc-mband__projects">
        {projects.map((p) => (
          <div key={p.key} className="cc-mband__proj" title={`${p.label} · ${p.lastRel ?? '—'} · ${p.d14} commits/14d`}>
            <span className={`cc-dot cc-dot--${DOT[p.status]}`} />
            <span className="cc-mband__pname">{p.label}</span>
            <div className="cc-mband__spark">
              {p.daily.slice(-10).map((n, i) => (
                <span key={i} className="cc-mband__cell" style={{ opacity: n === 0 ? 0.18 : Math.min(1, 0.35 + n / 8) }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <ChevronRight size={16} className="cc-mband__more" />
    </div>
  );
}
