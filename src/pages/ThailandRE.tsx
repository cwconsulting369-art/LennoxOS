import { ExternalLink, Globe, Phone, FileText, Home, Calendar } from 'lucide-react';
import { OSHeader, KpiStrip, Panel, LinkRow } from '@/components/os';

export default function ThailandRE() {
  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <OSHeader
        emoji="🏝️"
        title="Thailand RE"
        sub="Patrick · Webseite + Real-Estate-Daten"
      />

      <KpiStrip items={[
        { label: 'Status',  value: 'In Arbeit', color: 'text-os-yellow' },
        { label: 'Scope',   value: '110h',      color: 'text-os-cyan' },
        { label: 'Budget',  value: '€4.5k',     color: 'text-os-green' },
        { label: 'Next',    value: 'Call 15:00',color: 'text-os-cyan',  icon: Calendar },
      ]} />

      <Panel title="Aktiver Stand" icon={FileText}>
        <ul className="space-y-2 text-[12px]">
          <li>🌐 <strong>Webseite</strong> — Vite + React, dunkel/cinematic, Content-Abgleich läuft</li>
          <li>📋 <strong>Scope-Doc</strong> — 110h / €4.5k Ziel upfront (€3k Minimum)</li>
          <li>📱 <strong>WhatsApp-Integration</strong> — Mittel-Komplex, 2-5 Tage Meta-Verifizierung</li>
          <li>📞 <strong>Call heute 15:00</strong> — Webseite-Review + Vergütung-Commit</li>
        </ul>
      </Panel>

      <Panel title="Offene Punkte" icon={Home}>
        <ul className="space-y-1 text-[12px] text-os-muted">
          <li>❓ Echte Properties einbinden (statt Placeholder)</li>
          <li>❓ Kundenzahl klären für Trust-Signals</li>
          <li>❓ Tool-Tests: pcube.ai + verdent.ai</li>
          <li>❓ Mobile-Optimierung</li>
        </ul>
      </Panel>

      <Panel title="Resources" icon={ExternalLink}>
        <LinkRow icon={Phone}  label="Patrick TG"             href="tg://" note="Direct" />
        <LinkRow icon={Globe}  label="Webseite (URL TBD)"     href="#" />
        <LinkRow icon={FileText} label="Project Brief"        href="#" note="local: personal-os/01-business/patrick-thailand" />
      </Panel>

      <p className="text-[10px] text-os-muted italic text-center">
        Dashboard-Skeleton — wird live-data-fähig nach Patrick-Call + URL-Klärung.
      </p>
    </div>
  );
}
