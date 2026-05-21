import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, ChevronDown, ChevronRight, Zap, Target, Calendar, TrendingUp } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface RoadmapMeta {
  value: string;
  deadline: string;
  current_phase: number;
  status: 'active' | 'paused' | 'blocked' | 'done';
  owner?: string;
  goal?: string;
}

interface RoadmapItem {
  text: string;
  done: boolean;
  blocked?: boolean;
  important?: boolean;
}

interface RoadmapPhase {
  name: string;
  status: 'done' | 'active' | 'planned' | 'blocked';
  items: RoadmapItem[];
}

interface ParsedRoadmap {
  meta: RoadmapMeta;
  phases: RoadmapPhase[];
  backlog: string[];
  thoughts: string[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { meta: Partial<RoadmapMeta>; body: string } {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fm) return { meta: {}, body: raw };
  const meta: Partial<RoadmapMeta> = {};
  fm[1].split('\n').forEach(line => {
    const m = line.match(/^(\w+):\s*"?([^"]+)"?$/);
    if (!m) return;
    const [, k, v] = m;
    if (k === 'current_phase') (meta as any)[k] = parseInt(v);
    else (meta as any)[k] = v.trim();
  });
  return { meta, body: fm[2] };
}

function detectPhaseStatus(header: string): RoadmapPhase['status'] {
  if (/✅|DONE|done|abgeschlossen/i.test(header)) return 'done';
  if (/🔴|AKTIV|aktiv|IN PROGRESS|in_progress/i.test(header)) return 'active';
  if (/🟡|PROGRESS|läuft/i.test(header)) return 'active';
  if (/🔒|BLOCKIERT|blocked/i.test(header)) return 'blocked';
  return 'planned';
}

function parseItem(line: string): RoadmapItem | null {
  // - [ ] or - ✅ or - ❌ or - • bullets
  const checked = /^[-*]\s+✅/.test(line);
  const unchecked = /^[-*]\s+\[ \]/.test(line);
  const blocked = /^[-*]\s+🔴/.test(line);
  const important = /^[-*]\s+⚠️|❗|MUST|P0/.test(line);
  if (!checked && !unchecked && !blocked && !/^[-*]\s+/.test(line)) return null;
  const text = line
    .replace(/^[-*]\s+/, '')
    .replace(/^✅\s*/, '')
    .replace(/^\[ \]\s*/, '')
    .replace(/^🔴\s*/, '')
    .replace(/^⚠️\s*/, '')
    .trim();
  if (!text) return null;
  return { text, done: checked, blocked, important };
}

