import { ExternalLink, Globe, Phone, FileText, DollarSign, Calendar, Home } from 'lucide-react';

export default function ThailandRE() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-yellow/10">
            <Home size={18} className="text-os-yellow" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text leading-tight">Thailand RE</h1>
            <p className="text-[10px] text-os-muted">Patrick · Webseite + Real-Estate-Daten</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Status" value="In Arbeit" color="text-os-yellow" />
        <Stat label="Scope" value="110h" color="text-os-cyan" />
        <Stat label="Budget" value="€4.5k" color="text-os-green" />
        <Stat label="Next" value="Call 15:00" color="text-os-cyan" />
      </div>

      <Panel title="Aktiver Stand">
        <ul className="space-y-2 text-[12px]">
          <li>🌐 <strong>Webseite</strong> — Vite + React, dunkel/cinematic, Content-Abgleich läuft</li>
          <li>📋 <strong>Scope-Doc</strong> — 110h / €4.5k Ziel upfront (€3k Minimum)</li>
          <li>📱 <strong>WhatsApp-Integration</strong> — Mittel-Komplex, 2-5 Tage Meta-Verifizierung</li>
          <li>📞 <strong>Call heute 15:00</strong> — Webseite-Review</li>
        </ul>
      </Panel>

      <Panel title="Offene Punkte">
        <ul className="space-y-1 text-[12px] text-os-muted">
          <li>❓ Echte Properties einbinden (statt Placeholder)</li>
          <li>❓ Kundenzahl klären für Trust-Signals</li>
          <li>❓ Tool-Tests: pcube.ai + verdent.ai (Build-Beschleunigung)</li>
          <li>❓ Mobile-Optimierung</li>
        </ul>
      </Panel>

      <Panel title="Resources">
        <a href="https://t.me/" className="flex items-center gap-2 py-2 px-2 text-[12px] text-os-muted hover:text-os-text"><Phone size={13} className="text-os-cyan" />Patrick TG</a>
        <a className="flex items-center gap-2 py-2 px-2 text-[12px] text-os-muted">
          <Globe size={13} className="text-os-cyan" />Webseite (URL TBD)
        </a>
        <a className="flex items-center gap-2 py-2 px-2 text-[12px] text-os-muted">
          <FileText size={13} className="text-os-cyan" />Scope-Doc (lokal)
        </a>
      </Panel>

      <p className="text-[10px] text-os-muted italic">
        Dashboard-Skeleton — wird live-data-fähig nach Patrick-Call + URL-Klärung.
      </p>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-os-muted mb-2">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <h3 className="text-sm font-semibold text-os-text mb-3">{title}</h3>
      {children}
    </div>
  );
}
