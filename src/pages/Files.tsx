import React, { useEffect, useState, useCallback } from 'react';
import { Folder, File, ChevronRight, Home, ArrowLeft, Star, Pin } from 'lucide-react';

interface Entry { name: string; type: 'dir' | 'file'; size: number; mtime: number; birthtime: number; }
interface DirResult { path: string; type: 'dir'; entries: Entry[]; }
interface FileResult { path: string; type: 'file'; content: string; }

const FAV_KEY = 'lennox-os-favs';
const HOME_ROOT = '/home/carlos';

function loadFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function saveFavs(favs: string[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
}

function formatSize(bytes: number) {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(ms: number) {
  if (!ms || ms < 1000) return '—';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fileExt(name: string, type: 'dir' | 'file') {
  if (type === 'dir') return 'Ordner';
  const dot = name.lastIndexOf('.');
  if (dot === -1) return 'Datei';
  return name.slice(dot + 1).toUpperCase();
}

function buildBreadcrumbs(current: string) {
  // Strip HOME_ROOT prefix, show relative path
  const rel = current.startsWith(HOME_ROOT) ? current.slice(HOME_ROOT.length) : current;
  const parts = rel.split('/').filter(Boolean);
  // Each crumb: { label, path }
  const crumbs: { label: string; path: string }[] = [
    { label: '~', path: HOME_ROOT },
  ];
  parts.forEach((part, i) => {
    const path = HOME_ROOT + '/' + parts.slice(0, i + 1).join('/');
    crumbs.push({ label: part, path });
  });
  return crumbs;
}

export default function Files() {
  const [current, setCurrent] = useState(HOME_ROOT);
  const [data, setData] = useState<DirResult | FileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [favs, setFavs] = useState<string[]>(loadFavs);

  const navigate = useCallback(async (p: string, pushHistory = true) => {
    // Clamp to HOME_ROOT
    const target = p.startsWith('/home') ? p : HOME_ROOT;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/files?path=${encodeURIComponent(target)}`);
      const json = await r.json();
      if (json.error) {
        setError(json.error);
        setLoading(false);
        return;
      }
      if (pushHistory && current !== target) setHistory(h => [...h, current]);
      setCurrent(target);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    }
    setLoading(false);
  }, [current]);

  useEffect(() => { navigate('/home/carlos/personal-os', false); }, []);

  const back = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    navigate(prev, false);
  };

  const toggleFav = (e: React.MouseEvent, fullPath: string) => {
    e.stopPropagation();
    setFavs(prev => {
      const next = prev.includes(fullPath) ? prev.filter(f => f !== fullPath) : [...prev, fullPath];
      saveFavs(next);
      return next;
    });
  };

  const crumbs = buildBreadcrumbs(current);

  const COLS = 'grid-cols-[1fr_80px_90px_150px_150px_32px]';
  const HEADER = 'grid-cols-[1fr_80px_90px_150px_150px_32px]';

  return (
    <div className="p-6">
      {/* Favs strip */}
      {favs.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Pin size={12} className="text-os-cyan flex-shrink-0" />
          {favs.map(fav => (
            <button
              key={fav}
              onClick={() => navigate(fav)}
              className="flex items-center gap-1 text-xs bg-os-cyan/10 text-os-cyan px-2 py-1 rounded hover:bg-os-cyan/20 transition-colors"
            >
              <Folder size={11} />
              {fav.split('/').filter(Boolean).pop() || '~'}
              <span
                onClick={e => { e.stopPropagation(); setFavs(prev => { const n = prev.filter(f => f !== fav); saveFavs(n); return n; }); }}
                className="ml-1 text-os-muted hover:text-os-red transition-colors"
              >×</span>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(HOME_ROOT, false)} className="text-os-muted hover:text-os-cyan transition-colors" title="Home (~)">
          <Home size={15} />
        </button>
        {history.length > 0 && (
          <button onClick={back} className="text-os-muted hover:text-os-cyan transition-colors">
            <ArrowLeft size={15} />
          </button>
        )}
        <div className="flex items-center gap-1 text-xs text-os-muted font-mono">
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <ChevronRight size={11} />}
              <button
                onClick={() => navigate(crumb.path)}
                className={`hover:text-os-cyan transition-colors ${i === crumbs.length - 1 ? 'text-os-text' : ''}`}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>
        {/* Pin current dir */}
        {data?.type === 'dir' && (
          <button
            onClick={e => toggleFav(e, current)}
            className={`ml-auto transition-colors ${favs.includes(current) ? 'text-os-cyan' : 'text-os-muted hover:text-os-cyan'}`}
            title={favs.includes(current) ? 'Aus Favs entfernen' : 'Als Favorit pinnen'}
          >
            <Star size={14} fill={favs.includes(current) ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="bg-os-surface border border-os-border rounded overflow-hidden">
        {loading && <div className="p-4 text-xs text-os-muted">Loading...</div>}
        {error && !loading && (
          <div className="p-4 text-xs text-os-red font-mono">Fehler: {error}</div>
        )}

        {!loading && !error && data?.type === 'dir' && (
          <>
            <div className={`grid ${HEADER} px-4 py-2 border-b border-os-border bg-os-bg/40`}>
              <span className="text-xs text-os-muted uppercase tracking-wider">Name</span>
              <span className="text-xs text-os-muted uppercase tracking-wider">Typ</span>
              <span className="text-xs text-os-muted uppercase tracking-wider text-right">Größe</span>
              <span className="text-xs text-os-muted uppercase tracking-wider text-right">Geändert</span>
              <span className="text-xs text-os-muted uppercase tracking-wider text-right">Erstellt</span>
              <span />
            </div>
            {(data as DirResult).entries
              .sort((a, b) => {
                const fullA = current === HOME_ROOT ? `${HOME_ROOT}/${a.name}` : `${current}/${a.name}`;
                const fullB = current === HOME_ROOT ? `${HOME_ROOT}/${b.name}` : `${current}/${b.name}`;
                const aFav = favs.includes(fullA);
                const bFav = favs.includes(fullB);
                if (aFav !== bFav) return aFav ? -1 : 1;
                return a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1;
              })
              .map(entry => {
                const fullPath = `${current}/${entry.name}`;
                const isFav = favs.includes(fullPath);
                return (
                  <button
                    key={entry.name}
                    onClick={() => navigate(fullPath)}
                    className={`w-full grid ${COLS} items-center px-4 py-2 hover:bg-white/5 transition-colors border-b border-os-border/30 last:border-0 text-left ${isFav ? 'bg-os-cyan/5' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {entry.type === 'dir'
                        ? <Folder size={13} className={`flex-shrink-0 ${isFav ? 'text-os-cyan' : 'text-os-cyan/70'}`} />
                        : <File size={13} className="text-os-muted flex-shrink-0" />
                      }
                      <span className="text-sm text-os-text truncate">{entry.name}</span>
                    </div>
                    <span className="text-xs text-os-muted">{fileExt(entry.name, entry.type)}</span>
                    <span className="text-xs text-os-muted text-right">{entry.type === 'file' ? formatSize(entry.size) : '—'}</span>
                    <span className="text-xs text-os-muted text-right font-mono">{formatDate(entry.mtime)}</span>
                    <span className="text-xs text-os-muted text-right font-mono">{formatDate(entry.birthtime)}</span>
                    {entry.type === 'dir' && (
                      <span
                        onClick={e => toggleFav(e, fullPath)}
                        className={`flex justify-center transition-colors ${isFav ? 'text-os-cyan' : 'text-os-border hover:text-os-cyan'}`}
                      >
                        <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
                      </span>
                    )}
                    {entry.type === 'file' && <span />}
                  </button>
                );
              })}
            {(data as DirResult).entries.length === 0 && (
              <div className="p-4 text-xs text-os-muted">Leeres Verzeichnis</div>
            )}
          </>
        )}

        {!loading && !error && data?.type === 'file' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3 border-b border-os-border pb-2">
              <span className="text-xs text-os-muted font-mono truncate">{current}</span>
              <button
                onClick={back}
                className="text-xs text-os-muted hover:text-os-cyan transition-colors ml-4 flex-shrink-0"
              >
                ← Zurück
              </button>
            </div>
            <pre className="text-xs text-os-text whitespace-pre-wrap font-mono overflow-auto max-h-[70vh]">
              {(data as FileResult).content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
