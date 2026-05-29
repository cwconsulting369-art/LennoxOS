import { Server } from 'lucide-react';
import type { ServiceRow } from '../../lib/cc-api';

/**
 * Dense pm2 service status grid (NOC-style). Errored/stopped float to top.
 * One cell per process: status dot + name + restart count.
 */
export default function ServicesGrid({ services, onOpen }: { services: ServiceRow[]; onOpen?: () => void }) {
  const sorted = [...services].sort((a, b) => {
    const rank = (s: ServiceRow) => (s.status === 'online' ? 1 : 0);
    return rank(a) - rank(b) || b.restarts - a.restarts;
  });
  const online = services.filter((s) => s.status === 'online').length;
  const down = services.length - online;

  return (
    <div className={`cc-tile ${onOpen ? 'cc-tile--clickable' : ''}`} style={{ ['--tile-rgb' as string]: '96,165,250' }} onClick={onOpen} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}>
      <div className="cc-tile__head">
        <span className="cc-tile__chip" style={{ background: 'rgba(96,165,250,0.12)', color: 'rgb(96,165,250)' }}><Server size={13} /></span>
        <span className="cc-tile__label">Services · pm2</span>
        <div className="cc-tile__badge">
          <span className="cc-pill cc-pill--ok">{online} up</span>
          {down > 0 && <span className="cc-pill cc-pill--err">{down} down</span>}
        </div>
      </div>
      <div className="cc-svc-grid">
        {sorted.map((s) => {
          const tone = s.status === 'online' ? (s.restarts > 5 ? 'warn' : 'ok') : 'err';
          return (
            <div key={s.id} className="cc-svc-cell" title={`${s.name} · ${s.status} · ${s.restarts} restarts`}>
              <span className={`cc-dot cc-dot--${tone}`} />
              <span className="cc-svc-name">{s.name}</span>
              {s.restarts > 0 && <span className="cc-svc-r">↺{s.restarts}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