function parseRoadmap(content: string): ParsedRoadmap {
  const { meta, body } = parseFrontmatter(content);
  const phases: RoadmapPhase[] = [];
  const backlog: string[] = [];
  const thoughts: string[] = [];

  let currentSection = '';
  let currentPhase: RoadmapPhase | null = null;

  const lines = body.split('\n');
  for (const line of lines) {
    // ## heading = new section
    if (/^##\s/.test(line)) {
      if (currentPhase) phases.push(currentPhase);
      const heading = line.replace(/^##\s+/, '').trim();
      if (/backlog|ideen|thoughts|random/i.test(heading)) {
        currentSection = 'backlog';
        currentPhase = null;
      } else if (/phase|schritt|step/i.test(heading)) {
        currentSection = 'phase';
        currentPhase = {
          name: heading,
          status: detectPhaseStatus(heading),
          items: [],
        };
      } else {
        // Sub-section inside a phase (e.g. "### Sales") — treat as continued phase
        currentSection = 'sub';
      }
      continue;
    }

    // ### sub-heading inside phase — skip as header, keep items
    if (/^###\s/.test(line)) continue;

    // Items
    const item = parseItem(line);
    if (item) {
      if (currentSection === 'backlog') {
        backlog.push(item.text);
      } else if (currentPhase) {
        currentPhase.items.push(item);
      }
    }

    // Plain text lines (not items, not headings) = thoughts/context
    if (line.trim() && !line.startsWith('#') && !item && !/^\|/.test(line) && !/^---/.test(line)) {
      if (currentSection === 'backlog') {
        thoughts.push(line.trim());
      }
    }
  }
  if (currentPhase) phases.push(currentPhase);

  const safeMeta: RoadmapMeta = {
    value:         meta.value    ?? 'Kein Value-Statement definiert',
    deadline:      meta.deadline ?? 'offen',
    current_phase: meta.current_phase ?? 1,
    status:        meta.status   ?? 'active',
    owner:         meta.owner,
    goal:          meta.goal,
  };

  return { meta: safeMeta, phases, backlog, thoughts };
}

// ── Visual sub-components ─────────────────────────────────────────────────────

const statusConfig = {
  done:    { label: 'Abgeschlossen', color: 'text-os-green',  bg: 'bg-os-green/10',  border: 'border-os-green/30',  icon: CheckCircle2 },
  active:  { label: 'Aktiv',         color: 'text-os-yellow', bg: 'bg-os-yellow/10', border: 'border-os-yellow/30', icon: Zap },
  planned: { label: 'Geplant',       color: 'text-os-muted',  bg: 'bg-os-border/40', border: 'border-os-border',    icon: Clock },
  blocked: { label: 'Blockiert',     color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30',   icon: AlertCircle },
} as const;

const projectStatusConfig = {
  active:  { label: 'Aktiv',     color: 'text-os-green',  dot: 'bg-os-green' },
  paused:  { label: 'Pausiert',  color: 'text-os-yellow', dot: 'bg-os-yellow' },
  blocked: { label: 'Blockiert', color: 'text-red-400',   dot: 'bg-red-400' },
  done:    { label: 'Done',      color: 'text-os-muted',  dot: 'bg-os-muted' },
} as const;

function PhaseCard({ phase, index }: { phase: RoadmapPhase; index: number }) {
  const [open, setOpen] = useState(phase.status === 'active');
  const cfg = statusConfig[phase.status];
  const StatusIcon = cfg.icon;
  const total = phase.items.length;
  const done = phase.items.filter(i => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : (phase.status === 'done' ? 100 : 0);

  return (
    <div className={`rounded-xl border ${cfg.border} bg-os-surface overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-os-elevated/50 transition-colors text-left"
      >
        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color} flex-shrink-0`}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-os-text truncate">
            {phase.name.replace(/^Phase \d+\s*[—–-]\s*/i, '').replace(/\s*[✅🔴🟡⏳🔒]\s*.*$/, '').trim()}
          </p>
          {total > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 rounded-full bg-os-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    phase.status === 'done' ? 'bg-os-green' :
                    phase.status === 'active' ? 'bg-os-yellow' :
                    phase.status === 'blocked' ? 'bg-red-400' : 'bg-os-muted/40'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-os-muted flex-shrink-0">{done}/{total}</span>
            </div>
          )}
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} flex-shrink-0`}>
          <StatusIcon size={9} />{cfg.label}
        </span>
        {open ? <ChevronDown size={12} className="text-os-muted flex-shrink-0" /> : <ChevronRight size={12} className="text-os-muted flex-shrink-0" />}
      </button>

      {open && phase.items.length > 0 && (
        <div className="px-4 pb-4 space-y-1.5 border-t border-os-border/50 pt-3">
          {phase.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              {item.done ? (
                <CheckCircle2 size={13} className="text-os-green mt-0.5 flex-shrink-0" />
              ) : item.blocked ? (
                <XCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle size={13} className="text-os-border mt-0.5 flex-shrink-0" />
              )}
              <span className={`text-[11px] leading-relaxed ${
                item.done ? 'line-through text-os-muted' :
                item.blocked ? 'text-red-400' :
                item.important ? 'text-os-text font-semibold' :
                'text-os-text'
              }`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && phase.items.length === 0 && (
        <p className="px-4 pb-4 pt-3 text-[11px] text-os-muted italic border-t border-os-border/50">Keine Items eingetragen.</p>
      )}
    </div>
  );
}

function Timeline({ phases, currentPhase }: { phases: RoadmapPhase[]; currentPhase: number }) {
  if (phases.length === 0) return null;
  return (
    <div className="flex items-center gap-0">
      {phases.map((ph, i) => {
        const cfg = statusConfig[ph.ph?.status ?? ph.status];
        const isLast = i === phases.length - 1;
        return (
          <div key={i} className="flex items-center flex-1 min-w-0">
            <div className={`flex flex-col items-center gap-1 flex-shrink-0`}>
              <div className={`h-3 w-3 rounded-full border-2 ${
                ph.status === 'done'    ? 'border-os-green bg-os-green' :
                ph.status === 'active' ? 'border-os-yellow bg-os-yellow' :
                ph.status === 'blocked' ? 'border-red-400 bg-red-400' :
                'border-os-border bg-os-bg'
              }`} />
              <span className="text-[9px] text-os-muted whitespace-nowrap">{i + 1}</span>
            </div>
            {!isLast && (
              <div className={`flex-1 h-0.5 mx-1 ${
                ph.status === 'done' ? 'bg-os-green/60' :
                ph.status === 'active' ? 'bg-gradient-to-r from-os-yellow/60 to-os-border/40' :
                'bg-os-border/40'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  content: string;
}

export function ProjectRoadmapViewer({ content }: Props) {
  const roadmap = useMemo(() => parseRoadmap(content), [content]);
  const { meta, phases, backlog } = roadmap;
  const pStatus = projectStatusConfig[meta.status];

  const totalItems = phases.reduce((s, p) => s + p.items.length, 0);
  const doneItems  = phases.reduce((s, p) => s + p.items.filter(i => i.done).length, 0);
  const overallPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${pStatus.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${pStatus.dot} inline-block`} />
                {pStatus.label}
              </span>
              {meta.owner && (
                <span className="text-[10px] text-os-muted">· {meta.owner}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-os-text leading-snug">{meta.value}</p>
            {meta.goal && (
              <p className="text-[11px] text-os-muted flex items-center gap-1">
                <Target size={10} /> {meta.goal}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="flex items-center gap-1 text-[10px] text-os-muted">
              <Calendar size={10} /> {meta.deadline}
            </span>
            {totalItems > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-os-cyan">
                <TrendingUp size={10} /> {overallPct}% done
              </span>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        {totalItems > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-os-border overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-os-cyan to-os-green transition-all"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="text-[10px] text-os-muted text-right">{doneItems} von {totalItems} Tasks erledigt</p>
          </div>
        )}

        {/* Mini Timeline */}
        {phases.length > 1 && (
          <div className="pt-1">
            <Timeline phases={phases} currentPhase={meta.current_phase} />
          </div>
        )}
      </div>

      {/* Phase Cards */}
      {phases.map((phase, i) => (
        <PhaseCard key={i} phase={phase} index={i} />
      ))}

      {/* Backlog */}
      {backlog.length > 0 && (
        <div className="rounded-xl border border-os-border/60 bg-os-surface/60 p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-os-muted mb-3">Backlog / Ideen</h3>
          <ul className="space-y-1.5">
            {backlog.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-os-muted">
                <span className="mt-1 h-1 w-1 rounded-full bg-os-muted/50 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
