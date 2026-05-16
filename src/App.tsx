import { useState } from 'react';
import {
  LayoutDashboard,
  Zap,
  CircleDot,
  TrendingUp,
  Bot,
  Lightbulb,
  FolderOpen,
  User,
  Beaker,
  Wrench,
  Terminal,
  Activity,
  HardDrive,
  Users,
  Server,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

import Overview from './pages/Overview';
import CommandCenter from './pages/CommandCenter';
import IssueBoard from './pages/IssueBoard';
import Pipeline from './pages/Pipeline';
import AgentControl from './pages/AgentControl';
import Ideas from './pages/Ideas';
import Projects from './pages/Projects';
import PersonalDashboard from './pages/PersonalDashboard';
import SystemDashboard from './pages/SystemDashboard';
import TerminalPage from './pages/Terminal';
import Files from './pages/Files';
import GoldBotDashboard from './pages/GoldBotDashboard';
import Finance from './pages/Finance';

/* ─── KetolabsOS Platzhalter ─── */
function KetolabsOS() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-os-accent/20 mx-auto mb-4">
          <Beaker size={24} className="text-os-accent" />
        </div>
        <h1 className="text-lg font-semibold text-os-text">Ketolabs OS</h1>
        <p className="text-sm text-os-muted mt-2">Kevin&apos;s Dashboard — kommt bald</p>
        <span className="mt-4 inline-flex items-center rounded-full bg-os-yellow/10 border border-os-yellow/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
          In Entwicklung
        </span>
      </div>
    </div>
  );
}

/* ─── UtilityHubOS Platzhalter ─── */
function UtilityHubOS() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-os-cyan/20 mx-auto mb-4">
          <Wrench size={24} className="text-os-cyan" />
        </div>
        <h1 className="text-lg font-semibold text-os-text">UtilityHub OS</h1>
        <p className="text-sm text-os-muted mt-2">Miguel&apos;s Dashboard — kommt bald</p>
        <span className="mt-4 inline-flex items-center rounded-full bg-os-yellow/10 border border-os-yellow/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
          In Entwicklung
        </span>
      </div>
    </div>
  );
}

/* ─── GoldTraderOS Platzhalter ─── */
function GoldTraderOS() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-os-yellow/20 mx-auto mb-4">
          <TrendingUp size={24} className="text-os-yellow" />
        </div>
        <h1 className="text-lg font-semibold text-os-text">Gold Trader Society</h1>
        <p className="text-sm text-os-muted mt-2">Trading Dashboard — kommt bald</p>
        <span className="mt-4 inline-flex items-center rounded-full bg-os-yellow/10 border border-os-yellow/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
          In Entwicklung
        </span>
      </div>
    </div>
  );
}

/* ─── Types ─── */

type PageId =
  | 'overview' | 'command' | 'issues' | 'pipeline' | 'agents' | 'ideas' | 'projects'
  | 'personal-os' | 'ketolabs' | 'utilityhub' | 'goldtrader'
  | 'terminal' | 'goldbot' | 'files' | 'users' | 'system';

interface NavItem { id: PageId; label: string; icon: React.ElementType; }
interface NavGroup { label: string; items: NavItem[]; }

/* ─── Navigation ─── */

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ id: 'overview', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'command',  label: 'Command Center', icon: Zap },
      { id: 'issues',   label: 'Issues',         icon: CircleDot },
      { id: 'pipeline', label: 'Pipeline',       icon: TrendingUp },
      { id: 'agents',   label: 'Agents',         icon: Bot },
      { id: 'ideas',    label: 'Ideas',          icon: Lightbulb },
      { id: 'projects', label: 'Projekte',       icon: FolderOpen },
    ],
  },
  {
    label: 'OS Dashboards',
    items: [
      { id: 'personal-os', label: 'Personal OS',    icon: User },
      { id: 'ketolabs',    label: 'Ketolabs OS',    icon: Beaker },
      { id: 'utilityhub',  label: 'UtilityHub OS',  icon: Wrench },
      { id: 'goldtrader',  label: 'Gold Trader',    icon: TrendingUp },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'terminal', label: 'Terminal', icon: Terminal },
      { id: 'goldbot',  label: 'Gold Bot', icon: Activity },
      { id: 'files',    label: 'Files',    icon: HardDrive },
      { id: 'users',    label: 'Nutzer',   icon: Users },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'system', label: 'System', icon: Server }],
  },
];

/* ─── Router ─── */

function renderPage(page: PageId) {
  switch (page) {
    case 'overview':      return <Overview />;
    case 'command':       return <CommandCenter activePage={page} />;
    case 'issues':        return <IssueBoard />;
    case 'pipeline':      return <Pipeline />;
    case 'agents':        return <AgentControl />;
    case 'ideas':         return <Ideas />;
    case 'projects':      return <Projects />;
    case 'personal-os':   return <PersonalDashboard />;
    case 'ketolabs':      return <KetolabsOS />;
    case 'utilityhub':    return <UtilityHubOS />;
    case 'goldtrader':    return <GoldTraderOS />;
    case 'terminal':      return <TerminalPage />;
    case 'goldbot':       return <GoldBotDashboard />;
    case 'files':         return <Files />;
    case 'users':         return <div className="p-6 text-os-muted">Nutzer-Verwaltung — kommt bald</div>;
    case 'system':        return <SystemDashboard />;
    default:              return <Overview />;
  }
}

/* ─── App ─── */

export default function App() {
  const [page, setPage] = useState<PageId>('overview');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-os-bg">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-14' : 'w-52'} flex-shrink-0 flex flex-col bg-os-surface border-r border-os-border transition-all duration-200`}>
        {/* Logo */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-os-border sticky top-0 bg-os-surface z-10">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-os-cyan" />
            {!collapsed && <span className="font-semibold text-white text-sm">Lennox OS</span>}
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="text-os-muted hover:text-os-cyan transition-colors">
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-1.5 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="px-3 mb-1 text-[9px] uppercase tracking-widest text-os-muted font-semibold">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ id, label, icon: Icon }) => {
                  const active = page === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPage(id)}
                      title={collapsed ? label : undefined}
                      className={`w-full flex items-center gap-2.5 rounded-lg text-sm transition-colors ${collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'} ${active ? 'bg-os-cyan/10 text-os-cyan' : 'text-os-muted hover:text-os-text hover:bg-white/5'}`}
                    >
                      <Icon size={15} />
                      {!collapsed && <span>{label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-os-border">
          <a href="https://paperclip.lennoxos.com" target="_blank" rel="noreferrer" className={`flex items-center gap-2 text-xs text-os-muted hover:text-os-cyan transition-colors ${collapsed ? 'justify-center' : ''}`}>
            <ExternalLink size={12} />
            {!collapsed && 'Paperclip'}
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {renderPage(page)}
      </main>
    </div>
  );
}
