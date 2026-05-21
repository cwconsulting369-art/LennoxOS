import { useState, useEffect } from 'react';
import {
  TrendingUp, Globe, Zap, FileText, ExternalLink,
  Layers, ChevronRight, Database,
  Users, Settings, Package, Map, AlertTriangle, Shield,
} from 'lucide-react';
import { RoadmapPanel } from '../components/RoadmapPanel';

interface UHBoard {
  generatedAt: string;
  counts: {
    customers: number | null;
    organizations: number | null;
    documents: number | null;
    pendingErasure: number | null;
    pendingExports: number | null;
    auditLogs: number | null;
    contacts: number | null;
  };
  recentCustomers: Array<{ id: string; full_name?: string; created_at: string }>;
  openErasure: Array<{ id: string; customer_id: string; created_at: string }>;
  web: null | { state: string; deployedAt: string; branch: string; commit: string };
}

const UH_GITHUB = 'https://github.com/cwconsulting369-art/utilityhub-dashboard';
const UH_VERCEL = 'https://vercel.com/cwconsulting369-9599s-projects/utility-hub-dashboard';
const UH_DOMAIN = 'https://utility-hub.one';
const UH_ADMIN  = 'https://utility-hub.one/admin';
const UH_PORTAL = 'https://utility-hub.one/portal';

