import { useState, useEffect, useCallback } from 'react';
import { Flame, Footprints, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/lib/database';

interface JoggingTrackerProps {
  database: Database;
  refreshKey: number;
}

export default function JoggingTracker({ database, refreshKey }: JoggingTrackerProps) {
  const [completed, setCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [shouldJog, setShouldJog] = useState(true);
  const [nextJogDate, setNextJogDate] = useState('');

  const refresh = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const log = database.getJoggingLog(today);
    setCompleted(log.completed);
    setStreak(database.getJoggingStreak());

    const should = database.shouldJogToday();
    setShouldJog(should);

    if (!should) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      setNextJogDate(d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    }
  }, [database]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const handleToggle = () => {
    const today = new Date().toISOString().split('T')[0];
    database.toggleJogging(today);
    refresh();
  };

  return (
    <div
      className="rounded-xl border border-[#2a2a2a] p-5 space-y-4"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Footprints className="w-5 h-5 text-green-400" />
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Jogging 5km
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {completed ? 'Erledigt' : 'Offen'}
          </span>
          <Switch
            checked={completed}
            onCheckedChange={handleToggle}
            className="data-[state=checked]:bg-green-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#252525' }}>
        <Flame className="w-8 h-8 text-green-400" />
        <div>
          <p className="text-2xl font-bold text-green-400">{streak} Tage</p>
          <p className="text-xs text-gray-500">in Folge gelaufen</p>
        </div>
      </div>

      <div
        className="p-3 rounded-lg border text-center"
        style={{
          backgroundColor: shouldJog ? '#0f2818' : '#1a1a1a',
          borderColor: shouldJog ? '#00e67640' : '#2a2a2a',
        }}
      >
        {shouldJog ? (
          <>
            <p className="text-sm font-semibold" style={{ color: '#00e676' }}>
              Heute ist Jogging-Tag!
            </p>
            <p className="text-xs text-gray-500 mt-1">Zeit fuer 5km!</p>
          </>
        ) : completed ? (
          <>
            <p className="text-sm font-semibold text-green-400">
              Heute geschafft!
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Calendar className="w-3 h-3 text-gray-500" />
              <p className="text-xs text-gray-500">Naechster Lauf: {nextJogDate}</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1">
              <Calendar className="w-3 h-3 text-gray-500" />
              <p className="text-xs text-gray-400">Naechster Jogging-Tag: {nextJogDate}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
