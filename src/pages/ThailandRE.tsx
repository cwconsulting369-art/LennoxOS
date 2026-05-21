import { useState } from 'react';
import { ExternalLink, Globe, Phone, FileText, Home, Calendar, Map, LayoutDashboard } from 'lucide-react';
import { OSHeader, KpiStrip, Panel, LinkRow } from '@/components/os';
import { RoadmapPanel } from '../components/RoadmapPanel';

const ROADMAP_PATH = '/home/carlos/personal-os/01-business/patrick-thailand/ROADMAP.md';

function OverviewContent() {
  return (
    <div className="space-y-5">
      <KpiStrip items={[
        { label: 'Status',  value: 'In Arbeit',  color: 'text-os-yellow' },
        { label: 'Scope',   value: '110h',        color: 'text-os-cyan' },
        { label: 'Budget',  value: '€4.5k',       color: 'text-os-green' },
        { label: 'Next',    value: 'Call offen',  color: 'text-os-muted', icon: Calendar },
      ]} />

      <Panel title="Aktiver Stand" icon={FileText}>
        <ul className="space-y-2 text-[12px]">
          <li>🌐 <strong>Webseite</strong> — Vite + React, dunkel/cinematic, Content-Abgleich läuft</li>
          <li>📋 <strong>Scope-Doc</strong> — 110h / €4.5k Ziel upfront (€3k Minimum)</li>
          <li>📱 <strong>WhatsApp-Integration</strong> — Mittel-Komplex, 2-5 Tage Meta-Verifizierung</li>
          <li>📞 <strong>Call verpasst</strong> — 15:00 Patrick-Call 2026-05-21 (Follow-up nötig)</li>
        </ul>
      </Panel>

      <Panel title="Offene Punkte" icon={Home}>
        <ul className="space-y-1 text-[12px] text-os-muted">
          <li>❓ Echte Properties einbinden (statt Placeholder)</li>
          <li>❓ Kundenzahl klären für Trust-Signals</li>
          <li>❓ Mobile-Optimierung</li>
          <li>❓ Vergütungs-Commit von Patrick (Deposit)</li>
        </ul>
      </Panel>

      <Panel title="Resources" icon={ExternalLink}>
        <LinkRow icon={Phone}    label="Patrick TG"          href="tg://" note="Direct" />
        <LinkRow icon={Globe}    label="Webseite (URL TBD)"  href="#" />
        <LinkRow icon={FileText} label="Project Brief"       href="#" note="personal-os/01-business/patrick-thailand" />
      </Panel>
    </div>
  );
}

export default function ThailandRE() {
  const [tab, setTab] = useState<'overview' | 'roadmap'>('overview');

  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'roadmap',  label: 'Roadmap',  icon: Map },
  ] as const;

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      <OSHeader emoji="🏝️" title="Thailand RE" sub="Patrick · Webseite + Real-Estate-Daten" />

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

      {tab === 'overview' && <OverviewContent />}
      {tab === 'roadmap'  && <RoadmapPanel path={ROADMAP_PATH} />}
    </div>
  );
}
