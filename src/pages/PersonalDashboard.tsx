import { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Droplets, Camera, FolderOpen, Settings, Flame } from 'lucide-react';
import WorkoutDashboard from '@/components/WorkoutDashboard';
import LifestyleTracker from '@/components/LifestyleTracker';
import PhotoGallery from '@/components/PhotoGallery';
import PersonalOS from './PersonalOS';
import { Database } from '@/lib/database';

type TabId = 'workout' | 'lifestyle' | 'photos' | 'files' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'workout',   label: 'Workout',   icon: Dumbbell },
  { id: 'lifestyle', label: 'Lifestyle', icon: Droplets },
  { id: 'photos',    label: 'Fotos',     icon: Camera },
  { id: 'files',     label: 'Dateien',   icon: FolderOpen },
  { id: 'settings',  label: 'Einstell.', icon: Settings },
];

export default function PersonalDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('workout');
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
    <div className="min-h-screen bg-[#0a0e1a]">
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
      <div className="max-w-7xl mx-auto">
        {activeTab === 'workout' && <WorkoutDashboard />}
        {activeTab === 'lifestyle' && <LifestyleTracker database={db} refreshKey={dbReady ? 1 : 0} />}
        {activeTab === 'photos' && <PhotoGallery database={db} />}
        {activeTab === 'files' && <PersonalOS />}
        {activeTab === 'settings' && (
          <div className="p-6 text-os-muted text-sm">
            Einstellungen werden aus dem Workout-Tab aufgerufen (Zahnrad-Icon oben rechts im Workout-Dashboard).
          </div>
        )}
      </div>
    </div>
  );
}
