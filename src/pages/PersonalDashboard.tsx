import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sun, Dumbbell, Droplets, Camera, DollarSign, Mail, Calendar, Heart, Settings, Flame, Moon, Timer, Footprints, Home, CheckSquare, Inbox as InboxIcon, Zap, Lightbulb, MessageSquare, Activity, ArrowRight } from 'lucide-react';
import WorkoutDashboard from '@/components/WorkoutDashboard';
import LifestyleTracker from '@/components/LifestyleTracker';
import PhotoGallery from '@/components/PhotoGallery';
import Inbox from './Inbox';
import { Database } from '@/lib/database';

/* ============================================================
 * PersonalDashboard — Bloodred edition
 * Big header + new Home/Landing view (greeting, quote, update, briefing).
 * ============================================================ */

type TabId = 'home' | 'today' | 'workout' | 'lifestyle' | 'finance' | 'mail' | 'calendar' | 'photos' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home',      label: 'Home',      icon: Home },
  { id: 'today',     label: 'Today',     icon: Sun },
  { id: 'workout',   label: 'Workout',   icon: Dumbbell },
  { id: 'lifestyle', label: 'Lifestyle', icon: Droplets },
  { id: 'finance',   label: 'Finance',   icon: DollarSign },
  { id: 'mail',      label: 'Mail',      icon: Mail },
  { id: 'calendar',  label: 'Calendar',  icon: Calendar },
  { id: 'photos',    label: 'Fotos',     icon: Camera },
  { id: 'settings',  label: 'Einstell.', icon: Settings },
];

/* ============================================================
 * Quote-Pool — Carlos values + high-quality founder/builder lines.
 * Rotated by day-of-year so it stays stable through a day.
 * ============================================================ */
const QUOTES: { text: string; author: string }[] = [
  { text: 'AEVUM ist die Geldmaschine. LennoxOS der Motor.', author: 'Carlos' },
  { text: 'Cashflow vor Tools. Kunden vor Code.', author: 'Carlos' },
  { text: 'Vom Operator zum Eigentümer.', author: 'Carlos · North Star' },
  { text: 'Build something people love and they\'ll tell others.', author: 'Paul Graham' },
  { text: 'If you double the number of experiments you do per year you\'re going to double your inventiveness.', author: 'Jeff Bezos' },
  { text: 'Strategy without execution is hallucination.', author: 'Thomas Edison' },
  { text: 'The bottleneck is at the top of the bottle.', author: 'Peter Drucker' },
  { text: 'Make something people want.', author: 'Y Combinator' },
  { text: 'Move fast and fix things.', author: 'Carlos · Anti-Drift' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'Done is better than perfect — but ship it polished anyway.', author: 'Carlos' },
  { text: 'Premium-Standard ist nicht verhandelbar.', author: 'Carlos · Quality' },
  { text: 'Wenn du driftest, benenne es. Dann handel.', author: 'Lennox · Sparring' },
  { text: 'Compound interest is the eighth wonder of the world.', author: 'Albert Einstein' },
  { text: 'Be fearful when others are greedy, greedy when others are fearful.', author: 'Warren Buffett' },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Energie folgt Aufmerksamkeit. Wähle bewusst.', author: 'Carlos · Daily Ops' },
];

function pickQuoteOfTheDay() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[day % QUOTES.length];
}

function greetingForHour(h: number) {
  if (h < 5)  return 'Späte Nacht, Carlos';
  if (h < 11) return 'Guten Morgen, Carlos';
  if (h < 14) return 'Mittag, Carlos';
  if (h < 18) return 'Nachmittag, Carlos';
  if (h < 22) return 'Guten Abend, Carlos';
  return 'Späte Stunde, Carlos';
}

