import { useEffect, useState, useCallback } from 'react';
import { Mail, RefreshCw, Circle, Search, X, Inbox as InboxIcon } from 'lucide-react';

/* ============================================================
 * Inbox — Bloodred edition
 * Two-pane mail viewer, crimson accents, wider on big screens.
 * ============================================================ */

interface Thread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labelIds: string[];
  messageCount: number;
  unread: boolean;
}

interface Message {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  snippet: string;
  labelIds: string[];
}

const FILTERS = [
  { label: 'Inbox',      q: 'in:inbox' },
  { label: 'Ungelesen',  q: 'is:unread in:inbox' },
  { label: 'AEVUM',      q: 'label:aevum OR subject:aevum' },
  { label: 'Rechnungen', q: 'label:Rechnungen OR label:rechnungen-2026' },
  { label: 'Trading',    q: 'label:trading' },
];

function formatDate(raw: string) {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000)  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString('de-DE', { weekday: 'short' });
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  } catch { return raw.slice(0, 10); }
}

function fromName(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<[^>]+>/, '').trim() || from;
}

function BodyRenderer({ html }: { html: string }) {
  const isHtml = /<[a-z][\s\S]*>/i.test(html);
  if (!isHtml) {
    return <pre className="whitespace-pre-wrap text-[13px] text-[var(--text)] leading-relaxed font-sans">{html}</pre>;
  }
  return (
    <iframe
      srcDoc={`<html><head><style>
        body{font-family:Manrope,system-ui,sans-serif;font-size:13px;color:#f5f0eb;background:transparent;margin:16px;line-height:1.6;}
        a{color:#ff2b3a;}img{max-width:100%;}
      </style></head><body>${html}</body></html>`}
      className="w-full border-0 min-h-[400px]"
      style={{ height: '60vh' }}
      sandbox="allow-same-origin"
      title="email body"
    />
  );
}

