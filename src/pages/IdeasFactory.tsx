import { useEffect, useState, useCallback } from 'react';
import { Lightbulb, RefreshCw, Search, X, Copy, Check, Plus, Tag, Mic, FileText } from 'lucide-react';
import { MarkdownViewer } from '../components/MarkdownViewer';

/* ============================================================
 * Idea-Factory v2 — Daylight HQ
 * Konsolidierte Ideen-DB (migration 005). Triage-Board mit
 * Inline-Status/Projekt/Prio-Edit + Trigram-Dubletten-Review.
 * Voice-Ideen: Toggle Original-Transkript (raw_transcript) ⇄ AI-aufgebessert (content).
 * ============================================================ */

interface Idea {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  raw_transcript: string | null;
  ai_note: string | null;
  value_add: string | null;
  url: string | null;
  tags: string[];
  status: string;
  evaluation: string | null;
  priority: string | null;
  leverage: string | null;
  category: string | null;
  project: string | null;
  source: string | null;
  origin: string;
  is_duplicate: boolean;
  created_at: string;
}
interface Stats { total: number; neu: number; in_arbeit: number; erledigt: number; verworfen: number; duplicates: number; offen_hoch: number; }
interface DupPair { id_a: string; title_a: string; id_b: string; title_b: string; sim: number; }

const STATUS_OPTS  = ['neu', 'in_arbeit', 'erledigt', 'verworfen'];
const PRIO_OPTS    = ['hoch', 'mittel', 'niedrig'];
const PROJ_OPTS    = ['aevum', 'utilityhub', 'lennoxos', 'ketolabs', 'gts', 'none'];

const STATUS_STYLE: Record<string, string> = {
  neu: 'text-[var(--accent-glow)] border-[var(--accent)]/40',
  in_arbeit: 'text-amber-300 border-amber-500/40',
  erledigt: 'text-emerald-300 border-emerald-500/40',
  verworfen: 'text-[var(--text-faint)] border-[var(--border)]',
};
const PRIO_STYLE: Record<string, string> = {
  hoch: 'text-red-300 border-red-500/40', mittel: 'text-amber-300 border-amber-500/40', niedrig: 'text-[var(--text-muted)] border-[var(--border)]',
};

const FILTERS = [
  { label: 'Alle', q: {} },
  { label: 'Neu', q: { status: 'neu' } },
  { label: 'In Arbeit', q: { status: 'in_arbeit' } },
  { label: 'Prio Hoch', q: { priority: 'hoch' } },
  { label: 'AEVUM', q: { project: 'aevum' } },
  { label: 'LennoxOS', q: { project: 'lennoxos' } },
  { label: 'UtilityHub', q: { project: 'utilityhub' } },
  { label: 'Erledigt', q: { status: 'erledigt' } },
];

function fmtDate(raw: string) {
  try { return new Date(raw).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: '2-digit' }); }
  catch { return raw.slice(0, 10); }
}

