import { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, Server, Bot, Flame, AlertTriangle, type LucideIcon } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

export interface HealthMetric {
  icon: LucideIcon;
  label: string;
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  tone: 'ok' | 'warn' | 'err' | 'neutral';
  hint?: string;
}

interface HealthStripProps {
  metrics: HealthMetric[];
  /** overall system tier indicators (one dot each), green→red */
  systemDots: Array<'ok' | 'warn' | 'err'>;
  loading: boolean;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export const HEALTH_ICONS = { Activity, Cpu, HardDrive, Server, Bot, Flame, AlertTriangle };

export default function HealthStrip({ metrics, systemDots, loading }: HealthStripProps) {
  const now = useClock();
  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Berlin' });
  const date = now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Europe/Berlin' });
  const allOk = systemDots.every((d) => d === 'ok');
  const anyErr = systemDots.some((d) => d === 'err');

  return (
    <div className="cc-health">
      <div className="cc-health__brand">
        <div className="cc-health__logo">
          <span>L</span>
          <span className="lx-pulse cc-health__heart" />
        </div>
        <div>
          <div className="cc-health__title">LENNOXOS</div>
          <div className="cc-health__sub">War Room · Motor + Logik</div>
        </div>
      </div>

      <div className="cc-health__metrics">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="cc-health__metric" title={m.hint}>
              <Icon size={15} className={`cc-health__micon cc-health__micon--${m.tone}`} />
              <div className="cc-health__mtext">
                <div className="cc-health__mval">
                  {loading ? '—' : <AnimatedNumber value={m.value} decimals={m.decimals ?? 0} prefix={m.prefix} suffix={m.suffix} />}
                </div>
                <div className="cc-health__mlabel">{m.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cc-health__status">
        <div className="cc-health__clock">
          <span className="cc-health__time">{time}</span>
          <span className="cc-health__date">{date}</span>
        </div>
        <div className={`cc-health__systems ${anyErr ? 'is-err' : allOk ? 'is-ok' : 'is-warn'}`}>
          <span className="cc-health__systems-label">{anyErr ? 'Alert' : allOk ? 'Alle Systeme' : 'Teilstörung'}</span>
          <div className="cc-health__dots">
            {systemDots.map((d, i) => (
              <span key={i} className={`cc-dot cc-dot--${d}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
