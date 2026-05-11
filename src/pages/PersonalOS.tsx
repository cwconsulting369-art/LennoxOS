import { useEffect, useState, useCallback, useRef } from 'react';
import {
  BookOpen,
  Folder,
  FileText,
  ChevronRight,
  ChevronLeft,
  Search,
  File,
} from 'lucide-react';

interface DirEntry {
  name: string;
  type: 'dir' | 'file';
  size: number;
  mtime: number;
}

interface DirResponse {
  path: string;
  type: 'dir';
  entries: DirEntry[];
}

interface FileResponse {
  path: string;
  type: 'file';
  content: string;
}

type ApiResponse = DirResponse | FileResponse;

const ROOT = '/home/carlos/personal-os';

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function fileIcon(entry: DirEntry) {
  if (entry.type === 'dir') return <Folder size={15} className="text-os-yellow flex-shrink-0" />;
  if (entry.name.endsWith('.md'))
    return <FileText size={15} className="text-os-cyan flex-shrink-0" />;
  return <File size={15} className="text-os-muted flex-shrink-0" />;
}

function fileColor(entry: DirEntry): string {
  if (entry.type === 'dir') return 'text-os-yellow';
  if (entry.name.endsWith('.md')) return 'text-os-cyan';
  return 'text-os-muted';
}