export default function IdeasFactory() {
  const [tab, setTab] = useState<'ideas' | 'dupes'>('ideas');
  const [filter, setFilter] = useState(0);
  const [search, setSearch] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dupes, setDupes] = useState<DupPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Idea | null>(null);
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false); // false = AI-aufgebessert (content), true = Original-Transkript

  // Bei Auswahlwechsel: Default zurück auf AI-aufgebesserte Ansicht
  useEffect(() => { setShowRaw(false); }, [selected?.id]);

  const fetchStats = useCallback(async () => {
    try { const r = await fetch('/api/ideas/stats'); setStats(await r.json()); } catch { /* noop */ }
  }, []);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(FILTERS[filter].q as Record<string, string>);
      if (search.trim()) params.set('q', search.trim());
      const r = await fetch(`/api/ideas?${params.toString()}`);
      const j = await r.json();
      setIdeas(j.rows || []);
    } catch { setIdeas([]); }
    finally { setLoading(false); }
  }, [filter, search]);

  const fetchDupes = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/ideas/dup-candidates'); setDupes((await r.json()).rows || []); }
    catch { setDupes([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (tab === 'ideas') fetchIdeas(); else fetchDupes(); }, [tab, filter, fetchIdeas, fetchDupes]);
  useEffect(() => {
    if (tab !== 'ideas') return;
    const t = setTimeout(fetchIdeas, 400); return () => clearTimeout(t);
  }, [search]); // eslint-disable-line

  const patch = useCallback(async (id: string, body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/ideas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const updated = await r.json();
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      if (selected?.id === id) setSelected(s => s ? { ...s, ...updated } : s);
      fetchStats();
    } catch { /* noop */ }
    finally { setSaving(false); }
  }, [selected, fetchStats]);

  const markDuplicate = useCallback(async (dupId: string, primaryId: string) => {
    await fetch(`/api/ideas/${dupId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_duplicate: true, duplicate_of: primaryId, status: 'verworfen' }) });
    setDupes(prev => prev.filter(p => p.id_a !== dupId && p.id_b !== dupId));
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="flex h-full flex-col">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-8 lg:px-11 py-4 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center" style={{ boxShadow: 'var(--shadow-accent)' }}>
            <Lightbulb size={16} className="text-white" />
          </div>
          <div>
            <div className="lx-section-title mb-1">LennoxOS · Idea-Factory</div>
            <h1 className="lx-headline text-lg">
              Ideen
              {stats && <span className="ml-3 lx-pill lx-pill--accent">{stats.total} aktiv</span>}
              {stats && stats.offen_hoch > 0 && <span className="ml-2 lx-pill" style={{ color: '#fca5a5' }}>{stats.offen_hoch} prio hoch</span>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setTab('ideas'); }} className={`lx-btn ${tab === 'ideas' ? 'lx-btn--active' : ''}`}>Ideen</button>
          <button onClick={() => { setTab('dupes'); }} className={`lx-btn ${tab === 'dupes' ? 'lx-btn--active' : ''}`}>
            <Copy size={12} /> Dubletten {stats && <span className="ml-1 opacity-70">({dupes.length || '·'})</span>}
          </button>
          <button onClick={() => { fetchStats(); tab === 'ideas' ? fetchIdeas() : fetchDupes(); }} className="lx-btn">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ===== Stats strip ===== */}
      {stats && (
        <div className="flex items-center gap-5 px-8 lg:px-11 py-2.5 border-b border-[var(--border)] flex-shrink-0 text-[11px] overflow-x-auto">
          {[['neu', stats.neu], ['in arbeit', stats.in_arbeit], ['erledigt', stats.erledigt], ['verworfen', stats.verworfen], ['dubletten', stats.duplicates]].map(([k, v]) => (
            <div key={k as string} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[var(--text)] font-semibold font-mono">{v}</span>
              <span className="text-[var(--text-muted)] uppercase tracking-wider">{k}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'ideas' ? (
        <>
          {/* ===== Filter pills + search ===== */}
          <div className="flex items-center gap-2 px-8 lg:px-11 py-3 border-b border-[var(--border)] flex-shrink-0 overflow-x-auto">
            {FILTERS.map((f, i) => (
              <button key={f.label} onClick={() => setFilter(i)}
                className={`flex-shrink-0 rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${
                  filter === i
                    ? 'bg-[var(--accent)] text-white border border-[var(--accent-strong)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--border-strong)]'
                }`}>{f.label}</button>
            ))}
            <div className="relative ml-auto flex-shrink-0">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 pl-7 pr-7 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none w-48 lg:w-64" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent-glow)]"><X size={11} /></button>}
            </div>
          </div>

          {/* ===== Cards + detail ===== */}
          <div className="flex-1 min-h-0 overflow-hidden flex">
            <div className={`overflow-y-auto p-5 ${selected ? 'w-1/2 border-r border-[var(--border)]' : 'w-full'}`}>
              {loading ? (
                <div className="lx-empty"><div className="lx-empty__glow"><RefreshCw size={18} className="animate-spin" /></div><p className="text-[12px]">Lade…</p></div>
              ) : ideas.length === 0 ? (
                <div className="lx-empty"><div className="lx-empty__glow"><Lightbulb size={20} /></div><p className="text-[12px]">Keine Ideen in diesem Filter.</p></div>
              ) : (
                <div className={`grid gap-3 ${selected ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'}`}>
                  {ideas.map(idea => (
                    <button key={idea.id} onClick={() => setSelected(idea)}
                      className={`lx-card text-left rounded-xl border p-4 transition-all ${
                        selected?.id === idea.id ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/30 bg-[var(--accent-soft)]' : 'border-[var(--border)]'
                      }`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-[13px] font-semibold text-[var(--text)] leading-snug line-clamp-2">{idea.title}</h3>
                        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider ${STATUS_STYLE[idea.status] || ''}`}>{idea.status}</span>
                      </div>
                      {idea.summary && <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 mb-2 leading-snug">{idea.summary}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        {idea.project && idea.project !== 'none' && <span className="lx-pill text-[9px]">{idea.project}</span>}
                        {idea.priority && <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${PRIO_STYLE[idea.priority]}`}>{idea.priority}</span>}
                        {idea.category && <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-wider">{idea.category}</span>}
                        <span className="ml-auto text-[9px] text-[var(--text-faint)] font-mono">{fmtDate(idea.created_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Detail drawer */}
            {selected && (
              <div className="w-1/2 overflow-y-auto p-6 bg-[var(--bg)]/50">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 className="lx-headline text-base leading-tight">{selected.title}</h2>
                  <button onClick={() => setSelected(null)} className="lx-btn flex-shrink-0"><X size={12} /></button>
                </div>

                {/* Triage controls */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  <Selector label="Status" value={selected.status} opts={STATUS_OPTS} onChange={v => patch(selected.id, { status: v })} disabled={saving} />
                  <Selector label="Prio" value={selected.priority || ''} opts={['', ...PRIO_OPTS]} onChange={v => patch(selected.id, { priority: v || null })} disabled={saving} />
                  <Selector label="Projekt" value={selected.project || ''} opts={['', ...PROJ_OPTS]} onChange={v => patch(selected.id, { project: v || null })} disabled={saving} />
                </div>

                {selected.summary && <Field label="Zusammenfassung">{selected.summary}</Field>}
                {selected.value_add && <Field label="Mehrwert">{selected.value_add}</Field>}
                {selected.ai_note && (
                  <div className="mb-4 rounded-xl border-l-[3px] border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Lightbulb size={11} style={{ color: 'var(--accent)' }} />
                      <span className="text-[9px] uppercase tracking-widest font-bold text-[var(--accent)]">Lennox · Einschätzung</span>
                    </div>
                    <div className="text-[12.5px] text-[var(--text)] leading-relaxed">{selected.ai_note}</div>
                  </div>
                )}
                {selected.url && <Field label="URL"><a href={selected.url} target="_blank" rel="noreferrer" className="text-[var(--accent-glow)] break-all hover:underline">{selected.url}</a></Field>}
                {(() => {
                  const hasRaw = !!selected.raw_transcript;
                  const isVoice = /voice|audio/.test(selected.source || '') || hasRaw;
                  const body = showRaw ? selected.raw_transcript : selected.content;
                  if (!selected.content && !hasRaw) return null;
                  return (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {isVoice ? <Mic size={12} style={{ color: 'var(--accent)' }} /> : <FileText size={12} style={{ color: 'var(--accent)' }} />}
                        <span className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: 'var(--text-muted)' }}>
                          {isVoice ? 'Transkript' : 'Inhalt'}
                        </span>
                        {/* Toggle: nur wenn beide Versionen existieren */}
                        {hasRaw && selected.content && (
                          <div className="ml-auto inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-[10px] font-semibold">
                            <button onClick={() => setShowRaw(false)}
                              className={`px-2.5 py-1 transition-colors ${!showRaw ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
                              ✨ AI-aufgebessert
                            </button>
                            <button onClick={() => setShowRaw(true)}
                              className={`px-2.5 py-1 transition-colors border-l border-[var(--border)] ${showRaw ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}>
                              🎤 Original
                            </button>
                          </div>
                        )}
                        {hasRaw && !selected.content && (
                          <span className="ml-auto lx-pill text-[9px]">nur Original</span>
                        )}
                      </div>
                      <div
                        className="rounded-xl px-4 py-3 max-h-[420px] overflow-y-auto"
                        style={{ background: '#fff', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', fontSize: 13.5 }}
                      >
                        {showRaw
                          ? <p className="whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]" style={{ fontSize: 13 }}>{body}</p>
                          : <MarkdownViewer content={body || ''} />}
                      </div>
                    </div>
                  );
                })()}
                {selected.tags?.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    <Tag size={11} className="text-[var(--text-muted)]" />
                    {selected.tags.map(t => <span key={t} className="lx-pill text-[9px]">{t}</span>)}
                  </div>
                )}
                <div className="mt-5 pt-3 border-t border-[var(--border-soft)] flex items-center justify-between text-[10px] text-[var(--text-faint)] uppercase tracking-wider">
                  <span>Origin: {selected.origin}</span>
                  <span>{fmtDate(selected.created_at)}</span>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ===== Dubletten-Review ===== */
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="lx-empty"><div className="lx-empty__glow"><RefreshCw size={18} className="animate-spin" /></div><p className="text-[12px]">Lade…</p></div>
          ) : dupes.length === 0 ? (
            <div className="lx-empty"><div className="lx-empty__glow"><Check size={20} /></div><p className="text-[12px]">Keine Dubletten-Kandidaten.</p></div>
          ) : (
            <div className="space-y-3 max-w-4xl">
              <p className="text-[11px] text-[var(--text-muted)] mb-4">{dupes.length} Kandidaten-Paare (Titel-Ähnlichkeit &gt; 0.35). Markiere die Variante die als Dublette weg soll.</p>
              {dupes.map((p, i) => (
                <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Ähnlichkeit</span>
                    <span className="font-mono text-[12px] text-[var(--accent-glow)] font-semibold">{(p.sim * 100).toFixed(0)}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[[p.id_a, p.title_a, p.id_b], [p.id_b, p.title_b, p.id_a]].map(([id, title, other]) => (
                      <div key={id} className="rounded-lg border border-[var(--border-soft)] p-3 flex flex-col gap-2">
                        <p className="text-[12px] text-[var(--text)] leading-snug flex-1">{title}</p>
                        <button onClick={() => markDuplicate(id, other)}
                          className="lx-btn text-[10px] self-start">→ als Dublette (von anderem)</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Selector({ label, value, opts, onChange, disabled }: { label: string; value: string; opts: string[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 px-2 py-1.5 text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]/50">
        {opts.map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </div>
  );
}