export default function Inbox() {
  const [filter, setFilter] = useState(0);
  const [search, setSearch] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const q = search.trim() ? search.trim() : FILTERS[filter].q;
      const r = await fetch(`/api/gmail/threads?q=${encodeURIComponent(q)}&maxResults=25`);
      const json = await r.json();
      setThreads(json.threads || []);
    } catch { setThreads([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter, search]);

  useEffect(() => { fetchThreads(); setSelected(null); }, [filter]);
  useEffect(() => {
    if (!search.trim()) { fetchThreads(); setSelected(null); return; }
    const t = setTimeout(() => { fetchThreads(); setSelected(null); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const openThread = useCallback(async (id: string) => {
    setSelected(id);
    setThreadLoading(true);
    try {
      const r = await fetch(`/api/gmail/thread/${id}`);
      const json = await r.json();
      setMessages(json.messages || []);
      const unread = (json.messages || []).find((m: Message) => m.labelIds.includes('UNREAD'));
      if (unread) {
        fetch(`/api/gmail/mark-read/${unread.id}`, { method: 'POST' }).catch(() => {});
        setThreads(prev => prev.map(t => t.id === id ? { ...t, unread: false } : t));
      }
    } catch { setMessages([]); }
    finally { setThreadLoading(false); }
  }, []);

  const unreadCount = threads.filter(t => t.unread).length;

  return (
    <div className="flex h-full flex-col">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-8 lg:px-11 py-4 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center shadow-[0_0_18px_rgba(200,19,27,0.45)]">
              <Mail size={16} className="text-white" />
            </div>
            {unreadCount > 0 && (
              <span className="lx-pulse absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            )}
          </div>
          <div>
            <div className="lx-section-title mb-1">PersonalOS · Mail</div>
            <h1 className="lx-headline text-lg">
              Inbox
              {unreadCount > 0 && (
                <span className="ml-3 lx-pill lx-pill--accent">{unreadCount} ungelesen</span>
              )}
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">cwconsulting369@gmail.com</p>
          </div>
        </div>
        <button
          onClick={() => fetchThreads(true)}
          disabled={refreshing}
          className="lx-btn"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Sync…' : 'Refresh'}
        </button>
      </div>

      {/* ===== Filter pills + search ===== */}
      <div className="flex items-center gap-2 px-8 lg:px-11 py-3 border-b border-[var(--border)] flex-shrink-0 overflow-x-auto">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => { setFilter(i); setSearch(''); }}
            className={`flex-shrink-0 rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all ${
              filter === i && !search
                ? 'bg-[var(--accent-soft)] text-[var(--accent-glow)] border border-[var(--accent)]/40 shadow-[0_0_10px_rgba(200,19,27,0.2)]'
                : 'text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--border-strong)]'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto flex-shrink-0">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 pl-7 pr-7 py-1.5 text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none w-48 lg:w-64"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent-glow)]">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ===== 2-pane body ===== */}
      <div className="lx-inbox-shell flex-1 min-h-0 overflow-hidden">
        {/* Thread list */}
        <div className={selected ? 'lx-inbox-list lx-inbox-list--open' : 'lx-inbox-list lx-inbox-list--solo'}>
          {loading ? (
            <div className="lx-empty">
              <div className="lx-empty__glow"><RefreshCw size={18} className="animate-spin" /></div>
              <p className="text-[12px]">Lade…</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="lx-empty">
              <div className="lx-empty__glow"><InboxIcon size={20} /></div>
              <p className="text-[12px]">Keine Nachrichten in diesem Filter.</p>
            </div>
          ) : (
            threads.map(t => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`lx-thread-item ${selected === t.id ? 'lx-thread-item--active' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`text-[12.5px] truncate ${t.unread ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                    {fromName(t.from)}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0 font-mono">{formatDate(t.date)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {t.unread && <Circle size={6} className="text-[var(--accent-glow)] flex-shrink-0 fill-[var(--accent-glow)]" />}
                  <p className={`text-[11px] truncate ${t.unread ? 'text-[var(--text)] font-medium' : 'text-[var(--text-muted)]'}`}>
                    {t.subject}
                  </p>
                </div>
                {!selected && (
                  <p className="text-[11px] text-[var(--text-faint)] truncate mt-1 leading-snug">{t.snippet}</p>
                )}
                {t.messageCount > 1 && (
                  <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] mt-1 inline-block">
                    {t.messageCount} Nachrichten
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Thread reader */}
        {selected && (
          <div className="lx-inbox-reader">
            {threadLoading ? (
              <div className="lx-empty flex-1">
                <div className="lx-empty__glow"><RefreshCw size={18} className="animate-spin" /></div>
                <p className="text-[12px]">Lade Thread…</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="lx-empty flex-1">
                <div className="lx-empty__glow"><Mail size={20} /></div>
                <p className="text-[12px]">Keine Nachrichten.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Subject header */}
                <div className="px-8 lg:px-11 py-5 border-b border-[var(--border)] sticky top-0 bg-[var(--bg)]/95 backdrop-blur z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="lx-headline text-lg leading-tight">{messages[0]?.subject}</h2>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest mt-1">
                        {messages.length} Nachricht{messages.length !== 1 ? 'en' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="lx-btn flex-shrink-0"
                    >
                      <X size={12} /> Schließen
                    </button>
                  </div>
                </div>

                {/* Messages */}
                {messages.map((msg, i) => (
                  <div key={msg.id} className={`border-b border-[var(--border)] ${i === messages.length - 1 ? 'pb-10' : ''}`}>
                    <div className="px-8 lg:px-11 py-3.5 bg-[var(--surface)]/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-[var(--text)]">{fromName(msg.from)}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">An: {msg.to}</p>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] flex-shrink-0 font-mono">{formatDate(msg.date)}</p>
                      </div>
                    </div>
                    <div className="px-8 lg:px-11 py-5">
                      <BodyRenderer html={msg.body || msg.snippet} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
