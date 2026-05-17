import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Plus, RotateCw, CheckCircle2, XCircle, Clock, AlertTriangle, ListTodo, Hourglass } from 'lucide-react';

interface Service {
  id: number;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  restarts: number;
  uptime: number;
}

interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  assignee?: { name: string };
}

const STATUS_COLOR: Record<string, string> = {
  online: 'text-os-green',
  stopped: 'text-os-yellow',
  errored: 'text-os-red',
  stopping: 'text-os-yellow',
};

const PRIORITY_LABEL: Record<number, string> = { 0: 'No', 1: 'Urgent', 2: 'High', 3: 'Med', 4: 'Low' };
const PRIORITY_COLOR: Record<number, string> = {
  0: 'text-os-muted', 1: 'text-os-red', 2: 'text-orange-400', 3: 'text-os-yellow', 4: 'text-os-muted',
};

function formatUptime(ts: number) {
  const ms = Date.now() - ts;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function TodayWidget({ content, loading }: { content: string; loading: boolean }) {
  const lines = content.split('\n');
  const tasks = lines.filter(l => /^\s*-\s*\[[ x]\]/.test(l));
  const open = tasks.filter(l => /^\s*-\s*\[ \]/.test(l));
  const done = tasks.filter(l => /^\s*-\s*\[x\]/i.test(l));
  const titleLine = lines.find(l => l.startsWith('# '))?.replace(/^#\s*/, '') || 'Heute';

  if (loading || !content) return null;

  return (
    <div className="mt-4 bg-os-surface border border-os-border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo size={13} className="text-os-cyan" />
          <span className="text-xs text-os-muted uppercase tracking-wider">Today's Tasks</span>
        </div>
        <span className="text-xs text-os-muted">{done.length}/{tasks.length} erledigt</span>
      </div>
      <p className="text-xs text-os-muted mb-3 truncate">{titleLine}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {open.slice(0, 12).map((t, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-0.5 w-3 h-3 flex-shrink-0 rounded-sm border border-os-muted" />
            <span className="text-xs text-os-text line-clamp-1">
              {t.replace(/^\s*-\s*\[ \]\s*/, '')}
            </span>
          </div>
        ))}
        {done.slice(0, 6).map((t, i) => (
          <div key={`d${i}`} className="flex items-start gap-2 opacity-40">
            <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0 text-os-green" />
            <span className="text-xs text-os-text line-clamp-1 line-through">
              {t.replace(/^\s*-\s*\[x\]\s*/i, '')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WaitingSection { who: string; items: string[]; }

function parseWaitingFor(content: string): WaitingSection[] {
  if (!content) return [];
  const sections: WaitingSection[] = [];
  let current: WaitingSection | null = null;
  for (const line of content.split('\n')) {
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      if (current && current.items.length > 0) sections.push(current);
      current = { who: h3[1].trim(), items: [] };
    } else if (current && (line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
      const text = line.replace(/^\s*[-*]\s*/, '').replace(/\*\*/g, '').trim();
      if (text && !text.endsWith(':')) current.items.push(text);
    }
  }
  if (current && current.items.length > 0) sections.push(current);
  return sections;
}

function WaitingForWidget({ content, loading }: { content: string; loading: boolean }) {
  if (loading || !content) return null;
  const sections = parseWaitingFor(content);
  if (sections.length === 0) return null;
  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);

  return (
    <div className="mt-4 bg-os-surface border border-os-border rounded p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hourglass size={13} className="text-os-yellow" />
          <span className="text-xs text-os-muted uppercase tracking-wider">Waiting For</span>
        </div>
        <span className="text-xs text-os-muted">{totalItems} offen</span>
      </div>
      <div className="space-y-3">
        {sections.map((sec, si) => (
          <div key={si}>
            <p className="text-[10px] font-semibold text-os-yellow uppercase tracking-wider mb-1.5">{sec.who}</p>
            <div className="space-y-1 pl-2">
              {sec.items.slice(0, 4).map((item, ii) => (
                <div key={ii} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-os-yellow/50 flex-shrink-0" />
                  <span className="text-xs text-os-text line-clamp-1">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommandCenter({ activePage }: { activePage: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [newIssue, setNewIssue] = useState({ title: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [today, setToday] = useState<string>('');
  const [waiting, setWaiting] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [svc, iss, tod, wai] = await Promise.all([
        fetch('/api/services').then(r => r.json()),
        fetch('/api/issues').then(r => r.json()),
        fetch('/api/today').then(r => r.json()).catch(() => ({ content: '' })),
        fetch('/api/waiting').then(r => r.json()).catch(() => ({ content: '' })),
      ]);
      setServices(Array.isArray(svc) ? svc : []);
      setIssues(Array.isArray(iss?.issues) ? iss.issues : Array.isArray(iss) ? iss : []);
      setToday(tod?.content || '');
      setWaiting(wai?.content || '');
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const restart = async (name: string) => {
    setRestarting(name);
    await fetch(`/api/services/${name}/restart`, { method: 'POST' });
    await new Promise(r => setTimeout(r, 1500));
    await load();
    setRestarting(null);
  };

  const createIssue = async () => {
    if (!newIssue.title.trim()) return;
    setSubmitting(true);
    await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newIssue.title, description: newIssue.description, status: 'open' }),
    });
    setNewIssue({ title: '', description: '' });
    setShowForm(false);
    await load();
    setSubmitting(false);
  };

  const online = services.filter(s => s.status === 'online').length;

  if (activePage === 'services') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-white">Services</h1>
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-os-muted hover:text-os-cyan transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
        <div className="space-y-2">
          {services.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-os-surface border border-os-border rounded px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${s.status === 'online' ? 'bg-os-green' : s.status === 'errored' ? 'bg-os-red' : 'bg-os-yellow'}`} />
                <span className="text-sm text-white font-medium">{s.name}</span>
                <span className={`text-xs ${STATUS_COLOR[s.status] || 'text-os-muted'}`}>{s.status}</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-os-muted">
                <span>CPU {s.cpu}%</span>
                <span>RAM {s.memory}MB</span>
                <span>↺ {s.restarts}</span>
                <span>{s.uptime ? formatUptime(s.uptime) : '–'}</span>
                <button
                  onClick={() => restart(s.name)}
                  disabled={restarting === s.name}
                  className="text-os-muted hover:text-os-cyan transition-colors disabled:opacity-40"
                >
                  <RotateCw size={13} className={restarting === s.name ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          ))}
          {loading && <p className="text-os-muted text-sm">Loading...</p>}
        </div>
      </div>
    );
  }

  if (activePage === 'issues') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-white">Issues</h1>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-xs text-os-muted hover:text-os-cyan transition-colors flex items-center gap-1.5">
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 text-xs bg-os-cyan/10 text-os-cyan px-3 py-1.5 rounded hover:bg-os-cyan/20 transition-colors"
            >
              <Plus size={13} /> New Issue
            </button>
          </div>
        </div>
        {showForm && (
          <div className="bg-os-surface border border-os-border rounded p-4 mb-4 space-y-3">
            <input
              className="w-full bg-os-bg border border-os-border rounded px-3 py-2 text-sm text-white placeholder-os-muted focus:outline-none focus:border-os-cyan"
              placeholder="Issue title..."
              value={newIssue.title}
              onChange={e => setNewIssue(p => ({ ...p, title: e.target.value }))}
            />
            <textarea
              className="w-full bg-os-bg border border-os-border rounded px-3 py-2 text-sm text-white placeholder-os-muted focus:outline-none focus:border-os-cyan resize-none"
              placeholder="Description (optional)..."
              rows={3}
              value={newIssue.description}
              onChange={e => setNewIssue(p => ({ ...p, description: e.target.value }))}
            />
            <div className="flex gap-2">
              <button
                onClick={createIssue}
                disabled={submitting || !newIssue.title.trim()}
                className="text-xs bg-os-cyan text-os-bg px-3 py-1.5 rounded font-medium hover:opacity-90 disabled:opacity-40"
              >
                {submitting ? 'Creating...' : 'Create'}
              </button>
              <button onClick={() => setShowForm(false)} className="text-xs text-os-muted hover:text-os-text px-3 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {issues.map(issue => (
            <div key={issue.id} className="flex items-start justify-between bg-os-surface border border-os-border rounded px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-os-muted text-xs mt-0.5 font-mono">{issue.identifier}</span>
                <div>
                  <p className="text-sm text-white">{issue.title}</p>
                  {issue.assignee && <p className="text-xs text-os-muted mt-0.5">{issue.assignee.name}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs ml-4 flex-shrink-0">
                <span className={PRIORITY_COLOR[issue.priority] || 'text-os-muted'}>{PRIORITY_LABEL[issue.priority] || '–'}</span>
                <span className="text-os-muted capitalize">{issue.status}</span>
              </div>
            </div>
          ))}
          {!loading && issues.length === 0 && <p className="text-os-muted text-sm">No open issues.</p>}
          {loading && <p className="text-os-muted text-sm">Loading...</p>}
        </div>
      </div>
    );
  }

  // Command Center (default)
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          Command Center
        </h1>
        <button onClick={load} className="text-xs text-os-muted hover:text-os-cyan transition-colors flex items-center gap-1.5">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* System Health */}
        <div className="bg-os-surface border border-os-border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-os-muted uppercase tracking-wider">System Health</span>
            <span className="text-xs text-os-cyan">{online}/{services.length} online</span>
          </div>
          <div className="space-y-2">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    s.status === 'online' ? 'bg-os-green' : s.status === 'errored' ? 'bg-os-red' : 'bg-os-yellow'
                  }`} />
                  <span className="text-xs text-os-text truncate max-w-[110px]">{s.name}</span>
                </div>
                <span className={`text-xs ${STATUS_COLOR[s.status] || 'text-os-muted'}`}>{s.status}</span>
              </div>
            ))}
            {loading && <p className="text-xs text-os-muted">Loading...</p>}
          </div>
        </div>

        {/* Active Issues */}
        <div className="bg-os-surface border border-os-border rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-os-muted uppercase tracking-wider">Active Issues</span>
            <span className="text-xs text-os-cyan">{issues.length}</span>
          </div>
          <div className="space-y-2">
            {issues.slice(0, 10).map(issue => (
              <div key={issue.id} className="flex items-start gap-2">
                <AlertTriangle size={11} className={`mt-0.5 flex-shrink-0 ${PRIORITY_COLOR[issue.priority] || 'text-os-muted'}`} />
                <span className="text-xs text-os-text line-clamp-1">{issue.title}</span>
              </div>
            ))}
            {!loading && issues.length === 0 && <p className="text-xs text-os-muted">No open issues</p>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-os-surface border border-os-border rounded p-4">
          <div className="mb-3">
            <span className="text-xs text-os-muted uppercase tracking-wider">Quick Actions</span>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center gap-2 text-xs text-os-text hover:text-os-cyan transition-colors py-1.5"
            >
              <Plus size={13} /> New Issue
            </button>
            <a
              href="https://paperclip.lennoxos.com"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-2 text-xs text-os-text hover:text-os-cyan transition-colors py-1.5"
            >
              <CheckCircle2 size={13} /> Open Paperclip
            </a>
            <a
              href="https://terminal.lennoxos.com"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-2 text-xs text-os-text hover:text-os-cyan transition-colors py-1.5"
            >
              <Clock size={13} /> Terminal
            </a>
          </div>
          {showForm && (
            <div className="mt-3 space-y-2 border-t border-os-border pt-3">
              <input
                className="w-full bg-os-bg border border-os-border rounded px-2 py-1.5 text-xs text-white placeholder-os-muted focus:outline-none focus:border-os-cyan"
                placeholder="Issue title..."
                value={newIssue.title}
                onChange={e => setNewIssue(p => ({ ...p, title: e.target.value }))}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={createIssue}
                  disabled={submitting || !newIssue.title.trim()}
                  className="text-xs bg-os-cyan text-os-bg px-2 py-1 rounded font-medium hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? '...' : 'Create'}
                </button>
                <button onClick={() => setShowForm(false)} className="text-xs text-os-muted px-2 py-1">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's Tasks */}
      <TodayWidget content={today} loading={loading} />

      {/* Waiting For */}
      <WaitingForWidget content={waiting} loading={loading} />
    </div>
  );
}
