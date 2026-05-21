import { useState } from 'react';
import { Server as ServerIcon, Cpu, Wifi, HardDrive, FileText, Bell, BarChart2, Activity, ExternalLink } from 'lucide-react';
import SystemDashboard from './SystemDashboard';
import Monitor from './Monitor';
import NetworkMonitor from './NetworkMonitor';
import ProcessExplorer from './ProcessExplorer';
import LogCentral from './LogCentral';
import Metrics from './Metrics';
import AlertsPage from './Alerts';
import Backups from './Backups';

type Tab = 'overview' | 'uptime' | 'monitor' | 'network' | 'processes' | 'logs' | 'metrics' | 'alerts' | 'backups';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: ServerIcon },
  { id: 'uptime',    label: 'Uptime',    icon: Activity },
  { id: 'monitor',   label: 'Monitor',   icon: ServerIcon },
  { id: 'network',   label: 'Netzwerk',  icon: Wifi },
  { id: 'processes', label: 'Prozesse',  icon: Cpu },
  { id: 'logs',      label: 'Logs',      icon: FileText },
  { id: 'metrics',   label: 'Metriken',  icon: BarChart2 },
  { id: 'alerts',    label: 'Alerts',    icon: Bell },
  { id: 'backups',   label: 'Backups',   icon: HardDrive },
];

function UptimeKumaEmbed() {
  return (
    <div className="flex h-[calc(100vh-180px)] flex-col p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-os-muted">Uptime Kuma — 24 Monitors live (pm2 services, gold-bots, websites, DNS)</p>
        <a href="https://status.lennoxos.com" target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-os-muted hover:text-os-cyan">
          <ExternalLink size={11} /> Tab öffnen
        </a>
      </div>
      <iframe src="https://status.lennoxos.com" className="flex-1 w-full border border-os-border rounded-lg bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="Uptime Kuma" />
    </div>
  );
}

export default function ServerPage() {
  const [tab, setTab] = useState<Tab>('overview');

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
        {tab === 'overview'  && <SystemDashboard />}
        {tab === 'uptime'    && <UptimeKumaEmbed />}
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
