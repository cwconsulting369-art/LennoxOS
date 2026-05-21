import React, { useState } from 'react';
import {
  Zap, CircleDot, TrendingUp, Bot, Lightbulb, Server,
  FileText, Cpu, Wifi, BarChart2, Bell, FolderOpen,
  BookOpen, DollarSign, HardDrive, Link, Terminal,
  ExternalLink, Activity, Trophy, Mail, Users as UsersIcon, Shield,
  LayoutDashboard, Dumbbell, Database,
} from 'lucide-react';
import CommandCenter from './pages/CommandCenter';
import Overview from './pages/Overview';
import IssueBoard from './pages/IssueBoard';
import Pipeline from './pages/Pipeline';
import AgentControl from './pages/AgentControl';
import Agents from './pages/Agents';
import Ideas from './pages/Ideas';
import Monitor from './pages/Monitor';
import SystemDashboard from './pages/SystemDashboard';
import LogCentral from './pages/LogCentral';
import ProcessExplorer from './pages/ProcessExplorer';
import NetworkMonitor from './pages/NetworkMonitor';
import Metrics from './pages/Metrics';
import AlertsPage from './pages/Alerts';
import Projects from './pages/Projects';
import PersonalDashboard from './pages/PersonalDashboard';
import Finance from './pages/Finance';
import Backups from './pages/Backups';
import Links from './pages/Links';
import TerminalPage from './pages/Terminal';
import Files from './pages/Files';
import GoldBotDashboard from './pages/GoldBotDashboard';
import GoldTraderSociety from './pages/GoldTraderSociety';
import UtilityHub from './pages/UtilityHub';
import Inbox from './pages/Inbox';
import KetolabsOS from './pages/KetolabsOS';
import UsersPage from './pages/Users';
import K3ngamaOS from './pages/K3ngamaOS';
import ThailandRE from './pages/ThailandRE';
import AevumOS from './pages/AevumOS';
import ScriptFactoryOS from './pages/ScriptFactoryOS';
import ServerPage from './pages/Server';
import UptimePage from './pages/Uptime';
import AgentsHub from './pages/AgentsHub';
import MasterDashboard from './pages/MasterDashboard';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { id: 'master',     label: 'Master',         icon: LayoutDashboard },
      { id: 'command',    label: 'Command Center', icon: Zap },
      { id: 'ideas',      label: 'Idea Factory',   icon: Lightbulb },
      { id: 'projects',   label: 'Projects List',  icon: FolderOpen },
    ],
  },
  {
    label: 'OS-Dashboards',
    items: [
      { id: 'aevum',      label: 'AEVUM',              icon: TrendingUp },
      { id: 'gts',        label: 'GoldTraderSociety',  icon: Trophy },
      { id: 'k3ngama',    label: 'K3ngama (Kevin)',    icon: Bot },
      { id: 'ketolabs',   label: 'Ketolabs',           icon: Activity },
      { id: 'personal-os',label: 'Personal',           icon: BookOpen },
      { id: 'script',     label: 'Script Factory (Tim)', icon: Lightbulb },
      { id: 'thailand',   label: 'Thailand RE',        icon: ExternalLink },
      { id: 'utilityhub', label: 'UtilityHub',         icon: Zap },
    ],
  },
  {
    label: 'System',
    collapsed: true,
    items: [
      { id: 'system-dashboard', label: 'Overview', icon: Database },
      { id: 'uptime',     label: 'Uptime',         icon: Activity },
      { id: 'server',     label: 'Server',         icon: Server },
      { id: 'agents',     label: 'Agents',         icon: Bot },
      { id: 'issues',     label: 'Issues',         icon: CircleDot },
      { id: 'links',      label: 'Links',          icon: Link },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'terminal',   label: 'Terminal',       icon: Terminal },
      { id: 'files',      label: 'Files',          icon: FolderOpen },
      { id: 'users',      label: 'Nutzer',         icon: Shield },
    ],
  },
];

export default function App() {
  const [page, setPage] = useState('master');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NAV_GROUPS.filter(g => g.collapsed).map(g => [g.label, true]))
  );

  function renderPage() {
    switch (page) {
      case 'overview':          return <Overview />;
      case 'issues':            return <IssueBoard />;
      case 'pipeline':          return <Pipeline />;
      case 'agents':            return <Agents />;
      case 'ideas':             return <Ideas />;
      case 'personal-dashboard':return <PersonalDashboard />;
      case 'personal-os':       return <PersonalDashboard />;
      case 'finance':           return <Finance />;
      case 'system-dashboard':  return <SystemDashboard />;
      case 'monitor':           return <Monitor />;
      case 'logs':              return <LogCentral />;
      case 'processes':         return <ProcessExplorer />;
      case 'network':           return <NetworkMonitor />;
      case 'metrics':           return <Metrics />;
      case 'alerts':            return <AlertsPage />;
      case 'projects':          return <Projects />;
      case 'backups':           return <Backups />;
      case 'links':             return <Links />;
      case 'terminal':          return <TerminalPage />;
      case 'files':             return <Files />;
      case 'goldbot':           return <GoldBotDashboard />;
      case 'gts':               return <GoldTraderSociety />;
      case 'utilityhub':        return <UtilityHub />;
      case 'ketolabs':          return <KetolabsOS />;
      case 'k3ngama':           return <K3ngamaOS />;
      case 'thailand':          return <ThailandRE />;
      case 'aevum':             return <AevumOS />;
      case 'script':            return <ScriptFactoryOS />;
      case 'server':            return <ServerPage />;
      case 'uptime':            return <UptimePage />;
      case 'agents':            return <AgentsHub />;
      case 'master':            return <MasterDashboard onNavigate={setPage} />;
      case 'inbox':             return <Inbox />;
      case 'users':             return <UsersPage />;
      case 'command':           return <CommandCenter />;
      default:                  return <CommandCenter />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-os-bg">
      <aside className="w-52 flex-shrink-0 flex flex-col bg-os-surface border-r border-os-border overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-os-border sticky top-0 bg-os-surface z-10">
          <Zap size={18} className="text-os-cyan" />
          <span className="font-semibold text-white text-sm">Lennox OS</span>
        </div>
        <nav className="flex-1 px-2 py-3">
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsedGroups[group.label];
            return (
              <div key={group.label} className="mb-4">
                <button
                  onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
                  className="w-full px-3 mb-1 text-[9px] uppercase tracking-widest text-os-muted font-semibold flex items-center justify-between hover:text-os-text transition-colors"
                >
                  <span>{group.label}</span>
                  <span className="text-[10px] opacity-60">{isCollapsed ? '▸' : '▾'}</span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setPage(id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                          page === id
                            ? 'bg-os-cyan/10 text-os-cyan'
                            : 'text-os-muted hover:text-os-text hover:bg-white/5'
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-os-border">
          <a
            href="https://paperclip.lennoxos.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-os-muted hover:text-os-cyan transition-colors"
          >
            <ExternalLink size={12} /> Paperclip
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}
