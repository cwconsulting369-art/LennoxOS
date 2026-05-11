import { Link, ExternalLink, Bookmark, Clock, Search, Tag } from 'lucide-react';

function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-os-border/50">
        <Clock size={20} className="text-os-muted" />
      </div>
      <p className="text-sm font-medium text-os-text">{title}</p>
      <p className="mt-1 text-xs text-os-muted">{description}</p>
      <span className="mt-3 inline-flex items-center rounded-full bg-os-yellow/10 border border-os-yellow/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-os-yellow">
        Kommt bald
      </span>
    </div>
  );
}

interface SampleLink {
  title: string;
  url: string;
  category: string;
  categoryColor: string;
  description: string;
}

const SAMPLE_LINKS: SampleLink[] = [
  {
    title: 'Paperclip',
    url: 'paperclip.lennoxos.com',
    category: 'Tools',
    categoryColor: 'text-os-accent bg-os-accent/10 border-os-accent/20',
    description: 'Agent Management Platform',
  },
  {
    title: 'Hetzner',
    url: 'hetzner.com',
    category: 'Infrastructure',
    categoryColor: 'text-os-cyan bg-os-cyan/10 border-os-cyan/20',
    description: 'VPS & Storage Provider',
  },
  {
    title: 'Supabase',
    url: 'supabase.com',
    category: 'Database',
    categoryColor: 'text-os-green bg-os-green/10 border-os-green/20',
    description: 'PostgreSQL Backend',
  },
];

function SampleLinkCard({ link }: { link: SampleLink }) {
  return (
    <div className="relative rounded-xl border border-os-border bg-os-surface p-4 opacity-50">
      {/* Sample badge */}
      <span className="absolute top-3 right-3 rounded-full bg-os-border/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-os-muted">
        Sample
      </span>

      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-os-border/60">
          <Bookmark size={15} className="text-os-muted" />
        </div>
        <div className="flex-1 min-w-0 pr-12">
          <p className="text-sm font-semibold text-os-text">{link.title}</p>
          <div className="mt-0.5 flex items-center gap-1">
            <ExternalLink size={10} className="text-os-muted flex-shrink-0" />
            <span className="text-xs text-os-muted truncate">{link.url}</span>
          </div>
          <p className="mt-1.5 text-xs text-os-muted">{link.description}</p>
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${link.categoryColor}`}
            >
              <Tag size={9} />
              {link.category}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Links() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
          <Link size={18} className="text-os-accent" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-os-text">Links & URLs</h1>
          <p className="text-xs text-os-muted">Bookmarks, Tools & Ressourcen</p>
        </div>
      </div>

      {/* Search bar (disabled) */}
      <div className="relative opacity-40 pointer-events-none">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-os-muted"
        />
        <input
          type="text"
          placeholder="Links durchsuchen…"
          readOnly
          className="w-full rounded-xl border border-os-border bg-os-surface py-2.5 pl-9 pr-4 text-sm text-os-text placeholder:text-os-muted outline-none"
        />
      </div>

      {/* Sample cards */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-os-text">Links</p>
          <span className="text-xs text-os-muted italic">Beispiel-Daten</span>
        </div>
        <div className="space-y-3">
          {SAMPLE_LINKS.map((link) => (
            <SampleLinkCard key={link.url} link={link} />
          ))}
        </div>
      </div>

      {/* Coming Soon: URL Database */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">URL-Datenbank</p>
        <ComingSoon
          title="URL-Datenbank"
          description="Bookmarks, Team-Links und wichtige URLs zentral verwalten — Supabase-Integration ausstehend"
        />
      </div>

      {/* Coming Soon: Categories */}
      <div>
        <p className="mb-3 text-sm font-semibold text-os-text">Kategorien</p>
        <ComingSoon
          title="Link-Kategorien"
          description="Tags, Ordner und Smart-Filter für schnellen Zugriff auf relevante Links"
        />
      </div>

      {/* Import note */}
      <div className="rounded-xl border border-os-border bg-os-surface/50 px-4 py-3">
        <div className="flex items-start gap-2">
          <Bookmark size={13} className="text-os-muted flex-shrink-0 mt-0.5" />
          <p className="text-xs text-os-muted">
            Browser-Bookmarks Import geplant (Chrome/Firefox HTML-Export) — kein manuelles Eintippen nötig sobald
            aktiv.
          </p>
        </div>
      </div>
    </div>
  );
}
