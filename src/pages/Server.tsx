import { useState } from 'react';
import { Server as ServerIcon, Cpu, Wifi, HardDrive, FileText, Bell, BarChart2 } from 'lucide-react';
import Monitor from './Monitor';
import NetworkMonitor from './NetworkMonitor';
import ProcessExplorer from './ProcessExplorer';
import LogCentral from './LogCentral';
import Metrics from './Metrics';
import AlertsPage from './Alerts';
import Backups from './Backups';

type Tab = 'monitor' | 'network' | 'processes' | 'logs' | 'metrics' | 'alerts' | 'backups';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'monitor',   label: 'Monitor',   icon: ServerIcon },
  { id: 'network',   label: 'Netzwerk',  icon: Wifi },
  { id: 'processes', label: 'Prozesse',  icon: Cpu },
  { id: 'logs',      label: 'Logs',      icon: FileText },
  { id: 'metrics',   label: 'Metriken',  icon: BarChart2 },
  { id: 'alerts',    label: 'Alerts',    icon: Bell },
  { id: 'backups',   label: 'Backups',   icon: HardDrive },
];

export default function ServerPage() {
  const [tab, setTab] = useState<Tab>('monitor');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-0 flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-cyan/10">
            <ServerIcon size={18} className="text-os-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text leading-tight">Server</h1>
            <p className="text-[10px] text-os-muted">Infrastruktur · Cloudflare · Hetzner · pm2 · Backups</p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-os-border pb-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                tab === id ? 'border-os-cyan text-os-cyan' : 'border-transparent text-os-muted hover:text-os-text'
              }`}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'monitor'   && <Monitor />}
        {tab === 'network'   && <NetworkMonitor />}
        {tab === 'processes' && <ProcessExplorer />}
        {tab === 'logs'      && <LogCentral />}
        {tab === 'metrics'   && <Metrics />}
        {tab === 'alerts'    && <AlertsPage />}
        {tab === 'backups'   && <Backups />}
      </div>
    </div>
  );
}
