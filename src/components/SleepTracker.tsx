import { useState, useEffect, useCallback } from 'react';
import { Moon, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Database } from '@/lib/database';

interface SleepTrackerProps {
  database: Database;
  refreshKey: number;
}

export default function SleepTracker({ database, refreshKey }: SleepTrackerProps) {
  const [sleep, setSleep] = useState({ date: '', hours: 0, goal: 7.5 });
  const [weekData, setWeekData] = useState<
    { date: string; label: string; hours: number; goal: number }[]
  >([]);

  const refresh = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const log = database.getSleepLog(today);
    setSleep(log);

    const days: { date: string; label: string; hours: number; goal: number }[] = [];
    const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = dayNames[d.getDay()];
      const logEntry = database.getSleepLog(dateStr);
      days.push({ date: dateStr, label, hours: logEntry.hours, goal: logEntry.goal });
    }
    setWeekData(days);
  }, [database]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hours = parseFloat(e.target.value);
    const today = new Date().toISOString().split('T')[0];
    database.setSleep(today, hours);
    refresh();
  };

  return (
    <div
      className="rounded-xl border border-[#2a2a2a] p-5 space-y-4"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div className="flex items-center gap-2">
        <Moon className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Schlaf
        </h3>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Schlafdauer</span>
          <span
            className="text-lg font-bold"
            style={{ color: sleep.hours >= sleep.goal ? '#00e676' : '#f5f5f5' }}
          >
            {sleep.hours.toFixed(1)} h
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="12"
          step="0.5"
          value={sleep.hours}
          onChange={handleSliderChange}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(sleep.hours / 12) * 100}%, #2a2a2a ${(sleep.hours / 12) * 100}%, #2a2a2a 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>0h</span>
          <span>Ziel: {sleep.goal}h</span>
          <span>12h</span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">Letzte 7 Tage</span>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={weekData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888', fontSize: 11 }}
              width={25}
              domain={[0, 12]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#f0f0f0',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)} h`, 'Schlaf']}
              labelFormatter={() => ''}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {weekData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.hours >= entry.goal ? '#6366f1' : entry.hours > 0 ? '#4338ca' : '#2a2a2a'}
                  opacity={entry.hours > 0 ? 0.9 : 0.5}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
