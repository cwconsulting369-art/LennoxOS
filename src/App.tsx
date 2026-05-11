import React, { useState } from 'react';
import { Zap, Activity, AlertCircle, FolderOpen, ExternalLink, Bot } from 'lucide-react';
import CommandCenter from './pages/CommandCenter';
import Files from './pages/Files';
import GoldBotDashboard from './pages/GoldBotDashboard';

const NAV = [
  { id: 'command', label: 'Command Center', icon: Zap },
  { id: 'services', label: 'Services', icon: Activity },
  { id: 'issues', label: 'Issues', icon: AlertCircle },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'goldbot', label: 'Gold Bot', icon: Bot },
];

export default function App() {
  const [page, setPage] = useState('command');

  return (
    <div className="flex h-screen overflow-hidden bg-os-bg">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 flex flex-col bg-os-surface border-r border-os-border">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-os-border">
          <Zap size={18} className="text-os-cyan" />
          <span className="font-semibold text-white text-sm">Lennox OS</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
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

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {page === 'goldbot' ? <GoldBotDashboard /> : page === 'files' ? <Files /> : <CommandCenter activePage={page} />}
      </main>
    </div>
  );
}
