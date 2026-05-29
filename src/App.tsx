import { useState } from 'react';
import { User, Server, Users, Zap, ExternalLink, Activity, DollarSign, Layers, Cpu, Lightbulb, Gauge, TrendingUp, type LucideIcon } from 'lucide-react';
import CommandCenter from './pages/CommandCenter';
import Momentum from './pages/Momentum';
import PersonalDashboard from './pages/PersonalDashboard';
import IdeasFactory from './pages/IdeasFactory';
import K3ngamaOS from './pages/K3ngamaOS';
import Infrastructure from './pages/Infrastructure';
import AevumCustomers from './pages/AevumCustomers';
import ActivityDashboard from './pages/ActivityDashboard';
import FinanceDashboard from './pages/FinanceDashboard';
import AgentRegistry from './pages/AgentRegistry';
import HermesDashboard from './pages/HermesDashboard';

/* ============================================================
 * LennoxOS — Bloodred Headquarter (2026-05-22)
 * Four-section layout. Carlos's Command Center.
 *
 * Sections:
 *   1. PersonalOS — Carlos's personal tools
 *   2. K3ngama   — Kevin Uhl co-partnership dashboard
 *   3. Infrastructure — pm2 / system / agents / events
 *   4. AEVUM Customers — master aggregator
 * ============================================================ */

type SectionId = 'command' | 'momentum' | 'personal' | 'k3ngama' | 'infra' | 'aevum' | 'activity' | 'finance' | 'agents' | 'hermes' | 'ideas';

interface SectionDef {
  id: SectionId;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const SECTIONS: SectionDef[] = [
  { id: 'command',  label: 'War Room',        hint: 'Command Center · Live',    icon: Gauge },
  { id: 'momentum', label: 'Momentum',        hint: 'Fortschritt · Projekte',   icon: TrendingUp },
  { id: 'personal', label: 'PersonalOS',      hint: 'Carlos',                   icon: User },
  { id: 'k3ngama',  label: 'K3ngama',         hint: 'Kevin Uhl · Co-Partner',   icon: Users },
  { id: 'infra',    label: 'Infrastructure',  hint: 'VPS · pm2 · Security',     icon: Server },
  { id: 'agents',   label: 'Agent Registry',  hint: 'Paperclip-Copy · Tree',    icon: Layers },
  { id: 'hermes',   label: 'Hermes Schwarm',  hint: 'Subagents · Runs · Cost',  icon: Cpu },
  { id: 'ideas',    label: 'Idea-Factory',    hint: 'Ideen · Triage · Dedup',   icon: Lightbulb },
  { id: 'activity', label: 'Activity',        hint: 'Claude · API-Usage · Logs', icon: Activity },
  { id: 'finance',  label: 'Finance',         hint: 'Costs · Projects · Private', icon: DollarSign },
  { id: 'aevum',    label: 'AEVUM Customers', hint: 'Master Aggregator',        icon: Zap },
];

export default function App() {
  const [active, setActive] = useState<SectionId>('command');

  function renderActive() {
    switch (active) {
      case 'command':   return <CommandCenter onNavigate={(s) => setActive(s as SectionId)} />;
      case 'momentum':  return <Momentum />;
      case 'personal':  return <PersonalDashboard />;
      case 'k3ngama':   return <K3ngamaOS />;
      case 'infra':     return <Infrastructure />;
      case 'agents':    return <AgentRegistry />;
      case 'hermes':    return <HermesDashboard />;
      case 'ideas':     return <IdeasFactory />;
      case 'activity':  return <ActivityDashboard />;
      case 'finance':   return <FinanceDashboard />;
      case 'aevum':     return <AevumCustomers />;
      default:          return <Infrastructure />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden text-[var(--text)]">
      {/* ===== Sidebar ===== */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md relative">
        {/* Side glow accent */}
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[var(--accent)]/30 to-transparent pointer-events-none" />

        {/* Brand */}
        <div className="px-6 py-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center shadow-[0_0_20px_rgba(200,19,27,0.5)]">
                <span className="text-white font-bold text-sm tracking-tight">L</span>
              </div>
              <span className="lx-pulse absolute top-0 right-0 h-2 w-2 rounded-full bg-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="lx-headline text-[15px] tracking-tight">LennoxOS</div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Motor + Logik</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          <div className="lx-section-title px-3 pb-3">Headquarter</div>
          {SECTIONS.map(({ id, label, hint, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={`lx-nav-item ${isActive ? 'lx-nav-item--active' : ''}`}
              >
                <Icon size={15} className="flex-shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <div className="text-[13px] font-medium truncate">{label}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider truncate mt-0.5">
                    {hint}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] space-y-2">
          <a
            href="https://aevum-system.de"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-glow)] transition-colors"
          >
            <ExternalLink size={11} /> AEVUM
          </a>
          <div className="pt-2 mt-2 border-t border-[var(--border-soft)]">
            <p className="text-[9px] text-[var(--text-faint)] uppercase tracking-widest leading-relaxed">
              AEVUM ist die Geldmaschine.<br/>
              LennoxOS ist der Motor.
            </p>
          </div>
        </div>
      </aside>

      {/* ===== Main ===== */}
      <main className="flex-1 overflow-auto">
        {renderActive()}
      </main>
    </div>
  );
}
