import { useState, useEffect, useCallback } from 'react';
import { Database } from '@/lib/database';
import type { ExerciseCount, Workout, UserExercise } from '@/lib/database';
import QuoteHeader from './QuoteHeader';
import StatsOverview from './StatsOverview';
import WeekChart from './WeekChart';
import ExerciseCard from './ExerciseCard';
import HistoryTable from './HistoryTable';
import PhotoGallery from './PhotoGallery';
import LifestyleTracker from './LifestyleTracker';
import SettingsPanel from './SettingsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dumbbell, Camera, Heart, Settings } from 'lucide-react';

export default function WorkoutDashboard() {
  const [db] = useState(() => new Database());
  const [dbReady, setDbReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<ExerciseCount[]>([]);
  const [exercises, setExercises] = useState<UserExercise[]>([]);
  const [todayReps, setTodayReps] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalReps, setTotalReps] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [weekData, setWeekData] = useState<
    { date: string; label: string; totalReps: number }[]
  >([]);
  const [history, setHistory] = useState<Workout[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState('workout');

  const refreshAll = useCallback(() => {
    if (!db) return;
    try {
      const tw = db.getTodayWorkouts();
      setWorkouts(tw);
      const exList = db.getUserExercises();
      setExercises(exList);
      const ts = db.getTodayStats();
      setTodayReps(ts.totalReps);
      setTodayCalories(ts.totalCalories);
      const s = db.getStreak();
      setStreak(s);
      const all = db.getAllTimeStats();
      setTotalReps(all.totalReps);
      const wd = db.getLast7Days();
      setWeekData(wd);
      const h = db.getHistory(30);
      setHistory(h);
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }, [db]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await db.init();
        if (!mounted) return;
        db.ensureTodayEntry();
        setDbReady(true);
        setLoadError(null);
        refreshAll();
      } catch (err) {
        console.error('Init error:', err);
        if (mounted) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Datenbank konnte nicht geladen werden'
          );
        }
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [db, refreshAll]);

  const handleIncrement = useCallback(
    (exercise: string) => {
      try {
        db.incrementSet(exercise);
        refreshAll();
        setRefreshKey((k) => k + 1);
      } catch (e) {
        console.error('Increment error:', e);
      }
    },
    [db, refreshAll]
  );

  const handleDecrement = useCallback(
    (exercise: string) => {
      try {
        db.decrementSet(exercise);
        refreshAll();
        setRefreshKey((k) => k + 1);
      } catch (e) {
        console.error('Decrement error:', e);
      }
    },
    [db, refreshAll]
  );

  if (loadError) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center px-4"
        style={{ backgroundColor: '#0f0f0f' }}
      >
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-5xl mb-2">&#9888;</div>
          <h2 className="text-xl font-bold text-white">Fehler beim Laden</h2>
          <p className="text-gray-400 text-sm">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{ backgroundColor: '#00e676', color: '#0f0f0f' }}
            type="button"
          >
            Neu laden
          </button>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center"
        style={{ backgroundColor: '#0f0f0f' }}
      >
        <div className="text-center space-y-3">
          <div
            className="w-10 h-10 border-4 rounded-full animate-spin mx-auto"
            style={{
              borderColor: '#00e676',
              borderTopColor: 'transparent',
            }}
          />
          <p className="text-gray-500 text-sm">Datenbank wird geladen...</p>
        </div>
      </div>
    );
  }

  const historyEntries = history.map((w) => ({
    id: w.id,
    date: w.date,
    exercise: w.exercise,
    sets: w.sets,
    total_reps: w.total_reps,
    calories: w.calories,
  }));

  return (
    <div
      className="min-h-[100dvh] px-4 py-6 md:px-6 md:py-8"
      style={{ backgroundColor: '#0f0f0f' }}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <QuoteHeader />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList
            className="w-full grid grid-cols-4 h-12 rounded-xl mb-4"
            style={{ backgroundColor: '#1a1a1a' }}
          >
            <TabsTrigger
              value="workout"
              className="flex items-center justify-center gap-1.5 rounded-lg text-sm data-[state=active]:bg-[#00e676] data-[state=active]:text-[#0f0f0f] text-gray-400 transition-all"
            >
              <Dumbbell className="w-4 h-4" />
              <span className="hidden sm:inline">Workout</span>
            </TabsTrigger>
            <TabsTrigger
              value="photos"
              className="flex items-center justify-center gap-1.5 rounded-lg text-sm data-[state=active]:bg-[#00e676] data-[state=active]:text-[#0f0f0f] text-gray-400 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Fortschritt</span>
            </TabsTrigger>
            <TabsTrigger
              value="lifestyle"
              className="flex items-center justify-center gap-1.5 rounded-lg text-sm data-[state=active]:bg-[#00e676] data-[state=active]:text-[#0f0f0f] text-gray-400 transition-all"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Lifestyle</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="flex items-center justify-center gap-1.5 rounded-lg text-sm data-[state=active]:bg-[#00e676] data-[state=active]:text-[#0f0f0f] text-gray-400 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Einstellungen</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Workout */}
          <TabsContent value="workout" className="space-y-6">
            <StatsOverview
              todayReps={todayReps}
              streak={streak}
              totalReps={totalReps}
              todayCalories={todayCalories}
            />

            <WeekChart data={weekData} />

            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#00e676' }}
                />
                Uebungen
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {exercises.map((ex) => {
                  const count = workouts.find((w) => w.exercise === ex.name);
                  return (
                    <ExerciseCard
                      key={ex.id}
                      exercise={ex.name}
                      color={ex.color}
                      sets={count?.sets ?? 0}
                      onIncrement={() => handleIncrement(ex.name)}
                      onDecrement={() => handleDecrement(ex.name)}
                    />
                  );
                })}
              </div>
            </div>

            <HistoryTable entries={historyEntries} />
          </TabsContent>

          {/* Tab 2: Photos */}
          <TabsContent value="photos">
            <div
              className="rounded-xl border border-[#2a2a2a] p-4 md:p-5"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                Fotos
              </h2>
              <PhotoGallery database={db} />
            </div>
          </TabsContent>

          {/* Tab 3: Lifestyle */}
          <TabsContent value="lifestyle">
            <LifestyleTracker database={db} refreshKey={refreshKey} />
          </TabsContent>

          {/* Tab 4: Settings */}
          <TabsContent value="settings">
            <div
              className="rounded-xl border border-[#2a2a2a] p-4 md:p-5"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                Einstellungen
              </h2>
              <SettingsPanel database={db} refreshKey={refreshKey} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
