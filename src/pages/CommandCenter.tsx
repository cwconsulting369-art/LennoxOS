import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw, ListTodo, Hourglass, AlertTriangle, CheckCircle2,
  Calendar, Mail, Bot, Zap, FolderOpen, ExternalLink,
} from 'lucide-react';

interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  priority: number;
  assignee?: { name: string };
}

interface SyncBoard {
  blueprints: Array<{ name: string; mtime: string }>;
  submissions: Array<{ name: string; mtime: string }>;
}

const PRIORITY_LABEL: Record<number, string> = { 0: 'No', 1: 'Urgent', 2: 'High', 3: 'Med', 4: 'Low' };
const PRIORITY_COLOR: Record<number, string> = {
  0: 'text-os-muted', 1: 'text-os-red', 2: 'text-orange-400', 3: 'text-os-yellow', 4: 'text-os-muted',
};

function parseTasks(content: string) {
  const lines = content.split('\n');
  const tasks = lines.filter(l => /^\s*-\s*\[[ x]\]/.test(l));
  const open = tasks.filter(l => /^\s*-\s*\[ \]/.test(l)).map(l => l.replace(/^\s*-\s*\[ \]\s*/, ''));
  const done = tasks.filter(l => /^\s*-\s*\[x\]/i.test(l)).map(l => l.replace(/^\s*-\s*\[x\]\s*/i, ''));
  return { open, done, total: tasks.length };
}

