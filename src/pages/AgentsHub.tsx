import { useState } from 'react';
import { Bot, Activity, TrendingUp } from 'lucide-react';
import Agents from './Agents';
import Pipeline from './Pipeline';

type Tab = 'paperclip' | 'vps' | 'pipeline';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'paperclip', label: 'Paperclip Agents', icon: Bot },
  { id: 'vps',       label: 'VPS Services',     icon: Activity },
  { id: 'pipeline',  label: 'Pipeline',         icon: TrendingUp },
];

export default function AgentsHub() {
  const [tab, setTab] = useState<Tab>('paperclip');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-0 flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-yellow/10">
            <Bot size={18} className="text-os-yellow" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text leading-tight">Agents</h1>
            <p className="text-[10px] text-os-muted">Paperclip Agents · VPS Services · Pipeline</p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-os-border pb-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === id ? 'border-os-yellow text-os-yellow' : 'border-transparent text-os-muted hover:text-os-text'
              }`}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'paperclip' && <Agents />}
        {tab === 'vps'       && <VPSServicesTab />}
        {tab === 'pipeline'  && <Pipeline />}
      </div>
    </div>
  );
}

function VPSServicesTab() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch('/api/services')
      .then(r => r.json())
      .then(d => { setServices(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
    return undefined;
  });

  if (loading) return <div className="p-6 text-os-muted text-sm">lädt…</div>;
  if (!services.length) return <div className="p-6 text-os-muted text-sm">Keine Services gefunden.</div>;

  const fmtUptime = (ts: number) => {
    if (!ts) return '–';
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <div className="p-6 space-y-2">
      {services.map((s: any) => (
        <div key={s.id} className="flex items-center justify-between bg-os-surface border border-os-border rounded px-4 py-3">
          <div className="flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${s.status === 'online' ? 'bg-os-green' : s.status === 'errored' ? 'bg-os-red' : 'bg-os-yellow'}`} />
            <span className="text-sm text-os-text font-medium">{s.name}</span>
            <span className="text-xs text-os-muted">{s.status}</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-os-muted">
            <span>CPU {s.cpu}%</span>
            <span>RAM {Math.round(s.memory / 1024 / 1024)}MB</span>
            <span>↺ {s.restarts}</span>
            <span>{fmtUptime(s.uptime)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
