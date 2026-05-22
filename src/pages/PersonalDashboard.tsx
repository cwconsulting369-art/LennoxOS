import { useState, useEffect, useCallback } from 'react';
import { Sun, Dumbbell, Droplets, Camera, DollarSign, Mail, Calendar, Heart, Users as UsersIcon, Settings, Flame } from 'lucide-react';
import WorkoutDashboard from '@/components/WorkoutDashboard';
import LifestyleTracker from '@/components/LifestyleTracker';
import PhotoGallery from '@/components/PhotoGallery';
import Inbox from './Inbox';
import { Database } from '@/lib/database';

type TabId = 'today' | 'workout' | 'lifestyle' | 'finance' | 'mail' | 'calendar' | 'photos' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'today',     label: 'Today',     icon: Sun },
  { id: 'workout',   label: 'Workout',   icon: Dumbbell },
  { id: 'lifestyle', label: 'Lifestyle', icon: Droplets },
  { id: 'finance',   label: 'Finance',   icon: DollarSign },
  { id: 'mail',      label: 'Mail',      icon: Mail },
  { id: 'calendar',  label: 'Calendar',  icon: Calendar },
  { id: 'photos',    label: 'Fotos',     icon: Camera },
  { id: 'settings',  label: 'Einstell.', icon: Settings },
];

