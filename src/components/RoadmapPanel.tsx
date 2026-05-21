import { useState, useEffect } from 'react';
import { RefreshCw, FileText, ExternalLink } from 'lucide-react';
import { MarkdownViewer } from './MarkdownViewer';

interface Props {
  path: string;
  editHint?: string;
}

export function RoadmapPanel({ path, editHint }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/files/read?path=${encodeURIComponent(path)}`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(data => { setContent(data.content ?? null); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [path, ts]);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-os-muted text-sm gap-2">
      <RefreshCw size={14} className="animate-spin" /> Lade Roadmap...
    </div>
  );

  if (error || !content) return (
    <div className="rounded-xl border border-os-border bg-os-surface p-6 text-center space-y-3">
      <FileText size={24} className="text-os-muted mx-auto" />
      <p className="text-sm text-os-muted">Roadmap noch nicht angelegt</p>
      <p className="text-[11px] text-os-muted/60 font-mono">{path}</p>
      {editHint && <p className="text-[11px] text-os-cyan">{editHint}</p>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-os-muted font-mono truncate">{path}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setTs(Date.now())}
            className="flex items-center gap-1 text-[10px] text-os-muted hover:text-os-cyan transition-colors">
            <RefreshCw size={10} /> Refresh
          </button>
          <a href={`https://lennoxos.com`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-os-muted hover:text-os-cyan transition-colors">
            <ExternalLink size={10} /> Edit via Files
          </a>
        </div>
      </div>
      <div className="rounded-xl border border-os-border bg-os-surface p-5 overflow-auto max-h-[calc(100vh-220px)]">
        <MarkdownViewer content={content} />
      </div>
    </div>
  );
}
