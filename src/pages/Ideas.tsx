import { useState, useEffect } from 'react';
import { Lightbulb, Plus, RefreshCw, Inbox, Archive, Tag, Clock } from 'lucide-react';

interface Idea {
  file: string;
  title: string;
  status: string;
  kategorie: string;
  created: string;
  bewertung: string;
  hebel: string;
  prioritaet: string;
}

const STATUS_COLOR: Record<string, string> = {
  inbox: 'bg-os-cyan/10 text-os-cyan border-os-cyan/20',
  sorted: 'bg-os-green/10 text-os-green border-os-green/20',
  archive: 'bg-os-muted/10 text-os-muted border-os-muted/20',
};

const CAT_COLOR: Record<string, string> = {
  business: 'text-os-yellow',
  content: 'text-os-cyan',
  personal: 'text-os-green',
  research: 'text-purple-400',
  tools: 'text-orange-400',
};

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'inbox' | 'sorted' | 'archive'>('all');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [spin, setSpin] = useState(false);

  const load = async () => {
    try {
      const data = await fetch('/api/ideas').then(r => r.json());
      setIdeas(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.trim() }),
    });
    setInput('');
    await load();
    setSubmitting(false);
  };

  const refresh = () => { setSpin(true); load(); setTimeout(() => setSpin(false), 600); };

  const filtered = ideas.filter(i => filter === 'all' || i.status === filter);
  const inboxCount = ideas.filter(i => i.status === 'inbox').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lightbulb size={20} className="text-os-cyan" />
          <h1 className="text-lg font-semibold text-os-text">Ideas</h1>
          {inboxCount > 0 && (
            <span className="rounded-full bg-os-cyan/10 border border-os-cyan/20 px-2 py-0.5 text-[10px] font-bold text-os-cyan">
              {inboxCount} new
            </span>
          )}
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:bg-os-surface transition-colors">
          <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Quick Capture */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <p className="text-xs text-os-muted mb-2">Quick Capture → personal-os/04-ideas/inbox/</p>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submit(); }}
            placeholder="Neue Idee... (Cmd+Enter zum Speichern)"
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
        {(['all', 'inbox', 'sorted', 'archive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-os-bg text-os-cyan' : 'text-os-muted hover:text-os-text'
            }`}
          >
            {f === 'inbox' ? <Inbox size={12} /> : f === 'archive' ? <Archive size={12} /> : <Tag size={12} />}
            {f} {f !== 'all' && `(${ideas.filter(i => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Ideas List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-os-surface animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
          <Lightbulb size={24} className="text-os-muted mx-auto mb-2" />
          <p className="text-sm text-os-muted">No ideas yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(idea => (
            <div key={idea.file} className="rounded-xl border border-os-border bg-os-surface px-4 py-3 hover:border-os-border/80 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-os-text truncate">{idea.title}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_COLOR[idea.status] || STATUS_COLOR.archive}`}>
                      {idea.status}
                    </span>
                    {idea.kategorie && idea.kategorie !== idea.status && (
                      <span className={`text-[10px] capitalize ${CAT_COLOR[idea.kategorie] || 'text-os-muted'}`}>
                        {idea.kategorie}
                      </span>
                    )}
                    {idea.prioritaet && (
                      <span className="text-[10px] text-os-muted">P{idea.prioritaet}</span>
                    )}
                    {idea.hebel && (
                      <span className="text-[10px] text-os-yellow">⚡ {idea.hebel}</span>
                    )}
                  </div>
                </div>
                {idea.created && (
                  <div className="flex items-center gap-1 text-[10px] text-os-muted shrink-0">
                    <Clock size={10} />
                    {new Date(idea.created).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
