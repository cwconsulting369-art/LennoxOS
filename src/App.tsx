import React, { useState } from 'react';
import { Zap, Activity, AlertCircle, FolderOpen, ExternalLink, Bot, Terminal, Lightbulb, Server } from 'lucide-react';
import CommandCenter from './pages/CommandCenter';
import Files from './pages/Files';
import GoldBotDashboard from './pages/GoldBotDashboard';
import Monitor from './pages/Monitor';
import TerminalPage from './pages/Terminal';
import Ideas from './pages/Ideas';
import Agents from './pages/Agents';

const NAV = [
  { id: 'command',  label: 'Command Center', icon: Zap },
  { id: 'services', label: 'Services',        icon: Activity },
  { id: 'issues',   label: 'Issues',          icon: AlertCircle },
  { id: 'monitor',  label: 'Monitor',         icon: Server },
  { id: 'agents',   label: 'Agents',          icon: Bot },
  { id: 'ideas',    label: 'Ideas',           icon: Lightbulb },
  { id: 'terminal', label: 'Terminal',        icon: Terminal },
  { id: 'files',    label: 'Files',           icon: FolderOpen },
  { id: 'goldbot',  label: 'Gold Bot',        icon: Zap },
];

export default function App() {
  const [page, setPage] = useState('command');

  function renderPage() {
    switch (page) {
      case 'monitor':  return <Monitor />;
      case 'terminal': return <TerminalPage />;
      case 'ideas':    return <Ideas />;
      case 'agents':   return <Agents />;
      case 'goldbot':  return <GoldBotDashboard />;
      case 'files':    return <Files />;
      default:         return <CommandCenter activePage={page} />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-os-bg">
      <aside className="w-52 flex-shrink-0 flex flex-col bg-os-surface border-r border-os-border">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-os-border">
          <Zap size={18} className="text-os-cyan" />
          <span className="font-semibold text-white text-sm">Lennox OS</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                page === id
                  ? 'bg-os-cyan/10 text-os-cyan'
                  : 'text-os-muted hover:text-os-text hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
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
