import { Activity, ExternalLink } from 'lucide-react';

export default function UptimePage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-green/10">
            <Activity size={18} className="text-os-green" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-os-text leading-tight">Uptime</h1>
            <p className="text-[10px] text-os-muted">Kuma · 24 Monitors · pm2 / gold-bots / websites / DNS</p>
          </div>
          <a href="https://status.lennoxos.com" target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-os-muted hover:text-os-cyan transition-colors">
            <ExternalLink size={11} /> Tab öffnen
          </a>
        </div>
      </div>
      <div className="flex-1 px-4 pb-4 overflow-hidden">
        <iframe
          src="https://status.lennoxos.com"
          className="w-full h-full border border-os-border rounded-lg bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Uptime Kuma"
        />
      </div>
    </div>
  );
}