export default function PersonalDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [db] = useState(() => new Database());
  const [dbReady, setDbReady] = useState(false);
  const [todayReps, setTodayReps] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayWater, setTodayWater] = useState(0);
  const [todaySleep, setTodaySleep] = useState(0);
  const [fasted, setFasted] = useState(false);
  const [jogged, setJogged] = useState(false);

  const refreshStats = useCallback(() => {
    if (!db) return;
    try {
      const ts = db.getTodayStats();
      setTodayReps(ts.totalReps);
      setStreak(db.getStreak());
      const wl = db.getWaterLog(db.getToday());
      setTodayWater(wl.amount);
      const sl = db.getSleepLog(new Date().toISOString().split('T')[0]);
      setTodaySleep(sl.hours);
      const fl = db.getFastingLog(new Date().toISOString().split('T')[0]);
      setFasted(fasted);
      const jl = db.getJoggingLog(new Date().toISOString().split('T')[0]);
      setJogged(jl.completed);
    } catch (e) {}
  }, [db]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await db.init();
        if (!mounted) return;
        db.ensureTodayEntry();
        setDbReady(true);
        refreshStats();
      } catch (err) {
        console.error('DB init error:', err);
      }
    };
    init();
    return () => { mounted = false; };
  }, [db, refreshStats]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-transparent">
      {/* Quick Stats Bar */}
      <div className="border-b border-os-border bg-os-surface">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="flex items-center gap-2">
              <Dumbbell size={14} className="text-os-cyan" />
              <div>
                <p className="text-[10px] text-os-muted uppercase tracking-wider">Wdh heute</p>
                <p className="text-sm font-bold text-os-text">{todayReps}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Flame size={14} className="text-os-yellow" />
              <div>
                <p className="text-[10px] text-os-muted uppercase tracking-wider">Streak</p>
                <p className="text-sm font-bold text-os-text">{streak}d</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Droplets size={14} className="text-os-blue" />
              <div>
                <p className="text-[10px] text-os-muted uppercase tracking-wider">Wasser</p>
                <p className="text-sm font-bold text-os-text">{todayWater.toFixed(1)}L</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-os-accent text-xs">😴</span>
              <div>
                <p className="text-[10px] text-os-muted uppercase tracking-wider">Schlaf</p>
                <p className="text-sm font-bold text-os-text">{todaySleep}h</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-os-green text-xs">⏱</span>
              <div>
                <p className="text-[10px] text-os-muted uppercase tracking-wider">Fasten</p>
                <p className="text-sm font-bold text-os-text">{fasted ? 'Ja' : 'Nein'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-os-cyan text-xs">🏃</span>
              <div>
                <p className="text-[10px] text-os-muted uppercase tracking-wider">Jogging</p>
                <p className="text-sm font-bold text-os-text">{jogged ? 'Ja' : 'Nein'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-os-border bg-os-surface">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-os-cyan text-os-cyan'
                    : 'border-transparent text-os-muted hover:text-os-text'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={activeTab === 'mail' ? 'flex-1 min-h-0 flex flex-col' : 'max-w-7xl mx-auto'}>
        {activeTab === 'today' && <TodayTab />}
        {activeTab === 'workout' && <WorkoutDashboard />}
        {activeTab === 'lifestyle' && <LifestyleTracker database={db} refreshKey={dbReady ? 1 : 0} />}
        {activeTab === 'finance' && <FinancePlaceholder />}
        {activeTab === 'mail' && <Inbox />}
        {activeTab === 'calendar' && <CalendarPlaceholder />}
        {activeTab === 'photos' && <PhotoGallery database={db} />}
        {activeTab === 'settings' && (
          <div className="p-6 text-os-muted text-sm">
            Einstellungen werden aus dem Workout-Tab aufgerufen (Zahnrad-Icon oben rechts im Workout-Dashboard).
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Today: pulls /api/today + /api/waiting ─────────────────────────────────
function TodayTab() {
  const [today, setToday] = useState('');
  const [waiting, setWaiting] = useState('');

  useEffect(() => {
    fetch('/api/today').then(r => r.json()).then(d => setToday(d.content || '')).catch(() => {});
    fetch('/api/waiting').then(r => r.json()).then(d => setWaiting(d.content || '')).catch(() => {});
  }, []);

  const parseTasks = (md: string) => {
    const lines = md.split('\n');
    return {
      title: lines.find(l => l.startsWith('# '))?.replace(/^#\s*/, '') || 'Heute',
      open: lines.filter(l => /^\s*-\s*\[ \]/.test(l)).map(l => l.replace(/^\s*-\s*\[ \]\s*/, '').trim()),
      done: lines.filter(l => /^\s*-\s*\[x\]/i.test(l)).map(l => l.replace(/^\s*-\s*\[x\]\s*/i, '').trim()),
    };
  };

  const t = parseTasks(today);
  const w = parseTasks(waiting);

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-xl border border-os-border bg-os-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-os-text flex items-center gap-2">
            <Sun size={13} className="text-os-yellow" /> {t.title}
          </h3>
          <span className="text-xs text-os-muted">{t.done.length}/{t.open.length + t.done.length}</span>
        </div>
        {t.open.length === 0 && t.done.length === 0 ? (
          <p className="text-[12px] text-os-muted italic">Keine Tasks heute.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {t.open.slice(0, 14).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="mt-1 w-3 h-3 flex-shrink-0 rounded-sm border border-os-muted" />
                <span className="text-os-text">{s}</span>
              </div>
            ))}
            {t.done.slice(0, 6).map((s, i) => (
              <div key={`d${i}`} className="flex items-start gap-2 text-[12px] opacity-40">
                <span className="text-os-green">✓</span>
                <span className="text-os-text line-through">{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {w.open.length > 0 && (
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
            <Heart size={13} className="text-os-yellow" /> Warte auf andere ({w.open.length})
          </h3>
          <ul className="space-y-1">
            {w.open.slice(0, 8).map((s, i) => (
              <li key={i} className="text-[12px] py-1 px-2 rounded hover:bg-os-elevated">⏳ {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Finance: pulls /api/personal/finance ───────────────────────────────────
function FinancePlaceholder() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/personal/finance').then(r => r.json()).then(setData).catch(() => {});
  }, []);
  return (
    <div className="p-6 space-y-5">
      <div className="rounded-xl border border-os-border bg-os-surface p-6">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <DollarSign size={13} className="text-os-yellow" /> Personal Finance
        </h3>
        {data?.subscriptions?.length ? (
          <ul className="space-y-1 text-[12px]">
            {data.subscriptions.map((s: any) => (
              <li key={s.name} className="flex justify-between py-1 px-2 rounded hover:bg-os-elevated">
                <span>{s.name}</span><span className="text-os-muted">{s.cost}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-os-muted italic">
            Echtdaten kommen aus <code>/api/personal/finance</code> (lokal). Für Business-Subscriptions siehe Master Dashboard → Subscriptions-Section.
          </p>
        )}
      </div>
      {data?.burnRates?.length > 0 && (
        <div className="rounded-xl border border-os-border bg-os-surface p-4">
          <h3 className="text-sm font-semibold text-os-text mb-3">Burn Rates</h3>
          <ul className="space-y-1 text-[12px]">
            {data.burnRates.map((b: any) => (
              <li key={b.label} className="flex justify-between"><span>{b.label}</span><span className="text-os-yellow font-bold">{b.value}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Calendar: placeholder for Google Calendar MCP integration ─────────────
function CalendarPlaceholder() {
  return (
    <div className="p-6 space-y-5">
      <div className="rounded-xl border border-os-border bg-os-surface p-6">
        <h3 className="text-sm font-semibold text-os-text mb-3 flex items-center gap-2">
          <Calendar size={13} className="text-os-cyan" /> Calendar
        </h3>
        <p className="text-[12px] text-os-muted mb-2">
          Google Calendar Integration via existing MCP-Server (cwconsulting369@gmail.com).
        </p>
        <p className="text-[11px] text-os-muted italic">
          Live-Daten kommen — Backend-API <code>/api/personal/calendar</code> wird gebaut, dann hier gerendert.
        </p>
      </div>
    </div>
  );
}
