import { useEffect, useState, useCallback } from 'react';
import { Mail, RefreshCw, ChevronRight, Circle, Search, X } from 'lucide-react';

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
  { label: 'Inbox', q: 'in:inbox' },
  { label: 'Ungelesen', q: 'is:unread in:inbox' },
  { label: 'AEVUM', q: 'label:aevum OR subject:aevum' },
  { label: 'Rechnungen', q: 'label:Rechnungen OR label:rechnungen-2026' },
  { label: 'Trading', q: 'label:trading' },
];

function formatDate(raw: string) {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
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
    return <pre className="whitespace-pre-wrap text-[13px] text-os-text leading-relaxed font-sans">{html}</pre>;
  }
  return (
    <iframe
      srcDoc={`<html><head><style>
        body{font-family:system-ui,sans-serif;font-size:13px;color:#e2e8f0;background:#0f1117;margin:16px;line-height:1.6;}
        a{color:#22d3ee;}img{max-width:100%;}
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
      // mark first unread message as read
      const unread = (json.messages || []).find((m: Message) => m.labelIds.includes('UNREAD'));
      if (unread) {
        fetch(`/api/gmail/mark-read/${unread.id}`, { method: 'POST' }).catch(() => {});
        setThreads(prev => prev.map(t => t.id === id ? { ...t, unread: false } : t));
      }
    } catch { setMessages([]); }
    finally { setThreadLoading(false); }
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-os-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-os-cyan/10">
            <Mail size={15} className="text-os-cyan" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-os-text">Inbox</h1>
            <p className="text-[10px] text-os-muted">cwconsulting369@gmail.com</p>
          </div>
        </div>
        <button
          onClick={() => fetchThreads(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:border-os-accent/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-2 px-5 py-2 border-b border-os-border flex-shrink-0 overflow-x-auto">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            onClick={() => { setFilter(i); setSearch(''); }}
            className={`flex-shrink-0 rounded-full px-3 py-0.5 text-[11px] font-medium transition-colors ${
              filter === i && !search
                ? 'bg-os-cyan/15 text-os-cyan border border-os-cyan/30'
                : 'text-os-muted border border-os-border hover:text-os-text'
            }`}
          >{f.label}</button>
        ))}
        <div className="relative ml-auto flex-shrink-0">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-os-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen..."
            className="rounded-lg border border-os-border bg-os-surface pl-6 pr-6 py-1 text-[11px] text-os-text placeholder:text-os-muted focus:outline-none focus:border-os-cyan/50 w-40"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-os-muted hover:text-os-text">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Main: thread list + reader */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Thread list */}
        <div className={`flex-shrink-0 border-r border-os-border overflow-y-auto ${selected ? 'w-72' : 'flex-1'}`}>
          {loading ? (
            <div className="p-6 text-center text-xs text-os-muted">Lade...</div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-xs text-os-muted">Keine Nachrichten</div>
          ) : (
            threads.map(t => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`w-full text-left px-4 py-3 border-b border-os-border transition-colors hover:bg-white/5 ${
                  selected === t.id ? 'bg-os-cyan/5 border-l-2 border-l-os-cyan' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`text-[12px] truncate ${t.unread ? 'font-semibold text-os-text' : 'text-os-muted'}`}>
                    {fromName(t.from)}
                  </span>
                  <span className="text-[10px] text-os-muted flex-shrink-0">{formatDate(t.date)}</span>
                </div>
                <div className="flex items-center gap-1">
                  {t.unread && <Circle size={6} className="text-os-cyan flex-shrink-0 fill-os-cyan" />}
                  <p className={`text-[11px] truncate ${t.unread ? 'text-os-text' : 'text-os-muted'}`}>{t.subject}</p>
                </div>
                {!selected && (
                  <p className="text-[11px] text-os-muted/70 truncate mt-0.5">{t.snippet}</p>
                )}
                {t.messageCount > 1 && (
                  <span className="text-[9px] text-os-muted">{t.messageCount} Nachrichten</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Thread reader */}
        {selected && (
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {threadLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-os-muted">Lade...</div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-os-muted">Keine Nachrichten</div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Subject header */}
                <div className="px-6 py-4 border-b border-os-border sticky top-0 bg-os-bg z-10">
                  <h2 className="text-sm font-semibold text-os-text leading-tight">{messages[0]?.subject}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-os-muted">{messages.length} Nachricht{messages.length !== 1 ? 'en' : ''}</span>
                    <button onClick={() => setSelected(null)} className="ml-auto text-[10px] text-os-muted hover:text-os-cyan flex items-center gap-1">
                      <X size={10} /> Schließen
                    </button>
                  </div>
                </div>
                {/* Messages */}
                {messages.map((msg, i) => (
                  <div key={msg.id} className={`border-b border-os-border ${i === messages.length - 1 ? 'pb-8' : ''}`}>
                    <div className="px-6 py-3 bg-os-surface/50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-medium text-os-text">{fromName(msg.from)}</p>
                          <p className="text-[10px] text-os-muted">An: {msg.to}</p>
                        </div>
                        <p className="text-[10px] text-os-muted flex-shrink-0">{formatDate(msg.date)}</p>
                      </div>
                    </div>
                    <div className="px-6 py-4">
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
