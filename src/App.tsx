import React, { useState } from 'react';
import {
  Zap, CircleDot, TrendingUp, Bot, Lightbulb, Server,
  FileText, Cpu, Wifi, BarChart2, Bell, FolderOpen,
  BookOpen, DollarSign, HardDrive, Link, Terminal,
  ExternalLink, Activity, Trophy, Mail, Users as UsersIcon, Shield,
} from 'lucide-react';
import CommandCenter from './pages/CommandCenter';
import IssueBoard from './pages/IssueBoard';
import Pipeline from './pages/Pipeline';
import AgentControl from './pages/AgentControl';
import Ideas from './pages/Ideas';
import Monitor from './pages/Monitor';
import LogCentral from './pages/LogCentral';
import ProcessExplorer from './pages/ProcessExplorer';
import NetworkMonitor from './pages/NetworkMonitor';
import Metrics from './pages/Metrics';
import AlertsPage from './pages/Alerts';
import Projects from './pages/Projects';
import PersonalOS from './pages/PersonalOS';
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

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { id: 'command',    label: 'Command Center', icon: Zap },
      { id: 'issues',     label: 'Issues',         icon: CircleDot },
      { id: 'pipeline',   label: 'Pipeline',       icon: TrendingUp },
      { id: 'agents',     label: 'Agenten',        icon: Bot },
      { id: 'ideas',      label: 'Idea Factory',   icon: Lightbulb },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'monitor',    label: 'Monitor',        icon: Server },
      { id: 'logs',       label: 'Logs',           icon: FileText },
      { id: 'processes',  label: 'Prozesse',       icon: Cpu },
      { id: 'network',    label: 'Netzwerk',       icon: Wifi },
      { id: 'metrics',    label: 'Metriken',       icon: BarChart2 },
      { id: 'alerts',     label: 'Alerts',         icon: Bell },
      { id: 'backups',    label: 'Backups',        icon: HardDrive },
      { id: 'links',      label: 'Links',          icon: Link },
    ],
  },
  {
    label: 'OS-Dashboards',
    items: [
      { id: 'personal-os',label: 'Personal OS',        icon: BookOpen },
      { id: 'projects',   label: 'Projekte',           icon: FolderOpen },
      { id: 'ketolabs',   label: 'Ketolabs OS',        icon: Activity },
      { id: 'utilityhub', label: 'UtilityHub',         icon: Zap },
      { id: 'gts',        label: 'Gold Trader Society',icon: Trophy },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'terminal',   label: 'Terminal',       icon: Terminal },
      { id: 'files',      label: 'Files',          icon: FolderOpen },
      { id: 'goldbot',    label: 'Gold Bot',       icon: Activity },
      { id: 'users',      label: 'Nutzer',         icon: Shield },
    ],
  },
];

export default function App() {
  const [page, setPage] = useState('command');

  function renderPage() {
    switch (page) {
      case 'issues':      return <IssueBoard />;
      case 'pipeline':    return <Pipeline />;
      case 'agents':      return <AgentControl />;
      case 'ideas':       return <Ideas />;
      case 'monitor':     return <Monitor />;
      case 'logs':        return <LogCentral />;
      case 'processes':   return <ProcessExplorer />;
      case 'network':     return <NetworkMonitor />;
      case 'metrics':     return <Metrics />;
      case 'alerts':      return <AlertsPage />;
      case 'projects':    return <Projects />;
      case 'personal-os': return <PersonalOS />;
      case 'backups':     return <Backups />;
      case 'links':       return <Links />;
      case 'terminal':    return <TerminalPage />;
      case 'files':       return <Files />;
      case 'goldbot':     return <GoldBotDashboard />;
      case 'gts':         return <GoldTraderSociety />;
      case 'utilityhub': return <UtilityHub />;
      case 'ketolabs':    return <KetolabsOS />;
      case 'inbox':       return <Inbox />;
      case 'users':       return <UsersPage />;
      default:            return <CommandCenter activePage={page} />;
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
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="px-3 mb-1 text-[9px] uppercase tracking-widest text-os-muted font-semibold">
                {group.label}
              </p>
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
            </div>
          ))}
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
