import { useState, useEffect } from 'react';
import { Lightbulb, Plus, RefreshCw, Inbox, Archive, Tag, Zap, ExternalLink, Clock, AlertTriangle, TrendingUp, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';

interface IdeaRecord {
  id: string;
  title: string;
  summary: string;
  mehrwert: string;
  inhalt: string;
  status: string;
  bewertung: string;
  prioritaet: string;
  kategorie: string;
  projekt: string;
  hebel: string;
  relevanz: number;
  umsetzung: string;
  quelle: string;
  inhaltstyp: string;
  createdTime: string;
  ageHours: number;
}

const HEBEL_COLOR: Record<string, string> = {
  Hoch: 'text-emerald-400',
  Mittel: 'text-yellow-400',
  Niedrig: 'text-red-400',
};

const HEBEL_DOT: Record<string, string> = {
  Hoch: 'bg-emerald-400',
  Mittel: 'bg-yellow-400',
  Niedrig: 'bg-red-400',
};

const BEW_ICON: Record<string, JSX.Element> = {
  Einbauen: <CheckCircle2 size={12} className="text-emerald-400" />,
  'On Hold': <PauseCircle size={12} className="text-yellow-400" />,
  Verwerfen: <XCircle size={12} className="text-os-muted" />,
  'Bereits vorhanden': <RefreshCw size={12} className="text-blue-400" />,
};

const PROJEKT_COLOR: Record<string, string> = {
  AEVUM: 'text-os-cyan',
  UtilityHub: 'text-purple-400',
  LennoxOS: 'text-emerald-400',
  Ketolabs: 'text-orange-400',
  Goldtradersociety: 'text-yellow-400',
};

const FILTERS = [
  { key: 'all', label: 'Alle', icon: <Tag size={11} /> },
  { key: 'Neu', label: 'Offen', icon: <Inbox size={11} /> },
  { key: 'Einbauen', label: 'Einbauen', icon: <CheckCircle2 size={11} /> },
  { key: 'On Hold', label: 'On Hold', icon: <PauseCircle size={11} /> },
  { key: 'archive', label: 'Archiv', icon: <Archive size={11} /> },
] as const;

export default function IdeaFactory() {
  const [records, setRecords] = useState<IdeaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [projektFilter, setProjektFilter] = useState<string>('all');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
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
    setSubmitMsg('');
    try {
      const r = await fetch('/api/idea-factory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() }),
      });
      const d = await r.json();
      if (d.ok) {
        setInput('');
        setSubmitMsg('✅ An n8n übergeben — wird kategorisiert & gespeichert.');
        setTimeout(() => { setSubmitMsg(''); load(); }, 4000);
      }
    } catch { setSubmitMsg('❌ Fehler beim Senden.'); }
    setSubmitting(false);
  };

  const refresh = () => { setSpin(true); setLoading(true); load(); setTimeout(() => setSpin(false), 600); };

  // Stats
  const stats = {
    total: records.length,
    offen: records.filter(r => r.status === 'Neu').length,
    einbauen: records.filter(r => r.bewertung === 'Einbauen').length,
    onHold: records.filter(r => r.bewertung === 'On Hold').length,
    stale: records.filter(r => r.status === 'Neu' && r.ageHours > 24).length,
    highHebel: records.filter(r => r.hebel === 'Hoch' && r.status === 'Neu').length,
  };

  // Projects mit Counts
  const projects = ['all', ...Array.from(new Set(records.map(r => r.projekt).filter(Boolean)))];

  // Filter-Logik
  const filtered = records.filter(r => {
    const statusMatch = (() => {
      if (filter === 'all') return true;
      if (filter === 'archive') return r.bewertung === 'Verwerfen' || r.status === 'Verworfen' || r.umsetzung === 'Erledigt';
      if (filter === 'Einbauen') return r.bewertung === 'Einbauen';
      if (filter === 'On Hold') return r.bewertung === 'On Hold';
      return r.status === filter;
    })();
    const projektMatch = projektFilter === 'all' || r.projekt === projektFilter;
    return statusMatch && projektMatch;
  });

  // Stale-Ideen für Alert
  const staleIdeas = records.filter(r => r.status === 'Neu' && r.ageHours > 24)
    .sort((a, b) => b.ageHours - a.ageHours)
    .slice(0, 3);

  return (
    <div className="p-6 space-y-5">
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
                n8n · Airtable
              </span>
            </div>
            <p className="text-xs text-os-muted">{stats.total} Ideen · {stats.highHebel} High-Hebel offen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://airtable.com/appJDdfkdzsIhuSUc" target="_blank" rel="noreferrer"
            className="flex items-center gap-1 rounded-lg border border-os-border px-2.5 py-1.5 text-xs text-os-muted hover:text-os-cyan transition-colors">
            <ExternalLink size={11} /> Airtable
          </a>
          <button onClick={refresh} className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text transition-colors">
            <RefreshCw size={13} className={spin ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          Airtable-Fehler: {error}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Offen', value: stats.offen, color: 'text-os-cyan', sub: 'Status=Neu' },
          { label: 'Einbauen', value: stats.einbauen, color: 'text-emerald-400', sub: 'sofort angehen' },
          { label: 'On Hold', value: stats.onHold, color: 'text-yellow-400', sub: 'parken' },
          { label: '>24h alt', value: stats.stale, color: stats.stale > 0 ? 'text-red-400' : 'text-os-muted', sub: 'unbearbeitet' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-os-border bg-os-surface p-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-os-text mt-0.5">{s.label}</p>
            <p className="text-[10px] text-os-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Daily Alert: Stale Ideas */}
      {staleIdeas.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400">
              {stats.stale} Idee{stats.stale > 1 ? 'n' : ''} seit {'>'} 24h unbearbeitet
            </span>
          </div>
          <div className="space-y-1">
            {staleIdeas.map(idea => (
              <div key={idea.id} className="flex items-center justify-between text-xs">
                <span className="text-os-secondary truncate max-w-[70%]">{idea.title || idea.inhalt?.substring(0, 60)}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] ${PROJEKT_COLOR[idea.projekt] || 'text-os-muted'}`}>{idea.projekt || '—'}</span>
                  <span className="text-os-muted flex items-center gap-0.5">
                    <Clock size={9} /> {idea.ageHours}h
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Capture */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <p className="text-xs text-os-muted mb-2">Quick Capture → n8n → Airtable (mit KI-Kategorisierung)</p>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="Idee eingeben… (Ctrl+Enter speichern)"
            rows={2}
            className="flex-1 rounded-lg border border-os-border bg-os-bg px-3 py-2 text-sm text-os-text placeholder-os-muted outline-none focus:border-os-cyan resize-none"
          />
          <button onClick={submit} disabled={submitting || !input.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-os-cyan/10 border border-os-cyan/20 px-4 py-2 text-sm text-os-cyan hover:bg-os-cyan/20 transition-colors disabled:opacity-40">
            <Plus size={15} /> {submitting ? '…' : 'Save'}
          </button>
        </div>
        {submitMsg && <p className="text-xs mt-2 text-os-muted">{submitMsg}</p>}
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg border border-os-border bg-os-surface p-1">
          {FILTERS.map(f => {
            const count = f.key === 'all' ? records.length
              : f.key === 'archive' ? records.filter(r => r.bewertung === 'Verwerfen').length
              : f.key === 'Einbauen' ? records.filter(r => r.bewertung === 'Einbauen').length
              : f.key === 'On Hold' ? records.filter(r => r.bewertung === 'On Hold').length
              : records.filter(r => r.status === f.key).length;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key ? 'bg-os-bg text-os-cyan' : 'text-os-muted hover:text-os-text'
                }`}>
                {f.icon} {f.label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Projekt-Filter */}
        <select
          value={projektFilter}
          onChange={e => setProjektFilter(e.target.value)}
          className="rounded-lg border border-os-border bg-os-surface px-2.5 py-1.5 text-xs text-os-muted focus:outline-none focus:border-os-cyan"
        >
          {projects.map(p => (
            <option key={p} value={p}>{p === 'all' ? 'Alle Projekte' : p}</option>
          ))}
        </select>
      </div>

      {/* Ideas List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-os-surface animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
          <Lightbulb size={24} className="text-os-muted mx-auto mb-2" />
          <p className="text-sm text-os-muted">Keine Ideen in diesem Filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(idea => (
            <div key={idea.id}
              className={`rounded-xl border bg-os-surface hover:border-os-cyan/30 transition-colors cursor-pointer ${
                idea.ageHours > 24 && idea.status === 'Neu' ? 'border-yellow-500/20' : 'border-os-border'
              }`}
              onClick={() => setExpanded(expanded === idea.id ? null : idea.id)}
            >
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {idea.bewertung && BEW_ICON[idea.bewertung]}
                      <p className="text-sm font-medium text-os-text truncate">{idea.title || idea.inhalt?.substring(0, 60) || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {idea.projekt && (
                        <span className={`text-[10px] font-semibold ${PROJEKT_COLOR[idea.projekt] || 'text-os-muted'}`}>
                          {idea.projekt}
                        </span>
                      )}
                      {idea.kategorie && (
                        <span className="text-[10px] text-os-muted">{idea.kategorie}</span>
                      )}
                      {idea.hebel && (
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${HEBEL_COLOR[idea.hebel] || 'text-os-muted'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${HEBEL_DOT[idea.hebel] || 'bg-os-muted'}`} />
                          {idea.hebel}
                        </span>
                      )}
                      {idea.prioritaet && (
                        <span className="text-[10px] text-os-muted">P: {idea.prioritaet}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {idea.ageHours > 24 && idea.status === 'Neu' && (
                      <span className="flex items-center gap-0.5 text-[9px] text-yellow-400">
                        <Clock size={9} /> {idea.ageHours}h
                      </span>
                    )}
                    {idea.quelle && (
                      <span className="text-[9px] text-os-muted bg-os-elevated px-1.5 py-0.5 rounded">
                        {idea.quelle}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded */}
              {expanded === idea.id && (
                <div className="px-4 pb-4 pt-0 border-t border-os-border/40 space-y-2">
                  {idea.summary && (
                    <p className="text-xs text-os-secondary leading-relaxed">{idea.summary}</p>
                  )}
                  {idea.mehrwert && (
                    <div className="flex items-start gap-2">
                      <TrendingUp size={12} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-emerald-300/80">{idea.mehrwert}</p>
                    </div>
                  )}
                  {idea.inhalt && idea.inhalt !== idea.title && (
                    <p className="text-xs text-os-muted leading-relaxed border-l-2 border-os-border pl-3">
                      {idea.inhalt.substring(0, 300)}{idea.inhalt.length > 300 ? '…' : ''}
                    </p>
                  )}
                  <div className="flex gap-4 text-xs text-os-muted pt-1">
                    {idea.bewertung && <span>Bewertung: <span className="text-os-text">{idea.bewertung}</span></span>}
                    {idea.umsetzung && <span>Umsetzung: <span className="text-os-text">{idea.umsetzung}</span></span>}
                    {idea.inhaltstyp && <span>Typ: <span className="text-os-text">{idea.inhaltstyp}</span></span>}
                    {idea.createdTime && (
                      <span className="ml-auto">
                        {new Date(idea.createdTime).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
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
