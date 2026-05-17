import { Minus, Plus } from 'lucide-react';

interface ExerciseCardProps {
  exercise: string;
  color: string;
  sets: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export default function ExerciseCard({
  exercise,
  color,
  sets,
  onIncrement,
  onDecrement,
}: ExerciseCardProps) {
  const reps = sets * 10;

  return (
    <div
      className="relative rounded-xl border border-[#2a2a2a] p-4 flex flex-col items-center gap-3 transition-all duration-200 hover:border-opacity-60"
      style={{
        backgroundColor: '#1a1a1a',
        borderColor: sets > 0 ? `${color}40` : '#2a2a2a',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-sm font-semibold text-gray-200 text-center leading-tight">
          {exercise}
        </h3>
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <span
          className="text-3xl font-bold"
          style={{ color }}
        >
          {sets}
        </span>
        <span className="text-xs text-gray-500">
          {sets === 1 ? 'Set' : 'Sets'} = {reps} Wdh
        </span>
      </div>

      <div className="flex items-center gap-3 w-full">
        <button
          onClick={onDecrement}
          disabled={sets <= 0}
          className="flex-1 flex items-center justify-center h-10 rounded-lg border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#252525] active:scale-95"
          style={{ borderColor: '#2a2a2a' }}
          type="button"
          aria-label="Set entfernen"
        >
          <Minus size={18} className="text-gray-400" />
        </button>
        <button
          onClick={onIncrement}
          className="flex-1 flex items-center justify-center h-10 rounded-lg transition-all duration-150 hover:opacity-90 active:scale-95"
          style={{ backgroundColor: color }}
          type="button"
          aria-label="Set hinzufuegen"
        >
          <Plus size={18} className="text-[#0f0f0f]" />
        </button>
      </div>
    </div>
  );
}
