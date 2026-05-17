import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  sparklineData?: number[];
  sparklineColor?: string;
  onClick?: () => void;
}

export function KPICard({ label, value, sub, trend, sparklineData, sparklineColor, onClick }: KPICardProps) {
  const chartData = (sparklineData || []).map((v, i) => ({ i, v }));
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const lineColor = sparklineColor || '#00d4ff';

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-os-border bg-os-card p-4 ${onClick ? 'cursor-pointer hover:border-os-cyan/40' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-os-muted">{label}</span>
        {trend !== undefined && (
          <span className={`text-[11px] font-medium ${isPositive ? 'text-os-green' : isNegative ? 'text-os-red' : 'text-os-muted'}`}>
            {isPositive ? '▲' : isNegative ? '▼' : '—'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold text-os-text">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-os-secondary">{sub}</p>}
      {chartData.length > 1 && (
        <div className="mt-2 h-[30px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