export default function CommandCenter() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [today, setToday] = useState<string>('');
  const [waiting, setWaiting] = useState<string>('');
  const [kevinSync, setKevinSync] = useState<SyncBoard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [iss, tod, wai, sync] = await Promise.all([
        fetch('/api/issues').then(r => r.json()).catch(() => ({ issues: [] })),
        fetch('/api/today').then(r => r.json()).catch(() => ({ content: '' })),
        fetch('/api/waiting').then(r => r.json()).catch(() => ({ content: '' })),
        fetch('/api/gts/board').then(r => r.json()).catch(() => null),
      ]);
      setIssues(Array.isArray(iss?.issues) ? iss.issues : []);
      setToday(tod?.content || '');
      setWaiting(wai?.content || '');
      setKevinSync(sync);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const tasks = parseTasks(today);
  const priorityIssues = issues.filter(i => i.priority === 1 || i.priority === 2);

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-cyan/10">
            <Zap size={18} className="text-os-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text leading-tight">Command Center</h1>
            <p className="text-[10px] text-os-muted">Operativ — nur was heute wichtig ist</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-os-muted hover:text-os-cyan transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Sync
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Tasks heute" value={`${tasks.done.length}/${tasks.total}`} sub={`${tasks.open.length} offen`} color="text-os-cyan" />
        <Kpi label="Urgent + High Issues" value={priorityIssues.length} sub={`von ${issues.length} total`} color={priorityIssues.length > 0 ? 'text-os-red' : 'text-os-green'} />
        <Kpi label="Kevin Blueprints" value={kevinSync?.blueprints.length ?? '—'} sub={`${kevinSync?.submissions.length ?? 0} submissions`} color="text-os-yellow" />
        <Kpi label="Termine" value="—" sub="Calendar TBD" color="text-os-muted" />
      </div>

      {/* Heute Section */}
      <Panel
        title="Heute"
        icon={ListTodo}
        right={tasks.total > 0 ? `${tasks.done.length}/${tasks.total} done` : 'Keine Tasks'}
      >
        {tasks.open.length === 0 && tasks.done.length === 0 ? (
          <p className="text-[12px] text-os-muted italic">Keine Tasks für heute. Open <code>02-tasks/today.md</code> via Files-Page.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {tasks.open.slice(0, 14).map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="mt-1 w-3 h-3 flex-shrink-0 rounded-sm border border-os-muted" />
                <span className="text-os-text">{t}</span>
              </div>
            ))}
            {tasks.done.slice(0, 6).map((t, i) => (
              <div key={`d${i}`} className="flex items-start gap-2 opacity-40 text-[12px]">
                <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0 text-os-green" />
                <span className="text-os-text line-through">{t}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Critical Issues */}
      {priorityIssues.length > 0 && (
        <Panel title="Urgent / High Priority Issues" icon={AlertTriangle} right={`${priorityIssues.length} aktiv`}>
          <ul className="space-y-1">
            {priorityIssues.slice(0, 8).map(i => (
              <li key={i.id} className="flex items-center justify-between text-[12px] py-1.5 px-2 rounded hover:bg-os-elevated">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold ${PRIORITY_COLOR[i.priority]}`}>{PRIORITY_LABEL[i.priority]}</span>
                  <span className="text-os-text">{i.identifier}: {i.title}</span>
                </div>
                <span className="text-[10px] text-os-muted">{i.assignee?.name || '—'}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Waiting For */}
      {waiting && parseTasks(waiting).open.length > 0 && (
        <Panel title="Warte auf andere" icon={Hourglass} right={`${parseTasks(waiting).open.length} offen`}>
          <ul className="space-y-1">
            {parseTasks(waiting).open.slice(0, 8).map((t, i) => (
              <li key={i} className="text-[12px] text-os-text flex items-center gap-2 py-1 px-2 rounded hover:bg-os-elevated">
                <Hourglass size={11} className="text-os-yellow flex-shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Kevin / K3ngama Sync */}
      <Panel
        title="Kevin (K3ngama) Sync"
        icon={Bot}
        right={kevinSync ? `${kevinSync.blueprints.length} blueprints` : 'offline'}
      >
        {!kevinSync || kevinSync.blueprints.length === 0 ? (
          <p className="text-[12px] text-os-muted italic">Keine offenen Tasks für Kevin.</p>
        ) : (
          <ul className="space-y-1">
            {kevinSync.blueprints.slice(0, 5).map(b => (
              <li key={b.name} className="flex justify-between text-[12px] py-1 px-2 rounded hover:bg-os-elevated">
                <span>📋 {b.name}</span>
                <span className="text-os-muted text-[10px]">{new Date(b.mtime).toLocaleDateString('de-DE')}</span>
              </li>
            ))}
          </ul>
        )}
        <a href="https://kevin.lennoxos.com" target="_blank" rel="noopener noreferrer"
           className="text-[11px] text-os-cyan hover:underline mt-3 inline-flex items-center gap-1">
          Kevin's Dashboard <ExternalLink size={10} />
        </a>
      </Panel>

      {/* Quick Project Links */}
      <Panel title="Schnellzugriff Projekte" icon={FolderOpen}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <QuickLink label="AEVUM Shop" href="https://aevum-system.de" badge="live" />
          <QuickLink label="GTS Website" href="https://goldtradersociety.com" badge="live" />
          <QuickLink label="UtilityHub" href="https://utility-hub.one" badge="live" />
          <QuickLink label="Paperclip" href="https://paperclip.lennoxos.com" />
          <QuickLink label="Kevin's OS" href="https://kevin.lennoxos.com" badge="live" />
          <QuickLink label="Terminal" href="https://terminal.lennoxos.com" />
        </div>
      </Panel>

      <p className="text-[10px] text-os-muted italic text-center pt-4">
        Tech-Details (Services, Logs, Network, Backups) → System-Tab in Sidebar.
        Hier nur was operativ-relevant ist.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-os-muted mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-os-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function Panel({ title, icon: Icon, right, children }: {
  title: string; icon?: any; right?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-os-border bg-os-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-os-text flex items-center gap-2">
          {Icon && <Icon size={13} className="text-os-cyan" />} {title}
        </h3>
        {right && <span className="text-[10px] text-os-muted">{right}</span>}
      </div>
      {children}
    </div>
  );
}

function QuickLink({ label, href, badge }: { label: string; href: string; badge?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg border border-os-border bg-os-elevated text-[12px] text-os-text hover:border-os-cyan hover:bg-os-cyan/5 transition-colors">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        {badge && <span className="text-[9px] font-bold text-os-green">●</span>}
        <ExternalLink size={11} className="text-os-muted" />
      </div>
    </a>
  );
}