function StatCard({ label, value, sub, color = 'text-os-text', icon: Icon }: {
  label: string; value: React.ReactNode; sub?: string;
  color?: string; icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={13} className={color} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-os-muted">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-os-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function OverviewTab() {
  const [data, setData] = useState<UHBoard | null>(null);

  useEffect(() => {
    const load = () => fetch('/api/uh/board').then(r => r.json()).then(setData).catch(() => {});
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  const c = data?.counts;
  return (
    <div className="space-y-5">
      {/* Live KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Kunden"
          value={c?.customers ?? '—'}
          sub={c?.organizations != null ? `${c.organizations} Organisationen` : 'Supabase'}
          color="text-os-green"
          icon={Users}
        />
        <StatCard
          label="DSGVO Open"
          value={(c?.pendingErasure ?? 0) + (c?.pendingExports ?? 0)}
          sub={`${c?.pendingErasure ?? 0} Löschung · ${c?.pendingExports ?? 0} Export`}
          color={(c?.pendingErasure ?? 0) + (c?.pendingExports ?? 0) > 0 ? 'text-os-red' : 'text-os-green'}
          icon={Shield}
        />
        <StatCard
          label="Web Deployment"
          value={data?.web?.state || 'unknown'}
          sub={data?.web ? `${data.web.branch} · ${new Date(data.web.deployedAt).toLocaleDateString('de-DE')}` : ''}
          color={data?.web?.state === 'READY' ? 'text-os-green' : 'text-os-yellow'}
          icon={Globe}
        />
        <StatCard
          label="Contract"
          value="Miguel 10%"
          sub="Carlos = IT/AI only"
          color="text-os-yellow"
          icon={TrendingUp}
        />
      </div>

      {/* Recent customers + Open DSGVO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
            <Users size={13} className="text-os-cyan" /> Letzte Kunden (5)
          </h3>
          {data?.recentCustomers?.length ? (
            <ul className="space-y-1 text-[12px]">
              {data.recentCustomers.map(cu => (
                <li key={cu.id} className="flex justify-between py-1 px-2 rounded hover:bg-os-elevated">
                  <span>{cu.full_name || cu.id.slice(0, 8)}</span>
                  <span className="text-os-muted text-[10px]">{new Date(cu.created_at).toLocaleDateString('de-DE')}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[11px] text-os-muted italic">— keine Daten —</p>}
        </div>

        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
            <AlertTriangle size={13} className="text-os-yellow" /> DSGVO-Backlog
          </h3>
          {(c?.pendingErasure ?? 0) > 0 ? (
            <p className="text-[12px] text-os-red">
              <strong>{c?.pendingErasure}</strong> Löschungs-Requests offen — innerhalb 30 Tagen bearbeiten (Art. 17 DSGVO)
            </p>
          ) : (
            <p className="text-[12px] text-os-green">✓ Keine offenen Anfragen</p>
          )}
          {(c?.pendingExports ?? 0) > 0 && (
            <p className="text-[12px] text-os-yellow mt-2">
              <strong>{c?.pendingExports}</strong> Auskunfts-Requests offen
            </p>
          )}
          <p className="text-[10px] text-os-muted mt-3 italic">
            Quelle: <code>erasure_requests</code> + <code>export_requests</code>
          </p>
        </div>
      </div>

      {/* Projekt-Komponenten */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-4 flex items-center gap-2">
          <Layers size={13} className="text-os-cyan" /> Projekt-Komponenten
        </h3>
        <div className="space-y-2">
          {[
            { label: 'Admin Dashboard',   sub: '/admin/* · Supabase-Daten · Org-Verwaltung',  status: 'live',    icon: Settings },
            { label: 'Kunden-Portal',     sub: '/portal/* · Login · Dokumente · Objekte',     status: 'live',    icon: Users },
            { label: 'Landing Page',      sub: '/landing · utility-hub.one · Next.js',        status: 'live',    icon: Globe },
            { label: 'Supabase DB',       sub: 'diuwshgmqavxdmziehix · 30+ Migrations',       status: 'live',    icon: Database },
            { label: 'Airtable Sync',     sub: 'Leads + Kunden sync aus Airtable',            status: 'live',    icon: Package },
            { label: 'Portal Search',     sub: 'Volltextsuche · 5-Objekt-Limit',              status: 'live',    icon: FileText },
            { label: 'Admin UI peppen',   sub: '/admin/* Design + UX verbessern',             status: 'todo',    icon: Settings },
            { label: 'Portal UI peppen',  sub: '/portal/* Design + UX verbessern',            status: 'todo',    icon: Users },
          ].map(({ label, sub, status, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg bg-os-elevated/50 px-3 py-2.5">
              <Icon size={13} className={
                status === 'live' ? 'text-os-green' :
                status === 'todo' ? 'text-os-yellow' : 'text-os-muted'
              } />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-os-text">{label}</p>
                <p className="text-[10px] text-os-muted truncate">{sub}</p>
              </div>
              <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${
                status === 'live' ? 'bg-os-green/10 text-os-green' :
                status === 'todo' ? 'bg-os-yellow/10 text-os-yellow' :
                'bg-os-border/60 text-os-muted'
              }`}>
                {status === 'live' ? 'Live' : status === 'todo' ? 'Offen' : 'Geplant'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Website',       url: UH_DOMAIN,  sub: 'utility-hub.one',                           icon: Globe },
          { label: 'GitHub',        url: UH_GITHUB,  sub: 'cwconsulting369-art/utilityhub-dashboard',  icon: FileText },
          { label: 'Vercel',        url: UH_VERCEL,  sub: 'Deployments',                               icon: Zap },
        ].map(({ label, url, sub, icon: Icon }) => (
          <a key={label} href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-os-border bg-os-surface p-3 hover:border-os-cyan/40 hover:bg-os-elevated transition-colors group">
            <Icon size={14} className="text-os-muted group-hover:text-os-cyan transition-colors" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-os-text">{label}</p>
              <p className="text-[10px] text-os-muted truncate">{sub}</p>
            </div>
            <ExternalLink size={11} className="text-os-muted/40 group-hover:text-os-cyan transition-colors" />
          </a>
        ))}
      </div>

      {/* App Flow */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <ChevronRight size={13} className="text-os-cyan" /> App Flow
        </h3>
        <div className="flex items-center gap-1 flex-wrap text-[11px]">
          {[
            { label: 'Airtable',      sub: 'Leads + Kunden',     color: 'border-os-muted/30 text-os-muted' },
            null,
            { label: 'Supabase Sync', sub: 'ETL-Script',         color: 'border-os-cyan/30 text-os-cyan' },
            null,
            { label: 'Admin /admin',  sub: 'Org-Verwaltung',     color: 'border-os-yellow/30 text-os-yellow' },
            null,
            { label: 'Portal /portal',sub: 'Kunden-Login',       color: 'border-os-green/30 text-os-green' },
          ].map((item, i) =>
            item === null ? (
              <ChevronRight key={i} size={14} className="text-os-muted/40" />
            ) : (
              <div key={i} className={`rounded-lg border px-2 py-1 ${item.color}`}>
                <p className="font-medium">{item.label}</p>
                <p className="text-[9px] opacity-70">{item.sub}</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Nächste Schritte */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <CheckCircle2 size={13} className="text-os-cyan" /> Nächste Schritte
        </h3>
        <div className="space-y-2">
          {[
            { label: 'GitHub SSH-Key auf VPS hinterlegen → Push wieder möglich', done: false },
            { label: 'Admin Dashboard /admin/* UI peppen', done: false },
            { label: 'Portal /portal/* UI peppen', done: false },
            { label: 'Landing Page utility-hub.one live prüfen + optimieren', done: false },
            { label: 'Supabase Migrations vollständig dokumentieren (28 ungetrackt)', done: false },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2.5 text-xs">
              <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${done ? 'border-os-green bg-os-green/20' : 'border-os-border'}`}>
                {done && <CheckCircle2 size={10} className="text-os-green" />}
              </div>
              <span className={done ? 'text-os-muted line-through' : 'text-os-text'}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoadmapTab() {
  return <RoadmapPanel path="/home/carlos/personal-os/01-business/utility-hub/ROADMAP.md" />;
}

function TechTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-4 flex items-center gap-2">
          <Database size={13} className="text-os-cyan" /> Stack
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Framework',  value: 'Next.js 14 (App Router)',   color: 'text-os-text' },
            { label: 'Styling',    value: 'Tailwind CSS + shadcn/ui',  color: 'text-os-cyan' },
            { label: 'Database',   value: 'Supabase PostgreSQL',       color: 'text-os-green' },
            { label: 'Auth',       value: 'Supabase Auth (RLS)',       color: 'text-os-green' },
            { label: 'Hosting',    value: 'Vercel',                    color: 'text-os-muted' },
            { label: 'Animationen', value: 'Framer Motion',            color: 'text-os-accent' },
            { label: 'Sync',       value: 'Airtable API',              color: 'text-os-yellow' },
            { label: 'VPS-Pfad',   value: '~/projects/utilityhub/utility-hub-dashboard/', color: 'text-os-muted' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg bg-os-elevated p-3">
              <p className="text-[10px] text-os-muted uppercase tracking-wider">{label}</p>
              <p className={`text-xs font-bold mt-1 truncate ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <FileText size={13} className="text-os-cyan" /> Quick-Links
        </h3>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Admin öffnen', url: UH_ADMIN,  color: 'border-os-yellow/30 bg-os-yellow/10 text-os-yellow' },
            { label: 'Portal öffnen', url: UH_PORTAL, color: 'border-os-green/30 bg-os-green/10 text-os-green' },
            { label: 'GitHub Repo', url: UH_GITHUB,  color: 'border-os-border text-os-muted' },
            { label: 'Vercel',      url: UH_VERCEL,  color: 'border-os-border text-os-muted' },
          ].map(({ label, url, color }) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:opacity-80 transition-opacity ${color}`}>
              <ExternalLink size={11} /> {label}
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-os-yellow/20 bg-os-yellow/5 p-4">
        <h4 className="text-xs font-medium text-os-yellow mb-2">Scope-Regel</h4>
        <p className="text-xs text-os-muted">Carlos = nur IT/AI (Code, Schema, AI, Deploy). Finanzen, Stripe, Revenue, Billing, Pricing = Miguel (10%-Vertrag). Keine Überschneidung.</p>
      </div>
    </div>
  );
}

export default function UtilityHub() {
  const [tab, setTab] = useState<'overview' | 'roadmap' | 'tech'>('overview');

  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: Layers },
    { id: 'roadmap',  label: 'Roadmap',   icon: Map },
    { id: 'tech',     label: 'Tech',      icon: Database },
  ] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-cyan/10">
              <span className="text-lg">⚡</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-os-text leading-tight">UtilityHub</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-os-muted">utility-hub.one</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-os-green">
                  <Globe size={9} /> LIVE
                </span>
              </div>
            </div>
          </div>
          <a href={UH_DOMAIN} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors">
            <ExternalLink size={12} /> Website
          </a>
        </div>

        <div className="flex gap-1 border-b border-os-border pb-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-os-cyan text-os-cyan'
                  : 'border-transparent text-os-muted hover:text-os-text'
              }`}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'roadmap'  && <RoadmapTab />}
          {tab === 'tech'     && <TechTab />}
        </div>
      </div>
    </div>
  );
}