const WEEKDAYS = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function formatHumanDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]} · ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function PersonalDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
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
      setFasted(!!fl?.active);
      const jl = db.getJoggingLog(new Date().toISOString().split('T')[0]);
      setJogged(jl.completed);
    } catch (e) { /* noop */ }
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

  const currentTab = TABS.find(t => t.id === activeTab);

  return (
    <div className="flex h-full min-h-screen flex-col bg-transparent">
      {/* ===== Header band — BIGGER, more readable ===== */}
      <div className="lx-page-header px-8 lg:px-11 pt-9 pb-7 border-b border-[var(--border)] relative">
        {/* Crimson accent under headline */}
        <div className="absolute left-8 lg:left-11 bottom-6 h-px w-12 bg-gradient-to-r from-[var(--accent)] to-transparent" />
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="lx-section-title mb-3">PersonalOS</div>
            <h1 className="lx-headline text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              {activeTab === 'home' ? 'Headquarter' : (currentTab?.label || 'Carlos')}
            </h1>
            <p className="mt-2 text-base text-[var(--text-secondary)] max-w-2xl">
              {tabTagline(activeTab)}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
            <span className="lx-dot lx-dot--ok"></span>
            Live
          </div>
        </div>

        {/* Stat strip — only on non-home tabs (home gets its own briefing) */}
        {activeTab !== 'home' && (
          <div className="lx-stat-strip mt-6">
            <Stat icon={<Dumbbell size={14} />} label="Wdh heute" value={String(todayReps)} />
            <Stat icon={<Flame    size={14} />} label="Streak"    value={`${streak}d`} />
            <Stat icon={<Droplets size={14} />} label="Wasser"    value={`${todayWater.toFixed(1)} L`} />
            <Stat icon={<Moon     size={14} />} label="Schlaf"    value={`${todaySleep}h`} />
            <Stat icon={<Timer    size={14} />} label="Fasten"    value={fasted ? 'Aktiv' : '—'} />
            <Stat icon={<Footprints size={14} />} label="Jogging" value={jogged ? '✓' : '—'} />
          </div>
        )}
      </div>

      {/* ===== Tab bar ===== */}
      <nav className="lx-tabbar bg-transparent">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`lx-tab ${isActive ? 'lx-tab--active' : ''}`}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ===== Content ===== */}
      <div className={activeTab === 'mail' ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0 overflow-auto'}>
        {activeTab === 'home'      && <HomePane goTo={setActiveTab} stats={{ todayReps, streak, todayWater, todaySleep }} />}
        {activeTab === 'today'     && <TodayTab />}
        {activeTab === 'workout'   && <WorkoutDashboard />}
        {activeTab === 'lifestyle' && <div className="lx-page"><LifestyleTracker database={db} refreshKey={dbReady ? 1 : 0} /></div>}
        {activeTab === 'finance'   && <FinancePane />}
        {activeTab === 'mail'      && <Inbox />}
        {activeTab === 'calendar'  && <CalendarPane />}
        {activeTab === 'photos'    && <div className="lx-page"><PhotoGallery database={db} /></div>}
        {activeTab === 'settings'  && (
          <div className="lx-page">
            <div className="lx-panel p-6 max-w-2xl">
              <div className="lx-section-title mb-3">Einstellungen</div>
              <p className="text-sm text-[var(--text-secondary)]">
                Einstellungen werden aus dem Workout-Tab aufgerufen (Zahnrad-Icon oben rechts im Workout-Dashboard).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function tabTagline(t: TabId): string {
  switch (t) {
    case 'home':      return 'Dein Headquarter heute — Briefing, Tasks, Termine, Energie.';
    case 'today':     return 'Tasks und Wartelisten — was heute erledigt werden muss.';
    case 'workout':   return 'Training, Wiederholungen, Streak.';
    case 'lifestyle': return 'Wasser, Schlaf, Fasten, Jogging.';
    case 'finance':   return 'Persönliche Subscriptions und Burn-Rate.';
    case 'mail':      return 'Gmail · cwconsulting369 + carloswrusch97.';
    case 'calendar':  return 'Google Calendar · nächste 7 Tage.';
    case 'photos':    return 'Foto-Archiv und Progress-Snapshots.';
    case 'settings':  return 'PersonalOS-Einstellungen.';
  }
}

/* ─── Stat tile ──────────────────────────────────────────────────────── */
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="lx-stat">
      <span className="text-[var(--accent-glow)] flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="lx-stat__label truncate">{label}</div>
        <div className="lx-stat__value truncate">{value}</div>
      </div>
    </div>
  );
}

/* ============================================================
 * HOME PANE — Greeting + Quote + Update + Briefing + Quick Actions
 * ============================================================ */
type BriefingData = {
  tasks: { open: string[]; done: string[]; total: number };
  calendar: { events: { id: string; summary: string; start: string; end: string; location: string }[]; error?: string | null };
  inbox: { count: number; preview: { from: string; subject: string }[]; error?: string | null };
  aevum: { customers: number; audits: number; helpbot: number; error?: string | null };
  updates: { kind: string; label: string; ts: string }[];
};

function HomePane({ goTo, stats }: { goTo: (t: TabId) => void; stats: { todayReps: number; streak: number; todayWater: number; todaySleep: number } }) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const greeting = greetingForHour(now.getHours());
  const humanDate = formatHumanDate(now);
  const quote = useMemo(pickQuoteOfTheDay, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/personal/briefing')
      .then(r => r.json())
      .then(d => { if (mounted) { setBriefing(d); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="lx-page space-y-6">
      {/* ── Hero/Greeting ───────────────────────────────────── */}
      <section className="flex flex-col gap-1.5">
        <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2">
          <span className="lx-pulse h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {humanDate}
        </div>
        <h2 className="lx-headline text-3xl lg:text-4xl font-bold leading-tight">{greeting}</h2>
        <p className="text-[var(--text-secondary)] text-base">Dein Headquarter heute.</p>
      </section>

      {/* ── Quote-Card ──────────────────────────────────────── */}
      <section className="lx-quote-card">
        <div className="lx-quote-card__bar" />
        <div className="flex-1 min-w-0">
          <p className="lx-quote-card__text">"{quote.text}"</p>
          <p className="lx-quote-card__author">— {quote.author}</p>
        </div>
      </section>

      {/* ── Update + Briefing grid ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Update timeline */}
        <section className="lx-panel p-6 xl:col-span-1">
          <div className="flex items-center gap-3 mb-5">
            <Activity size={15} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Was ist neu</h3>
          </div>
          {loading ? (
            <SkeletonRows n={3} />
          ) : briefing && briefing.updates.length > 0 ? (
            <ul className="space-y-3">
              {briefing.updates.map((u, i) => (
                <li key={i} className="flex items-start gap-3 text-[13px]">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--accent-glow)] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[var(--text)] leading-snug">{u.label}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mt-0.5">{u.ts}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Activity size={20} />} text="Ruhige letzte Stunden." />
          )}
        </section>

        {/* Tasks-Today card */}
        <BriefingCard
          icon={<CheckSquare size={15} />}
          title="Tasks heute"
          badge={briefing ? `${briefing.tasks.done.length}/${briefing.tasks.total}` : undefined}
          loading={loading}
          empty={!briefing || briefing.tasks.open.length === 0}
          emptyText="Keine offenen Tasks."
          emptyIcon={<CheckSquare size={20} />}
          onClick={() => goTo('today')}
          ctaLabel="Alle Tasks"
        >
          <ul className="space-y-2">
            {briefing?.tasks.open.slice(0, 3).map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <span className="mt-1.5 w-3 h-3 flex-shrink-0 rounded-sm border border-[var(--border-strong)]" />
                <span className="text-[var(--text)] leading-snug truncate">{s}</span>
              </li>
            ))}
          </ul>
        </BriefingCard>

        {/* Calendar card */}
        <BriefingCard
          icon={<Calendar size={15} />}
          title="Kalender"
          badge={briefing && briefing.calendar.events.length > 0 ? `${briefing.calendar.events.length}` : undefined}
          loading={loading}
          empty={!briefing || briefing.calendar.events.length === 0}
          emptyText={briefing?.calendar.error ? 'Calendar-Sync pending.' : 'Keine kommenden Termine.'}
          emptyIcon={<Calendar size={20} />}
          onClick={() => goTo('calendar')}
          ctaLabel="Voller Kalender"
        >
          <ul className="space-y-2">
            {briefing?.calendar.events.slice(0, 3).map(e => {
              const start = e.start ? new Date(e.start) : null;
              const startLabel = start && !isNaN(start.getTime())
                ? start.toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <li key={e.id} className="text-[13px]">
                  <div className="text-[var(--text)] leading-snug truncate font-medium">{e.summary}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mt-0.5">
                    {startLabel}{e.location ? ` · ${e.location}` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        </BriefingCard>

        {/* Inbox card */}
        <BriefingCard
          icon={<InboxIcon size={15} />}
          title="Inbox"
          badge={briefing && briefing.inbox.count > 0 ? `${briefing.inbox.count}` : undefined}
          loading={loading}
          empty={!briefing || briefing.inbox.count === 0}
          emptyText={briefing?.inbox.error ? 'Mail-Sync pending.' : 'Inbox sauber.'}
          emptyIcon={<InboxIcon size={20} />}
          onClick={() => goTo('mail')}
          ctaLabel="Inbox öffnen"
        >
          <ul className="space-y-2">
            {briefing?.inbox.preview.slice(0, 2).map((m, i) => (
              <li key={i} className="text-[13px]">
                <div className="text-[var(--text)] leading-snug truncate font-medium">{m.subject || '(kein Betreff)'}</div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mt-0.5 truncate">{m.from}</div>
              </li>
            ))}
          </ul>
        </BriefingCard>

        {/* AEVUM status */}
        <BriefingCard
          icon={<Zap size={15} />}
          title="AEVUM Status"
          badge={briefing && briefing.aevum.customers > 0 ? `${briefing.aevum.customers}` : undefined}
          loading={loading}
          empty={!briefing}
          emptyText={briefing?.aevum.error ? 'AEVUM-Sync pending.' : 'Keine Daten.'}
          emptyIcon={<Zap size={20} />}
          onClick={() => { /* AEVUM Customers section is global tab — no-op locally */ }}
          ctaLabel="Master öffnen"
        >
          <ul className="space-y-2 text-[13px]">
            <li className="flex justify-between"><span className="text-[var(--text-secondary)]">Kunden</span><span className="font-mono text-[var(--text)]">{briefing?.aevum.customers ?? 0}</span></li>
            <li className="flex justify-between"><span className="text-[var(--text-secondary)]">Audits heute</span><span className="font-mono text-[var(--accent-glow)]">{briefing?.aevum.audits ?? 0}</span></li>
            <li className="flex justify-between"><span className="text-[var(--text-secondary)]">Helpbot</span><span className="font-mono text-[var(--text)]">{briefing?.aevum.helpbot ?? 0}</span></li>
          </ul>
        </BriefingCard>

        {/* Energie/Body snapshot */}
        <BriefingCard
          icon={<Heart size={15} />}
          title="Energie heute"
          loading={false}
          empty={false}
          emptyText=""
          emptyIcon={<Heart size={20} />}
          onClick={() => goTo('lifestyle')}
          ctaLabel="Lifestyle öffnen"
        >
          <ul className="space-y-2 text-[13px]">
            <li className="flex justify-between"><span className="text-[var(--text-secondary)]">Wiederholungen</span><span className="font-mono text-[var(--text)]">{stats.todayReps}</span></li>
            <li className="flex justify-between"><span className="text-[var(--text-secondary)]">Streak</span><span className="font-mono text-[var(--accent-glow)]">{stats.streak}d</span></li>
            <li className="flex justify-between"><span className="text-[var(--text-secondary)]">Wasser</span><span className="font-mono text-[var(--text)]">{stats.todayWater.toFixed(1)} L</span></li>
            <li className="flex justify-between"><span className="text-[var(--text-secondary)]">Schlaf</span><span className="font-mono text-[var(--text)]">{stats.todaySleep}h</span></li>
          </ul>
        </BriefingCard>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <section className="flex flex-wrap gap-3 pt-2">
        <QuickAction icon={<Lightbulb size={13} />} label="Neue Idee" onClick={() => goTo('today')} />
        <QuickAction icon={<CheckSquare size={13} />} label="Neue Task" onClick={() => goTo('today')} />
        <QuickAction icon={<MessageSquare size={13} />} label="Notiz" onClick={() => goTo('today')} />
        <QuickAction icon={<Activity size={13} />} label="Status-Check" onClick={() => { /* infra is global */ }} />
      </section>
    </div>
  );
}

function BriefingCard({
  icon, title, badge, loading, empty, emptyText, emptyIcon, onClick, ctaLabel, children,
}: {
  icon: React.ReactNode; title: string; badge?: string;
  loading: boolean; empty: boolean; emptyText: string; emptyIcon: React.ReactNode;
  onClick: () => void; ctaLabel: string; children: React.ReactNode;
}) {
  return (
    <section className="lx-panel p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-[var(--accent)]">{icon}</span>
          <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
          {badge && <span className="lx-pill lx-pill--accent">{badge}</span>}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {loading ? <SkeletonRows n={2} /> : empty ? (
          <EmptyState icon={emptyIcon} text={emptyText} />
        ) : children}
      </div>
      <button
        onClick={onClick}
        className="mt-4 text-[11px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1.5 transition-colors self-start"
      >
        {ctaLabel} <ArrowRight size={11} />
      </button>
    </section>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="lx-quick-action">
      <span className="text-[var(--accent)]">{icon}</span>
      {label}
    </button>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-3 rounded bg-[var(--border)]/40 animate-pulse" style={{ width: `${70 + (i * 7) % 25}%` }} />
      ))}
    </div>
  );
}

/* ─── Today tab ──────────────────────────────────────────────────────── */
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
  const totalT = t.open.length + t.done.length;

  return (
    <div className="lx-page">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Today — spans 2 on wide */}
        <section className="lx-panel p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Sun size={15} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">{t.title}</h2>
              {totalT > 0 && (
                <span className="lx-pill lx-pill--accent">
                  {t.done.length}/{totalT}
                </span>
              )}
            </div>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Tasks</span>
          </div>

          {totalT === 0 ? (
            <EmptyState icon={<Sun size={22} />} text="Keine Tasks heute." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {t.open.map((s, i) => (
                <div key={i} className="flex items-start gap-3 text-[13px] py-1.5">
                  <span className="mt-1.5 w-3 h-3 flex-shrink-0 rounded-sm border border-[var(--border-strong)]" />
                  <span className="text-[var(--text)] leading-snug">{s}</span>
                </div>
              ))}
              {t.done.slice(0, 12).map((s, i) => (
                <div key={`d${i}`} className="flex items-start gap-3 text-[13px] py-1.5 opacity-40">
                  <span className="text-[var(--accent-glow)]">✓</span>
                  <span className="line-through">{s}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Waiting on others */}
        <section className="lx-panel p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Heart size={15} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">Warte auf</h2>
            </div>
            <span className="lx-pill">{w.open.length}</span>
          </div>
          {w.open.length === 0 ? (
            <EmptyState icon={<Heart size={20} />} text="Niemand blockiert dich." />
          ) : (
            <ul className="space-y-1.5">
              {w.open.slice(0, 14).map((s, i) => (
                <li key={i} className="text-[12px] py-1.5 px-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]">
                  <span className="text-[var(--text-muted)] mr-2">⏳</span>{s}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─── Finance tab ────────────────────────────────────────────────────── */
function FinancePane() {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    fetch('/api/personal/finance').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  return (
    <div className="lx-page">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lx-panel p-6 lg:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <DollarSign size={15} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">Personal Finance</h2>
            {data?.subscriptions?.length > 0 && (
              <span className="lx-pill">{data.subscriptions.length} subs</span>
            )}
          </div>
          {data?.subscriptions?.length ? (
            <div className="rounded-lg border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-deep)]/50 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Subscription</th>
                    <th className="text-right py-3 px-4 font-semibold">Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.map((s: any, i: number) => (
                    <tr key={s.name} className={`border-t border-[var(--border)] ${i % 2 === 0 ? 'bg-[var(--bg-deep)]/20' : ''} hover:bg-[var(--accent-soft)]`}>
                      <td className="py-2.5 px-4 text-[var(--text)]">{s.name}</td>
                      <td className="py-2.5 px-4 text-right text-[var(--text-secondary)] font-mono text-xs">{s.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<DollarSign size={22} />}
              text="Echtdaten kommen aus /api/personal/finance. Business-Subs siehe Master-Dashboard."
            />
          )}
        </section>

        {data?.burnRates?.length > 0 && (
          <section className="lx-panel p-6">
            <div className="flex items-center gap-3 mb-5">
              <Flame size={15} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text)]">Burn Rates</h2>
            </div>
            <ul className="space-y-2">
              {data.burnRates.map((b: any) => (
                <li key={b.label} className="flex justify-between items-center text-[12px] py-2 px-2 rounded-md hover:bg-[var(--accent-soft)]">
                  <span className="text-[var(--text-secondary)]">{b.label}</span>
                  <span className="text-[var(--accent-glow)] font-bold font-mono">{b.value}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/* ─── Calendar tab ───────────────────────────────────────────────────── */
function CalendarPane() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/calendar/today')
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); if (d.error) setErr(d.error); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  return (
    <div className="lx-page">
      <section className="lx-panel p-6">
        <div className="flex items-center gap-3 mb-5">
          <Calendar size={15} className="text-[var(--accent)]" />
          <h2 className="text-sm font-semibold text-[var(--text)]">Kalender · nächste 7 Tage</h2>
          {events.length > 0 && <span className="lx-pill lx-pill--accent">{events.length}</span>}
        </div>
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-[var(--border)]/40 animate-pulse" style={{ width: `${60 + (i * 11) % 30}%` }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState icon={<Calendar size={22} />} text={err ? `Calendar-Sync error: ${err}` : 'Keine kommenden Termine.'} />
        ) : (
          <ul className="space-y-3">
            {events.map(e => {
              const start = e.start ? new Date(e.start) : null;
              const startLabel = start && !isNaN(start.getTime())
                ? start.toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <li key={e.id} className="rounded-md border border-[var(--border)] bg-[var(--bg-deep)]/20 p-3 hover:bg-[var(--accent-soft)]">
                  <div className="text-sm font-semibold text-[var(--text)]">{e.summary}</div>
                  <div className="text-[11px] uppercase tracking-widest text-[var(--text-muted)] mt-1">
                    {startLabel}{e.location ? ` · ${e.location}` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="lx-empty">
      <div className="lx-empty__glow">{icon}</div>
      <p className="text-[12px] max-w-md leading-relaxed">{text}</p>
    </div>
  );
}
