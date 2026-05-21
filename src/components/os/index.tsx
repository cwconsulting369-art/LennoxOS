// OS-Standard Component Library
// Shared building blocks for all OS-Sub-Dashboards (Master, GTS, UH, AEVUM, K3ngama, Personal, Thailand, Script Factory)
// Memory ref: project_os_standard_template_2026_05_21
import { ReactNode } from 'react';
import { ExternalLink, Wifi, WifiOff, RefreshCw } from 'lucide-react';

// ─── KpiCard ─────────────────────────────────────────────────────────────
export interface KpiProps {
  icon?: React.ElementType;
  label: string;
  value: ReactNode;
  sub?: string;
  color?: string;          // tailwind text color class, e.g. 'text-os-yellow'
}

export function KpiCard({ icon: Icon, label, value, sub, color = 'text-os-text' }: KpiProps) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-os-muted">{label}</p>
        {Icon && <Icon size={13} className={color} />}
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-os-muted mt-1">{sub}</p>}
    </div>
  );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────
export function KpiStrip({ items }: { items: KpiProps[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(i => <KpiCard key={i.label} {...i} />)}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────
export function Panel({ title, icon: Icon, right, children, className = '' }: {
  title: string;
  icon?: React.ElementType;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-os-border bg-os-surface p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-os-text flex items-center gap-2">
          {Icon && <Icon size={13} className="text-os-yellow" />} {title}
        </h3>
        {right && <span className="text-[10px] text-os-muted">{right}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: 'live' | 'down' | 'checking' | 'unknown' | string }) {
  const cfg = {
    live:     { color: 'text-os-green', icon: Wifi,    label: 'LIVE' },
    down:     { color: 'text-os-red',   icon: WifiOff, label: 'DOWN' },
    checking: { color: 'text-os-muted', icon: RefreshCw, label: '...' },
    unknown:  { color: 'text-os-muted', icon: WifiOff, label: '?' },
  }[status] || { color: 'text-os-muted', icon: WifiOff, label: status.toUpperCase() };

  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold ${cfg.color}`}>
      <Icon size={9} className={status === 'checking' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
}

// ─── OSHeader ─────────────────────────────────────────────────────────────
export function OSHeader({
  emoji, title, sub, status, externalUrl, onRefresh, refreshing,
}: {
  emoji?: string;
  title: string;
  sub?: string;
  status?: 'live' | 'down' | 'checking';
  externalUrl?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        {emoji && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-cyan/10">
            <span className="text-base">{emoji}</span>
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold text-os-text leading-tight">{title}</h1>
          {sub && (
            <p className="text-[10px] text-os-muted flex items-center gap-2">
              {sub}
              {status && <StatusBadge status={status} />}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button onClick={onRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-os-muted hover:text-os-cyan transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        )}
        {externalUrl && (
          <a href={externalUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors">
            <ExternalLink size={12} /> Open
          </a>
        )}
      </div>
    </div>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────
export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ElementType;
}

export function TabBar<T extends string>({
  tabs, active, onChange, color = 'os-cyan',
}: {
  tabs: ReadonlyArray<TabItem<T>>;
  active: T;
  onChange: (id: T) => void;
  color?: 'os-cyan' | 'os-yellow';
}) {
  const activeColor = color === 'os-yellow' ? 'border-os-yellow text-os-yellow' : 'border-os-cyan text-os-cyan';
  return (
    <div className="flex gap-1 border-b border-os-border pb-0 overflow-x-auto">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
            active === id ? activeColor : 'border-transparent text-os-muted hover:text-os-text'
          }`}>
          {Icon && <Icon size={11} />}{label}
        </button>
      ))}
    </div>
  );
}

// ─── LinkRow / DataHub helpers ─────────────────────────────────────────────
export function LinkRow({ icon: Icon, label, href, note }: {
  icon?: React.ElementType;
  label: string;
  href: string;
  note?: string;
}) {
  const external = href.startsWith('http') || href.startsWith('tg:');
  const body = (
    <div className="flex items-center gap-2 py-2 px-2 rounded text-[12px] text-os-muted hover:text-os-text hover:bg-os-elevated transition-colors">
      {Icon && <Icon size={13} className="text-os-cyan flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <span className="text-os-text">{label}</span>
        {note && <span className="text-[10px] text-os-muted ml-2">{note}</span>}
      </div>
      {external && <ExternalLink size={10} className="opacity-50" />}
    </div>
  );
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className="block">{body}</a>;
  return <div className="block">{body}</div>;
}

// ─── Empty State ──────────────────────────────────────────────────────────
export function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-[12px] text-os-muted italic">{message}</p>
      {sub && <p className="text-[10px] text-os-muted mt-1">{sub}</p>}
    </div>
  );
}
