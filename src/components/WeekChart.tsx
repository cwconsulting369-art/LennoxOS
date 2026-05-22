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

interface WeekChartProps {
  data: { date: string; label: string; totalReps: number }[];
}

export default function WeekChart({ data }: WeekChartProps) {
  return (
    <div
      className="rounded-xl border border-[var(--border)] p-4 md:p-5"
      style={{ backgroundColor: 'var(--bg-card)' }}
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wider">
        Letzte 7 Tage
      </h3>
      <p className="text-xs text-[var(--text-muted)] mb-4">Gesamt Wiederholungen pro Tag</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#888', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#888', fontSize: 12 }}
            width={35}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: '#f0f0f0',
            }}
            formatter={(value: number) => [`${value} Wdh`, 'Wiederholungen']}
            labelFormatter={() => ''}
          />
          <Bar dataKey="totalReps" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.totalReps > 0 ? 'var(--accent)' : 'var(--border)'}
                opacity={entry.totalReps > 0 ? 0.9 : 0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
