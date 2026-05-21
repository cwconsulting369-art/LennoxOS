import { useState, useEffect } from 'react';
import { Lightbulb, Wifi, WifiOff, ExternalLink } from 'lucide-react';

const SCRIPT_OS_URL = 'https://script.lennoxos.com';

export default function ScriptFactoryOS() {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(SCRIPT_OS_URL, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
        if (!cancelled) setStatus(res.ok ? 'up' : 'down');
      } catch { if (!cancelled) setStatus('down'); }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-os-yellow/10">
            <Lightbulb size={16} className="text-os-yellow" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-os-text">Script Factory OS</h1>
            <p className="text-[10px] text-os-muted">script.lennoxos.com · Tim · E-Commerce Ad Scripts</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === 'checking' && <span className="text-xs text-os-muted">Checking...</span>}
          {status === 'up' && <span className="flex items-center gap-1 text-xs text-os-green"><Wifi size={11} /> Live</span>}
          {status === 'down' && <span className="flex items-center gap-1 text-xs text-red-400"><WifiOff size={11} /> Offline / nicht deployed</span>}
          <a href={SCRIPT_OS_URL} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-os-muted hover:text-os-cyan transition-colors">
            <ExternalLink size={11} /> Tab
          </a>
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-os-border">
        {status === 'down' ? (
          <div className="flex h-full flex-col items-center justify-center p-8 space-y-3 text-center">
            <Lightbulb size={28} className="text-os-yellow opacity-50" />
            <h2 className="text-sm font-semibold text-os-text">Script Factory OS noch nicht deployed</h2>
            <p className="max-w-md text-[12px] text-os-muted">
              Eigene Subdomain <code>script.lennoxos.com</code> wartet auf Deployment. Folgt dem
              Standard-OS-Template (Finance / Roadmap / Data Hub / People / Metrics + Admin Agent-View).
            </p>
            <p className="max-w-md text-[11px] text-os-muted italic">
              Setup: Express Backend + React Frontend, Cloudflare Tunnel-Route, Owner-Login Tim.
              Basiert auf Tim's Knightvision-Konzept, im AEVUM-Brand als "Script Factory" Linie.
            </p>
          </div>
        ) : (
          <iframe src={SCRIPT_OS_URL} className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Script Factory OS Dashboard" />
        )}
      </div>
    </div>
  );
}
