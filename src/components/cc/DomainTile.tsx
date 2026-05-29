import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

export type DomainColor = 'crimson' | 'emerald' | 'violet' | 'amber' | 'info' | 'rose';

const DOMAIN_RGB: Record<DomainColor, string> = {
  crimson: '255,43,58',
  emerald: '74,222,128',
  violet: '167,139,250',
  amber: '245,158,11',
  info: '96,165,250',
  rose: '244,114,182',
};

interface DomainTileProps {
  label: string;
  icon: LucideIcon;
  color?: DomainColor;
  /** small status text top-right (e.g. "live", "30d") */
  badge?: ReactNode;
  /** click → navigate to the deep section */
  onOpen?: () => void;
  error?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Uniform bento tile. Quiet domain-color icon-chip + uppercase mono label.
 * Card stays dark; domain color is an accent, never a background flood.
 */
export default function DomainTile({ label, icon: Icon, color = 'crimson', badge, onOpen, error, className, children }: DomainTileProps) {
  const rgb = DOMAIN_RGB[color];
  return (
    <div
      className={`cc-tile group ${onOpen ? 'cc-tile--clickable' : ''} ${className ?? ''}`}
      onClick={onOpen}
      style={{ ['--tile-rgb' as string]: rgb }}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
    >
      <div className="cc-tile__head">
        <span className="cc-tile__chip" style={{ background: `rgba(${rgb},0.12)`, color: `rgb(${rgb})`, boxShadow: `0 0 12px rgba(${rgb},0.25)` }}>
          <Icon size={13} />
        </span>
        <span className="cc-tile__label">{label}</span>
        <div className="cc-tile__badge">
          {error ? <span className="cc-tile__err">offline</span> : badge}
          {onOpen && <ArrowUpRight size={13} className="cc-tile__open" />}
        </div>
      </div>
      <div className="cc-tile__body">{children}</div>
    </div>
  );
}

/* ---- Reusable sub-stat (label + big tabular value) ---- */
export function Stat({ label, children, accent }: { label: string; children: ReactNode; accent?: string }) {
  return (
    <div className="cc-stat">
      <div className="cc-stat__label">{label}</div>
      <div className="cc-stat__value" style={accent ? { color: accent } : undefined}>{children}</div>
    </div>
  );
}

/* ---- Tiny status pill ---- */
export function Pill({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'err' | 'neutral' | 'accent'; children: ReactNode }) {
  return <span className={`cc-pill cc-pill--${tone}`}>{children}</span>;
}
