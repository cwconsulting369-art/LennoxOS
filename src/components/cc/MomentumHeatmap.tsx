/**
 * GitHub-style contribution heatmap for the last N days of commits.
 * Intensity scales with commit count; today gets a ring.
 */
export default function MomentumHeatmap({ daily, cell = 13, gap = 3 }: { daily: number[]; cell?: number; gap?: number }) {
  const max = Math.max(1, ...daily);
  return (
    <div style={{ display: 'flex', gap }}>
      {daily.map((n, i) => {
        const intensity = n === 0 ? 0 : 0.22 + (n / max) * 0.78;
        const isToday = i === daily.length - 1;
        return (
          <div
            key={i}
            title={`${n} commit${n === 1 ? '' : 's'}`}
            style={{
              width: cell,
              height: cell,
              borderRadius: 3,
              background: n === 0 ? 'rgba(255,255,255,0.05)' : `rgba(74,222,128,${intensity})`,
              boxShadow: n > 0 ? `0 0 ${4 + intensity * 6}px rgba(74,222,128,${intensity * 0.5})` : 'none',
              border: isToday ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
            }}
          />
        );
      })}
    </div>
  );
}
