import { useState, useEffect } from 'react';
import { Lightbulb, Plus, RefreshCw, Inbox, Archive, Tag, Clock, Zap, ExternalLink } from 'lucide-react';

interface IdeaRecord {
  id: string;
  title: string;
  summary: string;
  status: string;
  bewertung: string;
  prioritaet: string;
  kategorie: string;
  projekt: string;
  hebel: string;
  relevanz: number;
  umsetzung: string;
  quelle: string;
}

const STATUS_COLOR: Record<string, string> = {
  inbox: 'bg-os-cyan/10 text-os-cyan border-os-cyan/20',
  sorted: 'bg-os-green/10 text-os-green border-os-green/20',
  archive: 'bg-os-muted/10 text-os-muted border-os-border',
  'In Bearbeitung': 'bg-os-yellow/10 text-os-yellow border-os-yellow/20',
  Umgesetzt: 'bg-os-green/10 text-os-green border-os-green/20',
  Verworfen: 'bg-os-muted/10 text-os-muted border-os-border',
};

const CAT_COLOR: Record<string, string> = {
  business: 'text-os-yellow',
  Business: 'text-os-yellow',
  content: 'text-os-cyan',
  Content: 'text-os-cyan',
  personal: 'text-os-green',
  Personal: 'text-os-green',
  research: 'text-purple-400',
  Research: 'text-purple-400',
  tools: 'text-orange-400',
  Tools: 'text-orange-400',
};

const FILTERS = ['all', 'inbox', 'sorted', 'archive'] as const;

export default function IdeaFactory() {
  const [records, setRecords] = useState<IdeaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [spin, setSpin] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await fetch('/api/idea-factory').then(r => r.json());
      if (data.error) throw new Error(data.error);
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/idea-factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() }),
      });
      setInput('');
      await load();
    } catch {}
    setSubmitting(false);
  };

  const refresh = () => { setSpin(true); setLoading(true); load(); setTimeout(() => setSpin(false), 600); };

  const filtered = records.filter(r => {
    if (filter === 'all') return true;
    return (r.status || '').toLowerCase() === filter.toLowerCase();
  });

  const inboxCount = records.filter(r => (r.status || '').toLowerCase() === 'inbox').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-cyan/15">
            <Lightbulb size={18} className="text-os-cyan" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-os-text">Idea Factory</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-os-cyan/10 border border-os-cyan/20 text-os-cyan font-bold uppercase tracking-wider">
                Airtable
              </span>
              {inboxCount > 0 && (
                <span className="rounded-full bg-os-cyan/10 border border-os-cyan/20 px-2 py-0.5 text-[10px] font-bold text-os-cyan">
                  {inboxCount} new
                </span>
              )}
            </div>
            <p className="text-xs text-os-muted">Synced mit Airtable · {records.length} Ideen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://airtable.com/appJDdfkdzsIhuSUc"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-lg border border-os-border px-2.5 py-1.5 text-xs text-os-muted hover:text-os-cyan transition-colors"
          >
            <ExternalLink size={11} /> Airtable
          </a>
          <button onClick={refresh} className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text transition-colors">
            <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-xs text-os-red">
          Airtable-Fehler: {error}
        </div>
      )}

      {/* Quick Capture */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <p className="text-xs text-os-muted mb-2">Quick Capture → Airtable · Quelle: LennoxOS Dashboard</p>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="Neue Idee... (Ctrl+Enter speichern)"
            rows={2}
            className="flex-1 rounded-lg border border-os-border bg-os-bg px-3 py-2 text-sm text-os-text placeholder-os-muted outline-none focus:border-os-cyan resize-none"
          />
          <button
            onClick={submit}
            disabled={submitting || !input.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-os-cyan/10 border border-os-cyan/20 px-4 py-2 text-sm text-os-cyan hover:bg-os-cyan/20 transition-colors disabled:opacity-40"
          >
            <Plus size={15} /> {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 rounded-lg border border-os-border bg-os-surface p-1 w-fit">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-os-bg text-os-cyan' : 'text-os-muted hover:text-os-text'
            }`}
          >
            {f === 'inbox' ? <Inbox size={12} /> : f === 'archive' ? <Archive size={12} /> : <Tag size={12} />}
            {f} {f !== 'all' && `(${records.filter(r => (r.status || '').toLowerCase() === f.toLowerCase()).length})`}
          </button>
        ))}
      </div>

      {/* Ideas Grid */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-os-surface animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
          <Lightbulb size={24} className="text-os-muted mx-auto mb-2" />
          <p className="text-sm text-os-muted">Keine Ideen in dieser Kategorie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(idea => (
            <div
              key={idea.id}
              className="rounded-xl border border-os-border bg-os-surface hover:border-os-cyan/30 transition-colors cursor-pointer"
              onClick={() => setExpanded(expanded === idea.id ? null : idea.id)}
            >
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-os-text truncate">{idea.title}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_COLOR[idea.status] || STATUS_COLOR.archive}`}>
                        {idea.status || 'inbox'}
                      </span>
                      {idea.kategorie && (
                        <span className={`text-[10px] capitalize ${CAT_COLOR[idea.kategorie] || 'text-os-muted'}`}>
                          {idea.kategorie}
                        </span>
                      )}
                      {idea.prioritaet && (
                        <span className="text-[10px] text-os-muted">P{idea.prioritaet}</span>
                      )}
                      {idea.hebel && (
                        <span className="text-[10px] text-os-yellow flex items-center gap-0.5">
                          <Zap size={9} /> {idea.hebel}
                        </span>
                      )}
                      {idea.relevanz > 0 && (
                        <span className="text-[10px] text-os-muted">
                          {'★'.repeat(idea.relevanz)}{'☆'.repeat(5 - idea.relevanz)}
                        </span>
                      )}
                    </div>
                  </div>
                  {idea.quelle && (
                    <span className="text-[9px] text-os-muted flex-shrink-0 bg-os-elevated px-1.5 py-0.5 rounded">
                      {idea.quelle}
                    </span>
                  )}
                </div>
              </div>
              {/* Expanded detail */}
              {expanded === idea.id && (idea.summary || idea.umsetzung || idea.projekt) && (
                <div className="px-4 pb-3 pt-0 border-t border-os-border/50 space-y-2">
                  {idea.summary && (
                    <p className="text-xs text-os-secondary leading-relaxed">{idea.summary}</p>
                  )}
                  <div className="flex gap-4 text-xs text-os-muted">
                    {idea.projekt && <span>Projekt: <span className="text-os-text">{idea.projekt}</span></span>}
                    {idea.umsetzung && <span>Umsetzung: <span className="text-os-text">{idea.umsetzung}</span></span>}
                    {idea.bewertung && <span>Bewertung: <span className="text-os-text">{idea.bewertung}</span></span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
