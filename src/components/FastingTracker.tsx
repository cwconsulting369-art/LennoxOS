import { useState, useEffect, useCallback } from 'react';
import { Flame } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/lib/database';

interface FastingTrackerProps {
  database: Database;
  refreshKey: number;
}

export default function FastingTracker({ database, refreshKey }: FastingTrackerProps) {
  const [fasted, setFasted] = useState(false);
  const [streak, setStreak] = useState(0);

  const refresh = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const log = database.getFastingLog(today);
    setFasted(log.fasted);
    setStreak(database.getFastingStreak());
  }, [database]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleToggle = () => {
    const today = new Date().toISOString().split('T')[0];
    database.toggleFasting(today);
    refresh();
  };

  return (
    <div
      className="rounded-xl border border-[#2a2a2a] p-5 space-y-4"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Intervallfasten
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {fasted ? 'Gefastet' : 'Nicht gefastet'}
          </span>
          <Switch
            checked={fasted}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-orange-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#252525' }}>
        <Flame className="w-8 h-8 text-orange-400" />
        <div>
          <p className="text-2xl font-bold text-orange-400">{streak} Tage</p>
          <p className="text-xs text-gray-500">in Folge gefastet</p>
        </div>
      </div>

      <div className="text-center p-3 rounded-lg border border-[#2a2a2a]" style={{ backgroundColor: '#0f0f0f' }}>
        <p className="text-sm text-gray-400">Fasten-Fenster</p>
        <p className="text-lg font-semibold text-orange-400">10:00 - 18:00 Uhr</p>
        <p className="text-xs text-gray-500 mt-1">(16:8 Methode)</p>
      </div>
    </div>
  );
}
