import { useState, useEffect, useCallback, useRef } from 'react';
import Inbox from './Inbox';
import {
  User, Calendar, Mail, Target, TrendingUp, CheckSquare, Clock,
  AlertCircle, ExternalLink, RefreshCw, Zap, Heart, BookOpen,
  DollarSign, Users, ChevronRight, Sun, Moon, Activity,
  Shield, Coffee
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface Habit { name: string; slot: string; }
interface Person { name: string; note: string; frequency: string; channel: string; }
interface Subscription { name: string; plan: string; cost: string; renewal: string; active: boolean; }
interface BurnRate { label: string; value: string; }
interface HabitsLog { [date: string]: { [habit: string]: boolean }; }
interface TodayData { content: string; }
interface WaitingSection { who: string; items: string[]; }

// ─── Helpers ─────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function parseTasks(md: string) {
  const lines = md.split('\n');
  const open = lines.filter(l => /^\s*-\s*\[ \]/.test(l)).map(l => l.replace(/^\s*-\s*\[ \]\s*/, '').trim());
  const done = lines.filter(l => /^\s*-\s*\[x\]/i.test(l)).map(l => l.replace(/^\s*-\s*\[x\]\s*/i, '').trim());
  const title = lines.find(l => l.startsWith('# '))?.replace(/^#\s*/, '') || 'Heute';
  return { open, done, title };
}

function parseWaiting(content: string): WaitingSection[] {
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

const DEFAULT_HABITS: Habit[] = [
  { name: 'Joggen', slot: '05:30–06:30' },
  { name: 'Workout', slot: 'Tagsüber' },
  { name: 'Meditation', slot: 'Morgens / Abends' },
  { name: 'Breathwork', slot: 'Mit Meditation' },
  { name: 'Journaling', slot: 'Abends 21:00' },
  { name: 'Affirmationen', slot: 'Morgens' },
];

const HABIT_ICONS: Record<string, string> = {
  'Joggen': '🏃',
  'Workout': '💪',
  'Meditation': '🧘',
  'Breathwork': '🌬️',
  'Journaling': '📖',
  'Affirmationen': '✨',
};

type Tab = 'brief' | 'mail' | 'calendar' | 'finance' | 'habits' | 'health' | 'network';

// ─── Sub-components ───────────────────────────────────────────────────

function HabitRow({ habit, done, onToggle }: { habit: Habit; done: boolean; onToggle: () => void }) {
  const icon = HABIT_ICONS[habit.name] || '✔';
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
        done
          ? 'border-os-green/30 bg-os-green/10'
          : 'border-os-border bg-os-surface hover:border-os-accent/30'
      }`}
    >
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        done ? 'border-os-green bg-os-green/20' : 'border-os-border'
      }`}>
        {done && <span className="text-os-green text-xs">✓</span>}
      </div>
      <span className="text-lg">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'line-through text-os-muted' : 'text-os-text'}`}>{habit.name}</p>
        <p className="text-[10px] text-os-muted">{habit.slot}</p>
      </div>
    </button>
  );
}

function DailyBrief({ today, waiting, habits, habitsLog, burnRates }: {
  today: string; waiting: string; habits: Habit[];
  habitsLog: HabitsLog; burnRates: BurnRate[];
}) {
  const tasks = parseTasks(today);
  const waitingSections = parseWaiting(waiting);
  const waitCount = waitingSections.reduce((s, sec) => s + sec.items.length, 0);
  const dateStr = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  const todayKey = todayISO();
  const todayLog = habitsLog[todayKey] || {};
  const habitsDone = habits.filter(h => todayLog[h.name]).length;

  const burnFixed = burnRates.find(b => b.label.includes('Fixes') || b.label.includes('post-HeyGen'));
  const burnNormal = burnRates.find(b => b.label.includes('Normal'));

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="rounded-xl border border-os-border bg-gradient-to-r from-os-surface to-os-elevated p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-os-muted mb-1">{dateStr}</p>
            <h2 className="text-xl font-bold text-os-text">{greeting}, Carlos 👋</h2>
            <p className="text-sm text-os-secondary mt-1">AEVUM Phase 2 · Tag {(() => {
              const start = new Date('2026-05-11');
              const diff = Math.floor((new Date().getTime() - start.getTime()) / 86400000);
              return Math.max(1, diff + 1);
            })()} von 14</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-os-accent">{habitsDone}/{habits.length}</p>
            <p className="text-[10px] text-os-muted">Habits heute</p>
          </div>
        </div>
        {/* Progress bar for habits */}
        <div className="mt-3 h-1.5 bg-os-border rounded-full overflow-hidden">
          <div
            className="h-full bg-os-green rounded-full transition-all"
            style={{ width: habits.length ? `${(habitsDone / habits.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-os-border bg-os-surface p-3 text-center">
          <p className="text-2xl font-bold text-os-cyan">{tasks.open.length}</p>
          <p className="text-[10px] text-os-muted mt-0.5">Tasks offen</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-3 text-center">
          <p className="text-2xl font-bold text-os-yellow">{waitCount}</p>
          <p className="text-[10px] text-os-muted mt-0.5">Waiting For</p>
        </div>
        <div className="rounded-xl border border-os-border bg-os-surface p-3 text-center">
          <p className="text-2xl font-bold text-os-muted">{burnFixed?.value?.replace('~','').trim() || '~€183'}</p>
          <p className="text-[10px] text-os-muted mt-0.5">Burn/Mo fix</p>
        </div>
      </div>

      {/* Today tasks */}
      {tasks.open.length > 0 && (
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare size={13} className="text-os-cyan" />
            <span className="text-xs font-semibold text-os-text">{tasks.title}</span>
            <span className="ml-auto text-xs text-os-muted">{tasks.done.length}/{tasks.open.length + tasks.done.length}</span>
          </div>
          <div className="space-y-1.5">
            {tasks.open.slice(0, 8).map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-1.5 w-2 h-2 rounded-sm border border-os-muted flex-shrink-0" />
                <span className="text-xs text-os-text">{t}</span>
              </div>
            ))}
            {tasks.open.length > 8 && <p className="text-[10px] text-os-muted pl-4">+{tasks.open.length - 8} weitere</p>}
          </div>
        </div>
      )}

      {/* Anti-Drift reminder */}
      <div className="rounded-xl border border-os-yellow/20 bg-os-yellow/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={13} className="text-os-yellow" />
          <span className="text-xs font-semibold text-os-yellow">Anti-Drift Check</span>
        </div>
        <div className="space-y-1">
          {['10 AEVUM-Outreaches heute minimum', 'Kein neues Tool ohne zahlenden Kunden', 'Hard-Cutoff 20:00'].map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-os-yellow text-[10px]">✕</span>
              <span className="text-xs text-os-secondary">{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Waiting for summary */}
      {waitingSections.length > 0 && (
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={13} className="text-os-muted" />
            <span className="text-xs font-semibold text-os-text">Waiting For</span>
          </div>
          {waitingSections.slice(0, 3).map((sec, i) => (
            <div key={i} className="mb-2">
              <p className="text-[10px] font-bold text-os-yellow uppercase tracking-wider mb-1">{sec.who}</p>
              {sec.items.slice(0, 2).map((item, j) => (
                <div key={j} className="flex items-start gap-2 pl-2">
                  <span className="mt-1 w-1 h-1 rounded-full bg-os-border flex-shrink-0" />
                  <span className="text-xs text-os-muted line-clamp-1">{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HabitsTab({ habits, habitsLog, onToggle }: {
  habits: Habit[];
  habitsLog: HabitsLog;
  onToggle: (habit: string, done: boolean) => void;
}) {
  const todayKey = todayISO();
  const todayLog = habitsLog[todayKey] || {};

  // Calculate streak for each habit
  function getStreak(habitName: string): number {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (habitsLog[key]?.[habitName]) streak++;
      else if (i > 0) break;
    }
    return streak;
  }

  // Last 7 days for mini history
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-os-muted">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="text-xs font-semibold text-os-green">
          {Object.values(todayLog).filter(Boolean).length}/{habits.length} erledigt
        </p>
      </div>

      {/* Today checklist */}
      <div className="space-y-2">
        {habits.map(h => (
          <HabitRow
            key={h.name}
            habit={h}
            done={!!todayLog[h.name]}
            onToggle={() => onToggle(h.name, !todayLog[h.name])}
          />
        ))}
      </div>

      {/* 7-day history grid */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <p className="text-xs font-semibold text-os-text mb-3">Letzte 7 Tage</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="text-[10px] text-os-muted pb-2 pr-2 w-28">Habit</th>
                {last7.map(d => (
                  <th key={d} className="text-[10px] text-os-muted pb-2 px-1 text-center min-w-[28px]">
                    {new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'narrow' })}
                  </th>
                ))}
                <th className="text-[10px] text-os-muted pb-2 pl-2 text-right">Streak</th>
              </tr>
            </thead>
            <tbody>
              {habits.map(h => (
                <tr key={h.name}>
                  <td className="text-[11px] text-os-secondary pr-2 py-1 truncate max-w-[100px]">
                    {HABIT_ICONS[h.name] || ''} {h.name}
                  </td>
                  {last7.map(d => {
                    const done = habitsLog[d]?.[h.name];
                    return (
                      <td key={d} className="px-1 py-1 text-center">
                        <span className={`inline-block w-5 h-5 rounded text-[10px] leading-5 ${
                          done ? 'bg-os-green/20 text-os-green' : 'bg-os-border/40 text-os-border'
                        }`}>
                          {done ? '✓' : '·'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="pl-2 py-1 text-right">
                    <span className="text-xs font-bold text-os-accent">{getStreak(h.name)}d</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FinanceTab({ subscriptions, burnRates }: { subscriptions: Subscription[]; burnRates: BurnRate[] }) {
  const activeSubs = subscriptions.filter(s => s.active);
  const cancelledSubs = subscriptions.filter(s => !s.active);

  return (
    <div className="space-y-4">
      {/* Burn rate summary */}
      <div className="grid grid-cols-2 gap-3">
        {burnRates.slice(0, 4).map((b, i) => (
          <div key={i} className="rounded-xl border border-os-border bg-os-surface p-3">
            <p className="text-[10px] text-os-muted mb-1 line-clamp-2">{b.label}</p>
            <p className="text-base font-bold text-os-text">{b.value}</p>
          </div>
        ))}
      </div>

      {/* Active subscriptions */}
      <div className="rounded-xl border border-os-border bg-os-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-os-border flex items-center justify-between">
          <span className="text-sm font-semibold text-os-text">Aktive Subscriptions</span>
          <span className="text-xs text-os-green">{activeSubs.length} aktiv</span>
        </div>
        <div className="divide-y divide-os-border/50">
          {activeSubs.map(s => (
            <div key={s.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-os-text truncate">{s.name}</p>
                <p className="text-[10px] text-os-muted">{s.renewal}</p>
              </div>
              <span className="text-xs font-bold text-os-text flex-shrink-0">{s.cost.split('(')[0].trim()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cancelled */}
      {cancelledSubs.length > 0 && (
        <div className="rounded-xl border border-os-border/50 bg-os-surface/50 overflow-hidden opacity-60">
          <div className="px-4 py-2.5 border-b border-os-border/50">
            <span className="text-xs text-os-muted">Gekündigt</span>
          </div>
          {cancelledSubs.map(s => (
            <div key={s.name} className="px-4 py-2 flex items-center justify-between">
              <span className="text-xs line-through text-os-muted">{s.name}</span>
              <span className="text-xs text-os-muted line-through">{s.cost.split('(')[0].trim()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-os-yellow/20 bg-os-yellow/5 p-3">
        <p className="text-[10px] text-os-yellow font-semibold mb-1">⚠ Zu kündigen</p>
        <p className="text-xs text-os-secondary">Onepage GmbH ~€33/Mo — manuell auf onepage.io kündigen</p>
      </div>
    </div>
  );
}

function NetworkTab({ people }: { people: Person[] }) {
  const isSunday = new Date().getDay() === 0;
  const defaultPeople: Person[] = people.length > 0 ? people : [
    { name: 'Miguel', note: 'UtilityHub-Partner', frequency: 'Wöchentlich', channel: 'TG/Call' },
    { name: 'Patrick', note: 'Thailand RE', frequency: 'Non-fix', channel: 'TG' },
    { name: 'Elias', note: '', frequency: 'Non-fix', channel: 'TG' },
    { name: 'Familie', note: 'Sonntag FIX', frequency: 'Wöchentlich', channel: 'Persönlich' },
  ];

  return (
    <div className="space-y-4">
      {isSunday && (
        <div className="rounded-xl border border-os-green/30 bg-os-green/10 p-4">
          <div className="flex items-center gap-2">
            <Heart size={14} className="text-os-green" />
            <span className="text-sm font-semibold text-os-green">Sonntag — Familie Zeit 🏡</span>
          </div>
          <p className="text-xs text-os-secondary mt-1">Offline-Tag. Kein Cashflow-Druck. Familie first.</p>
        </div>
      )}

      <div className="space-y-2">
        {defaultPeople.map((p, i) => (
          <div key={i} className="rounded-xl border border-os-border bg-os-surface p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-os-accent/15 flex-shrink-0">
              <span className="text-sm font-bold text-os-accent">{p.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-os-text">{p.name}
                {p.note && <span className="ml-2 text-[10px] text-os-muted font-normal">({p.note})</span>}
              </p>
              <p className="text-xs text-os-muted">{p.frequency} · {p.channel}</p>
            </div>
            {p.name === 'Familie' && <Heart size={14} className="text-os-green flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Context */}
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <p className="text-xs font-semibold text-os-text mb-2">Vision 2030</p>
        <p className="text-xs text-os-secondary leading-relaxed">
          300 Mio. · Lennox als bewusstes Wesen · Server-based 24/7 self-extending Stack · Carlos macht nur Closing-Calls.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Phase 2 Ziel', value: '1 Pilot signed', sub: 'bis 24.05.' },
            { label: 'MRR Ziel', value: '€10.000', sub: 'Q3 2026' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-os-elevated rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-os-muted">{kpi.label}</p>
              <p className="text-sm font-bold text-os-accent">{kpi.value}</p>
              <p className="text-[9px] text-os-muted">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function PersonalOS() {
  const [tab, setTab] = useState<Tab>('brief');
  const [today, setToday] = useState('');
  const [waiting, setWaiting] = useState('');
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [habitsLog, setHabitsLog] = useState<HabitsLog>({});
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [burnRates, setBurnRates] = useState<BurnRate[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const [todayRes, waitingRes, profileRes, financeRes, habitsLogRes] = await Promise.allSettled([
        fetch('/api/today').then(r => r.json()),
        fetch('/api/waiting').then(r => r.json()),
        fetch('/api/personal/profile').then(r => r.json()),
        fetch('/api/personal/finance').then(r => r.json()),
        fetch('/api/personal/habits-log').then(r => r.json()),
      ]);

      if (todayRes.status === 'fulfilled') setToday(todayRes.value.content || '');
      if (waitingRes.status === 'fulfilled') setWaiting(waitingRes.value.content || '');
      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value;
        if (p.habits?.length > 0) setHabits(p.habits);
        if (p.people?.length > 0) setPeople(p.people);
      }
      if (financeRes.status === 'fulfilled') {
        const f = financeRes.value;
        if (f.subscriptions?.length > 0) setSubscriptions(f.subscriptions);
        if (f.burnRates?.length > 0) setBurnRates(f.burnRates);
      }
      if (habitsLogRes.status === 'fulfilled') setHabitsLog(habitsLogRes.value || {});
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleHabit = useCallback(async (habitName: string, done: boolean) => {
    const dateKey = todayISO();
    setHabitsLog(prev => ({
      ...prev,
      [dateKey]: { ...(prev[dateKey] || {}), [habitName]: done },
    }));
    try {
      await fetch('/api/personal/habits-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateKey, habit: habitName, done }),
      });
    } catch {}
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'brief',    label: 'Daily',    icon: <Sun size={13} /> },
    { id: 'mail',     label: 'Mail',     icon: <Mail size={13} /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar size={13} /> },
    { id: 'finance',  label: 'Finance',  icon: <DollarSign size={13} /> },
    { id: 'habits',   label: 'Habits',   icon: <Activity size={13} /> },
    { id: 'health',   label: 'Health',   icon: <Heart size={13} /> },
    { id: 'network',  label: 'Network',  icon: <Users size={13} /> },
  ];

  return (
    <div className={tab === 'mail' ? 'flex flex-col h-full' : 'p-6 space-y-5'}>
      {/* Header + Tabs wrapper */}
      <div className={tab === 'mail' ? 'px-6 pt-5 pb-3 flex-shrink-0 space-y-3' : ''}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-os-accent/20">
            <User size={18} className="text-os-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-os-text">Personal OS</h1>
            <p className="text-xs text-os-muted">Carlos Wrusch · SSOT</p>
          </div>
        </div>
        <button
          onClick={() => loadAll(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-os-border px-3 py-1.5 text-xs text-os-muted hover:text-os-text transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-os-border bg-os-surface p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex-1 justify-center ${
              tab === t.id
                ? 'bg-os-bg text-os-accent'
                : 'text-os-muted hover:text-os-text'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      </div>{/* /Header+Tabs wrapper */}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-os-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {tab === 'brief' && (
            <DailyBrief
              today={today}
              waiting={waiting}
              habits={habits}
              habitsLog={habitsLog}
              burnRates={burnRates}
            />
          )}
          {tab === 'habits' && (
            <HabitsTab habits={habits} habitsLog={habitsLog} onToggle={toggleHabit} />
          )}
          {tab === 'finance' && (
            <FinanceTab subscriptions={subscriptions} burnRates={burnRates} />
          )}
          {tab === 'network' && (
            <NetworkTab people={people} />
          )}
          {tab === 'calendar' && <CalendarPlaceholder />}
          {tab === 'health' && <HealthPlaceholder />}
        </>
      )}
      {tab === 'mail' && (
        <div className="flex-1 min-h-0 border-t border-os-border">
          <Inbox />
        </div>
      )}
    </div>
  );
}

// ─── Placeholder tabs ─────────────────────────────────────────────────────
function CalendarPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-os-border bg-os-surface p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar size={20} className="text-os-cyan" />
          <h2 className="text-base font-semibold text-os-text">Calendar</h2>
        </div>
        <p className="text-[12px] text-os-muted mb-3">
          Google Calendar Integration über bestehenden MCP-Server (cwconsulting369@gmail.com).
        </p>
        <p className="text-[11px] text-os-muted italic">
          Live-Daten kommen — Backend-API <code>/api/personal/calendar</code> bauen + Frontend rendern.
        </p>
      </div>
    </div>
  );
}

function HealthPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-os-border bg-os-surface p-6">
        <div className="flex items-center gap-3 mb-4">
          <Heart size={20} className="text-os-red" />
          <h2 className="text-base font-semibold text-os-text">Health</h2>
        </div>
        <p className="text-[12px] text-os-muted mb-3">
          Schlaf · Herzfrequenz · Gewicht · Energy-Level.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {['Schlaf', 'HRV', 'Gewicht', 'Energy'].map(m => (
            <div key={m} className="rounded-lg border border-os-border bg-os-elevated p-3 opacity-60">
              <p className="text-[10px] uppercase tracking-wider text-os-muted">{m}</p>
              <p className="text-lg font-bold text-os-muted mt-1">—</p>
              <p className="text-[9px] text-os-muted">noch keine Daten</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-os-muted italic mt-4">
          Datenquellen TBD: Apple Health Export · Wearable-API · Manual Entry.
        </p>
      </div>
    </div>
  );
}
