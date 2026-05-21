import { useState, useEffect } from 'react';
import { Bot, Wifi, WifiOff, ExternalLink, Map, LayoutDashboard } from 'lucide-react';
import { RoadmapPanel } from '../components/RoadmapPanel';

const ROADMAP_PATH = '/home/carlos/personal-os/01-business/kevin-ecommerce/ROADMAP.md';

export default function K3ngamaOS() {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking');
  const [tab, setTab] = useState<'dashboard' | 'roadmap'>('dashboard');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('https://kevin.lennoxos.com/health', { method: 'GET', signal: AbortSignal.timeout(4000) });
        if (!cancelled) setStatus(res.ok ? 'up' : 'down');
      } catch { if (!cancelled) setStatus('down'); }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'roadmap',   label: 'Roadmap',   icon: Map },
  ] as const;

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-os-cyan/10">
            <Bot size={16} className="text-os-cyan" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-os-text">K3ngama OS (Kevin)</h1>
            <p className="text-[10px] text-os-muted">kevin.lennoxos.com</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === 'checking' && <span className="text-xs text-os-muted">Checking...</span>}
          {status === 'up' && <span className="flex items-center gap-1 text-xs text-os-green"><Wifi size={11} /> Live</span>}
          {status === 'down' && <span className="flex items-center gap-1 text-xs text-red-400"><WifiOff size={11} /> Offline</span>}
          <a href="https://kevin.lennoxos.com" target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-os-muted hover:text-os-cyan transition-colors">
            <ExternalLink size={11} /> Tab
          </a>
        </div>
      </div>

      <div className="flex gap-1 border-b border-os-border pb-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              tab === id
                ? 'text-os-cyan border-b-2 border-os-cyan -mb-px bg-os-cyan/5'
                : 'text-os-muted hover:text-os-text'
            }`}>
            <Icon size={11} />{label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'dashboard' && (
          <div className="h-full rounded-xl border border-os-border overflow-hidden">
            <iframe src="https://kevin.lennoxos.com" className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="K3ngama OS Dashboard" />
          </div>
        )}
        {tab === 'roadmap' && (
          <div className="overflow-auto h-full pr-1">
            <RoadmapPanel path={ROADMAP_PATH} />
          </div>
        )}
      </div>
    </div>
  );
}
