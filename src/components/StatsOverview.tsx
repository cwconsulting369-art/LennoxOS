import { Flame, Target, TrendingUp, Zap } from 'lucide-react';

interface StatsOverviewProps {
  todayReps: number;
  streak: number;
  totalReps: number;
  todayCalories: number;
}

export default function StatsOverview({
  todayReps,
  streak,
  totalReps,
  todayCalories,
}: StatsOverviewProps) {
  const stats = [
    {
      label: 'Heute',
      value: todayReps,
      suffix: 'Wdh',
      icon: Target,
      color: '#00e676',
      bgColor: 'rgba(0,230,118,0.08)',
    },
    {
      label: 'Streak',
      value: streak,
      suffix: 'Tage',
      icon: Flame,
      color: '#ff9100',
      bgColor: 'rgba(255,145,0,0.08)',
    },
    {
      label: 'Gesamt',
      value: totalReps,
      suffix: 'Wdh',
      icon: TrendingUp,
      color: '#00e676',
      bgColor: 'rgba(0,230,118,0.08)',
    },
    {
      label: 'Kalorien',
      value: Math.round(todayCalories),
      suffix: 'kcal',
      icon: Zap,
      color: '#ff9100',
      bgColor: 'rgba(255,145,0,0.08)',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="relative rounded-xl border border-[#2a2a2a] p-4 transition-all duration-300"
          style={{ backgroundColor: '#1a1a1a' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ backgroundColor: stat.bgColor }}
            >
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {stat.label}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl md:text-3xl font-bold"
              style={{ color: stat.color }}
            >
              {stat.value.toLocaleString('de-DE')}
            </span>
            <span className="text-xs text-gray-500 font-medium">
              {stat.suffix}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
