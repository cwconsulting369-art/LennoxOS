import { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Cookie, Coffee, Cigarette, TrendingDown, TrendingUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { Database } from '@/lib/database';

interface ReductionTrackerProps {
  database: Database;
  refreshKey: number;
}

export default function ReductionTracker({ database, refreshKey }: ReductionTrackerProps) {
  const [noSugar, setNoSugar] = useState(false);
  const [coffeeCups, setCoffeeCups] = useState(0);
  const [cigarettes, setCigarettes] = useState(0);
  const [stats, setStats] = useState({
    avgCoffee7d: 0,
    avgCigarettes7d: 0,
    noSugarDays7d: 0,
    noSugarDays30d: 0,
    coffeeReduction: 0,
    cigaretteReduction: 0,
  });

  const refresh = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const log = database.getLifestyleLog(today);
    setNoSugar(log.noSugar);
    setCoffeeCups(log.coffeeCups);
    setCigarettes(log.cigarettes);
    setStats(database.getLifestyleStats());
  }, [database]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const toggleNoSugar = () => {
    const today = new Date().toISOString().split('T')[0];
    database.toggleNoSugar(today);
    refresh();
  };

  const adjustCoffee = (delta: number) => {
    const today = new Date().toISOString().split('T')[0];
    const newValue = Math.max(0, coffeeCups + delta);
    database.setCoffeeCups(today, newValue);
    refresh();
  };

  const adjustCigarettes = (delta: number) => {
    const today = new Date().toISOString().split('T')[0];
    const newValue = Math.max(0, cigarettes + delta);
    database.setCigarettes(today, newValue);
    refresh();
  };

  return (
    <div className="space-y-4">
      {/* No Sugar */}
      <div
        className="rounded-xl border border-[#2a2a2a] p-4"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-pink-400" />
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Zuckerfrei
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              {noSugar ? 'Heute kein Zucker' : 'Zucker konsumiert'}
            </span>
            <Switch
              checked={noSugar}
              onCheckedChange={toggleNoSugar}
              className="data-[state=checked]:bg-pink-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex-1 p-2 rounded-lg text-center" style={{ backgroundColor: '#252525' }}>
            <p className="text-lg font-bold text-pink-400">{stats.noSugarDays7d}</p>
            <p className="text-xs text-gray-500">von 7 Tagen</p>
          </div>
          <div className="flex-1 p-2 rounded-lg text-center" style={{ backgroundColor: '#252525' }}>
            <p className="text-lg font-bold text-pink-400">{stats.noSugarDays30d}</p>
            <p className="text-xs text-gray-500">von 30 Tagen</p>
          </div>
        </div>
      </div>

      {/* Coffee */}
      <div
        className="rounded-xl border border-[#2a2a2a] p-4"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Coffee className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Kaffee
          </h3>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Tassen heute</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustCoffee(-1)}
              className="w-8 h-8 rounded-lg border border-[#2a2a2a] flex items-center justify-center transition-all hover:bg-[#252525] active:scale-95"
              type="button"
              aria-label="Kaffee entfernen"
            >
              <Minus size={14} className="text-gray-400" />
            </button>
            <span className="text-xl font-bold text-amber-400 w-8 text-center">
              {coffeeCups}
            </span>
            <button
              onClick={() => adjustCoffee(1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: '#ff9100' }}
              type="button"
              aria-label="Kaffee hinzufuegen"
            >
              <Plus size={14} className="text-[#0f0f0f]" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#252525' }}>
          <div className="flex-1 flex items-center justify-between">
            <span className="text-xs text-gray-500">7-Tage-Schnitt</span>
            <span className="text-sm font-bold text-amber-400">{stats.avgCoffee7d}</span>
          </div>
          <div className="w-px h-4 bg-[#2a2a2a]" />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-xs text-gray-500">Trend</span>
            {stats.coffeeReduction > 0 ? (
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-green-400">-{stats.coffeeReduction}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500">-</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cigarettes */}
      <div
        className="rounded-xl border border-[#2a2a2a] p-4"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Cigarette className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Zigaretten
          </h3>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Anzahl heute</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => adjustCigarettes(-1)}
              className="w-8 h-8 rounded-lg border border-[#2a2a2a] flex items-center justify-center transition-all hover:bg-[#252525] active:scale-95"
              type="button"
              aria-label="Zigaretten entfernen"
            >
              <Minus size={14} className="text-gray-400" />
            </button>
            <span className="text-xl font-bold text-red-400 w-8 text-center">
              {cigarettes}
            </span>
            <button
              onClick={() => adjustCigarettes(1)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: '#ef4444' }}
              type="button"
              aria-label="Zigaretten hinzufuegen"
            >
              <Plus size={14} className="text-white" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: '#252525' }}>
          <div className="flex-1 flex items-center justify-between">
            <span className="text-xs text-gray-500">7-Tage-Schnitt</span>
            <span className="text-sm font-bold text-red-400">{stats.avgCigarettes7d}</span>
          </div>
          <div className="w-px h-4 bg-[#2a2a2a]" />
          <div className="flex-1 flex items-center justify-between">
            <span className="text-xs text-gray-500">Trend</span>
            {stats.cigaretteReduction > 0 ? (
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-green-400">-{stats.cigaretteReduction}%</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500">-</span>
              </div>
            )}
          </div>
        </div>

        {cigarettes > 0 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Ersparnis heute: ca. {(cigarettes * 0.35).toFixed(2)} €
          </p>
        )}
      </div>
    </div>
  );
}
