import { Clock, Dumbbell } from 'lucide-react';

export interface HistoryEntry {
  id: number;
  date: string;
  exercise: string;
  sets: number;
  total_reps: number;
  calories: number;
}

interface HistoryTableProps {
  entries: HistoryEntry[];
}

export default function HistoryTable({ entries }: HistoryTableProps) {
  if (entries.length === 0) {
    return (
      <div
        className="rounded-xl border border-[#2a2a2a] p-8 text-center"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Noch keine Trainingseintraege.</p>
        <p className="text-gray-600 text-xs mt-1">
          Starte dein Training und die Eintraege erscheinen hier.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-[#2a2a2a] overflow-hidden"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div className="p-4 border-b border-[#2a2a2a] flex items-center gap-2">
        <Dumbbell className="w-5 h-5 text-[#00e676]" />
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Letzte Trainingseinträge
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Datum
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Uebung
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Sets
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                Wdh
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                kcal
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const dateObj = new Date(entry.date + 'T00:00:00');
              const dateStr = dateObj.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              });
              return (
                <tr
                  key={entry.id}
                  className="border-b border-[#222] hover:bg-[#222] transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-300">{dateStr}</td>
                  <td className="px-4 py-3 text-sm text-gray-200 font-medium">
                    {entry.exercise}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#00e676] text-center font-semibold">
                    {entry.sets}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 text-center">
                    {entry.total_reps}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#ff9100] text-center font-medium">
                    {Math.round(entry.calories)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
