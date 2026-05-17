import { useState, useEffect } from 'react';
import { Terminal as TerminalIcon, Wifi, WifiOff, ExternalLink } from 'lucide-react';

export default function Terminal() {
  const [connected, setConnected] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('https://terminal.lennoxos.com', { method: 'HEAD', signal: AbortSignal.timeout(4000) });
        if (!cancelled) setConnected(res.ok || res.status === 401 ? 'up' : 'down');
      } catch {
        if (!cancelled) setConnected('down');
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TerminalIcon size={20} className="text-os-cyan" />
          <h1 className="text-lg font-semibold text-os-text">Terminal</h1>
        </div>
        <div className="flex items-center gap-3">
          {connected === 'checking' && (
            <span className="flex items-center gap-1.5 text-xs text-os-muted">
              <WifiOff size={12} /> Checking...
            </span>
          )}
          {connected === 'up' && (
            <span className="flex items-center gap-1.5 text-xs text-os-green">
              <Wifi size={12} /> Connected to VPS
            </span>
          )}
          {connected === 'down' && (
            <span className="flex items-center gap-1.5 text-xs text-os-red">
              <WifiOff size={12} /> Terminal unreachable
            </span>
          )}
          <a
            href="https://terminal.lennoxos.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-os-muted hover:text-os-cyan transition-colors"
          >
            <ExternalLink size={12} /> Open in tab
          </a>
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-xl border border-os-border bg-black">
        <iframe
          src="https://terminal.lennoxos.com"
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms"
          title="Lennox VPS Terminal"
        />
      </div>
    </div>
  );
}
