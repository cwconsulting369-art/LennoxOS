import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, ExternalLink, Bookmark, Search, Tag, Plus, X, Trash2, RefreshCw } from 'lucide-react';

interface LinkEntry {
  id: string;
  title: string;
  url: string;
  category: string;
  description: string;
  added: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Tools:          'text-os-accent  bg-os-accent/10  border-os-accent/20',
  Infrastructure: 'text-os-cyan    bg-os-cyan/10    border-os-cyan/20',
  Database:       'text-os-green   bg-os-green/10   border-os-green/20',
  Trading:        'text-os-yellow  bg-os-yellow/10  border-os-yellow/20',
  AI:             'text-purple-400 bg-purple-400/10 border-purple-400/20',
  Automation:     'text-orange-400 bg-orange-400/10 border-orange-400/20',
  Other:          'text-os-muted   bg-os-border/40  border-os-border',
};
function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
}

const CATEGORIES = ['Tools', 'Infrastructure', 'Database', 'Trading', 'AI', 'Automation', 'Other'];

function formatUrl(url: string) {
  return url.replace(/^https?:\/\//, '');
}

function LinkCard({ link, onDelete }: { link: LinkEntry; onDelete: (id: string) => void }) {
  return (
    <div className="group relative rounded-xl border border-os-border bg-os-surface p-4 hover:border-os-accent/40 transition-colors">
      <button
        onClick={() => onDelete(link.id)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-os-red/20 text-os-muted hover:text-os-red"
      >
        <Trash2 size={12} />
      </button>

      <a
        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-start gap-3 group/link"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-os-elevated">
          <Bookmark size={15} className="text-os-accent" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-os-text group-hover/link:text-os-accent transition-colors">{link.title}</p>
            <ExternalLink size={11} className="text-os-muted flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
          </div>
          <p className="mt-0.5 text-xs text-os-muted truncate">{formatUrl(link.url)}</p>
          {link.description && (
            <p className="mt-1.5 text-xs text-os-muted">{link.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${catColor(link.category)}`}>
              <Tag size={9} />
              {link.category}
            </span>
            <span className="text-[10px] text-os-muted">{link.added}</span>
          </div>
        </div>
      </a>
    </div>
  );
}

interface AddFormProps {
  onAdd: (entry: Omit<LinkEntry, 'id' | 'added'>) => Promise<void>;
  onClose: () => void;
}
function AddForm({ onAdd, onClose }: AddFormProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Tools');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    await onAdd({ title, url, category, description });
    setSaving(false);
  }

  return (
    <div className="rounded-xl border border-os-accent/30 bg-os-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-os-text">Neuer Link</p>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-os-border text-os-muted"><X size={14} /></button>
      </div>
      <form onSubmit={submit} className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titel *"
            required
            className="rounded-lg border border-os-border bg-os-elevated px-3 py-2 text-sm text-os-text placeholder:text-os-muted outline-none focus:border-os-accent/60"
          />
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="URL *"
            required
            className="rounded-lg border border-os-border bg-os-elevated px-3 py-2 text-sm text-os-text placeholder:text-os-muted outline-none focus:border-os-accent/60"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="rounded-lg border border-os-border bg-os-elevated px-3 py-2 text-sm text-os-text outline-none focus:border-os-accent/60"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Beschreibung (optional)"
            className="rounded-lg border border-os-border bg-os-elevated px-3 py-2 text-sm text-os-text placeholder:text-os-muted outline-none focus:border-os-accent/60"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-os-muted hover:text-os-text rounded-lg border border-os-border hover:bg-os-elevated transition-colors">Abbrechen</button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !url.trim()}
            className="px-3 py-1.5 text-xs font-medium text-os-bg bg-os-accent rounded-lg hover:bg-os-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Links() {
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchLinks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/links');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLinks(json.links ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  async function handleAdd(entry: Omit<LinkEntry, 'id' | 'added'>) {
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const json = await res.json();
    if (json.link) {
      setLinks(prev => [json.link, ...prev]);
      setShowAdd(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/links/${id}`, { method: 'DELETE' });
    setLinks(prev => prev.filter(l => l.id !== id));
  }

  const filtered = links.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || l.description.toLowerCase().includes(q);
    const matchCat = !filterCat || l.category === filterCat;
    return matchSearch && matchCat;
  });

  const categories = [...new Set(links.map(l => l.category))].sort();

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
            <Link size={18} className="text-os-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text">Links & URLs</h1>
            <p className="text-xs text-os-muted">{links.length} Bookmarks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLinks(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:border-os-accent/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setShowAdd(v => !v); setTimeout(() => searchRef.current?.focus(), 50); }}
            className="flex items-center gap-1.5 rounded-lg border border-os-accent/40 bg-os-accent/10 px-3 py-1.5 text-xs font-medium text-os-accent hover:bg-os-accent/20 transition-colors"
          >
            <Plus size={13} />
            Hinzufügen
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && <AddForm onAdd={handleAdd} onClose={() => setShowAdd(false)} />}

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-os-muted" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Links durchsuchen…"
            className="w-full rounded-xl border border-os-border bg-os-surface py-2.5 pl-9 pr-4 text-sm text-os-text placeholder:text-os-muted outline-none focus:border-os-accent/60 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-os-muted hover:text-os-text">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="rounded-xl border border-os-border bg-os-surface px-3 py-2.5 text-sm text-os-text outline-none focus:border-os-accent/60"
        >
          <option value="">Alle</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">
          Fehler: {error}
        </div>
      )}

      {/* Links list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-os-border bg-os-surface p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="h-9 w-9 rounded-xl bg-os-border/60 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-os-border/60" />
                  <div className="h-3 w-48 rounded bg-os-border/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-os-border bg-os-surface/50 p-8 text-center">
          <Bookmark size={20} className="mx-auto mb-3 text-os-muted" />
          <p className="text-sm text-os-muted">{search || filterCat ? 'Keine Links gefunden.' : 'Noch keine Links gespeichert.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(link => (
            <LinkCard key={link.id} link={link} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
