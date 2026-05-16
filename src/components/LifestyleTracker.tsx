import WaterTracker from './WaterTracker';
import SleepTracker from './SleepTracker';
import FastingTracker from './FastingTracker';
import JoggingTracker from './JoggingTracker';
import ReductionTracker from './ReductionTracker';
import type { Database } from '@/lib/database';

interface LifestyleTrackerProps {
  database: Database;
  refreshKey: number;
}

export default function LifestyleTracker({ database, refreshKey }: LifestyleTrackerProps) {
  return (
    <div className="space-y-4">
      {/* Top Row: Water + Sleep */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WaterTracker database={database} refreshKey={refreshKey} />
        <SleepTracker database={database} refreshKey={refreshKey} />
      </div>

      {/* Middle Row: Fasting + Jogging */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FastingTracker database={database} refreshKey={refreshKey} />
        <JoggingTracker database={database} refreshKey={refreshKey} />
      </div>

      {/* Bottom Section: Lifestyle Reduction */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
          Lifestyle-Reduktion
        </h2>
        <ReductionTracker database={database} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
