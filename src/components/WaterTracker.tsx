import { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Droplets } from 'lucide-react';
import type { Database } from '@/lib/database';

interface WaterTrackerProps {
  database: Database;
  refreshKey: number;
}

export default function WaterTracker({ database, refreshKey }: WaterTrackerProps) {
  const [water, setWater] = useState({ amount: 0, goal: 2.5 });

  const refresh = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const log = database.getWaterLog(today);
    setWater(log);
  }, [database]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleAdd = (amount: number) => {
    const today = new Date().toISOString().split('T')[0];
    database.addWater(today, amount);
    refresh();
  };

  const handleRemove = (amount: number) => {
    const today = new Date().toISOString().split('T')[0];
    database.removeWater(today, amount);
    refresh();
  };

  const percentage = Math.min((water.amount / water.goal) * 100, 100);
  const isGoalReached = water.amount >= water.goal;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="rounded-xl border border-[var(--border)] p-5 flex flex-col items-center gap-4"
      style={{ backgroundColor: 'var(--bg-card)' }}
    >
      <div className="flex items-center gap-2 w-full">
        <Droplets className="w-5 h-5 text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Wasser
        </h3>
      </div>

      <div className="relative flex items-center justify-center">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={isGoalReached ? 'var(--accent)' : '#2196f3'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span
            className="text-xl font-bold"
            style={{ color: isGoalReached ? 'var(--accent)' : '#f5f5f5' }}
          >
            {water.amount.toFixed(1)}
          </span>
          <span className="text-xs text-[var(--text-muted)]">/ {water.goal.toFixed(1)} L</span>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full">
        <button
          onClick={() => handleRemove(0.25)}
          className="flex-1 flex items-center justify-center h-10 rounded-lg border border-[var(--border)] transition-all hover:bg-[#252525] active:scale-95"
          type="button"
          aria-label="Wasser entfernen"
        >
          <Minus size={16} className="text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)] ml-1">0.25 L</span>
        </button>
        <button
          onClick={() => handleAdd(0.25)}
          className="flex-1 flex items-center justify-center h-10 rounded-lg transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#2196f3' }}
          type="button"
          aria-label="0.25L Wasser hinzufuegen"
        >
          <Plus size={16} className="text-white" />
          <span className="text-xs text-white ml-1">0.25 L</span>
        </button>
        <button
          onClick={() => handleAdd(0.5)}
          className="flex-1 flex items-center justify-center h-10 rounded-lg transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#1976d2' }}
          type="button"
          aria-label="0.5L Wasser hinzufuegen"
        >
          <Plus size={16} className="text-white" />
          <span className="text-xs text-white ml-1">0.5 L</span>
        </button>
      </div>

      {isGoalReached && (
        <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
          Ziel erreicht! Gut gemacht!
        </p>
      )}
    </div>
  );
}
