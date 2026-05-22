import { useState, useEffect } from 'react';
import { Bot, Wifi, WifiOff, ExternalLink, Users } from 'lucide-react';
import { RoadmapPanel } from '../components/RoadmapPanel';

/* ============================================================
 * K3ngama OS — Kevin Uhl Co-Partnership (NOT a sub-customer)
 * Bloodred theme — 2026-05-22
 * ============================================================ */

export default function K3ngamaOS() {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('https://kevin.lennoxos.com/health', {
          method: 'GET',
          signal: AbortSignal.timeout(4000),
        });
        if (!cancelled) setStatus(res.ok ? 'up' : 'down');
      } catch {
        if (!cancelled) setStatus('down');
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div className="p-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="lx-section-title mb-3">Co-Partnership</div>
          <h1 className="lx-headline text-3xl flex items-center gap-3">
            <Users size={24} className="text-[var(--accent)]" />
            K3ngama
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Kevin Uhl · GoldTraderSociety · kevin.lennoxos.com
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === 'checking' && (
            <span className="lx-pill">checking…</span>
          )}
          {status === 'up' && (
            <span className="lx-pill lx-pill--ok inline-flex">
              <Wifi size={10} /> Live
            </span>
          )}
          {status === 'down' && (
            <span className="lx-pill lx-pill--err inline-flex">
              <WifiOff size={10} /> Offline
            </span>
          )}
          <a
            href="https://kevin.lennoxos.com"
            target="_blank"
            rel="noreferrer"
            className="lx-btn"
          >
            <ExternalLink size={12} /> Open Tab
          </a>
        </div>
      </div>

      {/* Embedded view */}
      <section className="lx-panel p-2 mb-6 overflow-hidden">
        <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-deep)] h-[58vh]">
          <iframe
            src="https://kevin.lennoxos.com"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="K3ngama OS Dashboard"
          />
        </div>
      </section>

      {/* Roadmap */}
      <section className="lx-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bot size={14} className="text-[var(--accent)]" />
          <h2 className="text-sm font-semibold text-[var(--text)]">Roadmap</h2>
        </div>
        <RoadmapPanel path="/home/carlos/personal-os/01-business/kevin-ecommerce/ROADMAP.md" />
      </section>
    </div>
  );
}