function Breadcrumbs({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (p: string) => void;
}) {
  const segments = path.replace(ROOT, '').split('/').filter(Boolean);

  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs min-w-0">
      <button
        onClick={() => onNavigate(ROOT)}
        className="font-medium text-os-accent hover:underline flex-shrink-0"
      >
        personal-os
      </button>
      {segments.map((seg, i) => {
        const targetPath = ROOT + '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        return (
          <span key={targetPath} className="flex items-center gap-1 flex-shrink-0 min-w-0">
            <ChevronRight size={11} className="text-os-border" />
            {isLast ? (
              <span className="text-os-text font-medium truncate max-w-[160px]">{seg}</span>
            ) : (
              <button
                onClick={() => onNavigate(targetPath)}
                className="text-os-muted hover:text-os-accent hover:underline truncate max-w-[120px]"
              >
                {seg}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function FileModal({
  path,
  content,
  onClose,
}: {
  path: string;
  content: string;
  onClose: () => void;
}) {
  const filename = path.split('/').pop() ?? path;

  // Close on backdrop click
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 overflow-y-auto"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-xl border border-os-border bg-os-bg shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-os-border px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={14} className="text-os-cyan flex-shrink-0" />
            <span className="text-sm font-semibold text-os-text truncate">{filename}</span>
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-lg px-2 py-1 text-xs text-os-muted hover:text-os-text hover:bg-os-border/50 transition-colors"
          >
            Schließen ✕
          </button>
        </div>
        {/* Content */}
        <div className="overflow-auto max-h-[70vh] p-4">
          <pre className="text-xs text-os-text font-mono whitespace-pre-wrap leading-relaxed">
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default function PersonalOS() {
  const [currentPath, setCurrentPath] = useState(ROOT);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [historyStack, setHistoryStack] = useState<string[]>([]);

  // File viewer modal
  const [modalFile, setModalFile] = useState<{ path: string; content: string } | null>(null);

  const navigate = useCallback(
    async (path: string, pushHistory = true) => {
      if (pushHistory && path !== currentPath) {
        setHistoryStack((prev) => [...prev, currentPath]);
      }
      setCurrentPath(path);
      setLoading(true);
      setError(null);
      setFilter('');
      try {
        const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        setResponse(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
        setResponse(null);
      } finally {
        setLoading(false);
      }
    },
    [currentPath]
  );

  const goBack = useCallback(() => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((s) => s.slice(0, -1));
    navigate(prev, false);
  }, [historyStack, navigate]);

  // Handle entry click
  const handleEntryClick = useCallback(
    async (entry: DirEntry, parentPath: string) => {
      const fullPath = `${parentPath}/${entry.name}`;
      if (entry.type === 'dir') {
        navigate(fullPath);
        return;
      }
      // File — fetch content
      setLoading(true);
      try {
        const res = await fetch(`/api/files?path=${encodeURIComponent(fullPath)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (json.type === 'file') {
          setModalFile({ path: fullPath, content: json.content });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Fehler beim Laden der Datei');
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    navigate(ROOT, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries =
    response?.type === 'dir'
      ? response.entries
          .filter((e) =>
            filter
              ? e.name.toLowerCase().includes(filter.toLowerCase())
              : true
          )
          .sort((a, b) => {
            // Dirs first, then files
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
      : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
            <BookOpen size={18} className="text-os-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text">Personal OS Navigator</h1>
            <p className="text-xs text-os-muted">Dateibrowser für personal-os</p>
          </div>
        </div>
        {historyStack.length > 0 && (
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 rounded-lg border border-os-border bg-os-surface px-3 py-1.5 text-xs text-os-muted hover:text-os-text hover:border-os-accent/50 transition-colors"
          >
            <ChevronLeft size={12} />
            Zurück
          </button>
        )}
      </div>

      {/* Breadcrumbs */}
      <div className="rounded-xl border border-os-border bg-os-surface px-4 py-3">
        <Breadcrumbs path={currentPath} onNavigate={(p) => navigate(p)} />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-os-red/30 bg-os-red/10 px-4 py-3 text-sm text-os-red">
          Fehler: {error}
        </div>
      )}

      {/* Filter — only for dirs with many entries */}
      {response?.type === 'dir' && (response.entries?.length ?? 0) > 8 && (
        <div className="relative">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-os-muted"
          />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="w-full rounded-xl border border-os-border bg-os-surface py-2 pl-9 pr-4 text-sm text-os-text placeholder:text-os-muted outline-none focus:border-os-accent/50 transition-colors"
          />
        </div>
      )}

      {/* Directory listing */}
      {loading ? (
        <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-os-border/50 last:border-0 animate-pulse"
            >
              <div className="h-4 w-4 rounded bg-os-border/60" />
              <div className="h-3 w-40 rounded bg-os-border/60" />
              <div className="ml-auto h-3 w-16 rounded bg-os-border/40" />
            </div>
          ))}
        </div>
      ) : response?.type === 'dir' ? (
        entries.length > 0 ? (
          <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
            {entries.map((entry) => (
              <button
                key={entry.name}
                onClick={() => handleEntryClick(entry, currentPath)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-os-border/50 last:border-0 hover:bg-os-elevated/60 transition-colors text-left group"
              >
                {fileIcon(entry)}
                <span
                  className={`flex-1 text-sm font-medium truncate ${fileColor(entry)} group-hover:opacity-90`}
                >
                  {entry.name}
                </span>
                {entry.type === 'file' && (
                  <span className="flex-shrink-0 text-[11px] text-os-muted hidden sm:block">
                    {formatBytes(entry.size)}
                  </span>
                )}
                <span className="flex-shrink-0 text-[11px] text-os-muted hidden sm:block">
                  {formatDate(entry.mtime)}
                </span>
                {entry.type === 'dir' && (
                  <ChevronRight size={13} className="flex-shrink-0 text-os-border group-hover:text-os-muted" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-os-border bg-os-surface p-8 text-center">
            <Folder size={24} className="mx-auto mb-2 text-os-muted" />
            <p className="text-sm text-os-muted">
              {filter ? 'Keine Treffer' : 'Ordner ist leer'}
            </p>
          </div>
        )
      ) : null}

      {/* Entry count */}
      {!loading && response?.type === 'dir' && (
        <p className="text-xs text-os-muted text-right">
          {entries.length}{' '}
          {filter && response.entries.length !== entries.length
            ? `von ${response.entries.length} `
            : ''}
          Einträge
        </p>
      )}

      {/* File modal */}
      {modalFile && (
        <FileModal
          path={modalFile.path}
          content={modalFile.content}
          onClose={() => setModalFile(null)}
        />
      )}
    </div>
  );
}
