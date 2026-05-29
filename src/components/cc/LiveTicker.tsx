import { Radio } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { fmt } from '../../lib/cc-api';
import type { EventsResponse, HermesRun } from '../../lib/cc-api';

interface TickerItem {
  key: string;
  time: string;
  ts: number;
  source: string;
  text: string;
  tone: 'ok' | 'warn' | 'err' | 'neutral';
}

function tsOf(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Live activity stream. Merges the events table with recent Hermes runs
 * so the rail is never dead even while the events feed warms up.
 * Polls every 10s.
 */
export default function LiveTicker() {
  const events = useApi<EventsResponse>('/api/events/recent?limit=20', 10_000);
  const runs = useApi<{ items?: HermesRun[]; runs?: HermesRun[] } | HermesRun[]>('/api/hermes/runs?limit=20', 10_000);

  const items: TickerItem[] = [];

  for (const e of events.data?.events ?? []) {
    const iso = e.created_at ?? e.ts;
    items.push({
      key: `ev-${e.id ?? iso ?? Math.random()}`,
      time: fmt.timeHM(iso),
      ts: tsOf(iso),
      source: e.project ?? e.type ?? 'event',
      text: e.message ?? e.title ?? e.type ?? '—',
      tone: 'neutral',
    });
  }

  const runList = Array.isArray(runs.data) ? runs.data : runs.data?.items ?? runs.data?.runs ?? [];
  for (const r of runList) {
    const iso = r.started_at ?? r.created_at;
    const failed = (r.status ?? '').toLowerCase().includes('fail') || (r.status ?? '').toLowerCase().includes('error');
    const model = (r.model_used ?? '').split('/').pop()?.replace('claude-', '') ?? '';
    items.push({
      key: `run-${r.id ?? iso ?? Math.random()}`,
      time: fmt.timeHM(iso),
      ts: tsOf(iso),
      source: r.agent ?? r.slug ?? (model ? `hermes·${model}` : 'hermes'),
      text: `run ${r.status ?? 'done'}${r.cost_cents ? ` · ${fmt.cents(r.cost_cents)}` : ''}`,
      tone: failed ? 'err' : 'ok',
    });
  }

  items.sort((a, b) => b.ts - a.ts);
  const top = items.slice(0, 22);
  const isLoading = events.loading && runs.loading;

  return (
    <div className="cc-ticker">
      <div className="cc-ticker__head">
        <Radio size={13} className="cc-ticker__live" />
        <span className="cc-tile__label">Live Activity</span>
        <span className="cc-ticker__count">{top.length}</span>
      </div>
      <div className="cc-ticker__body">
        {isLoading && <div className="cc-ticker__empty">lädt…</div>}
        {!isLoading && top.length === 0 && <div className="cc-ticker__empty">Keine Aktivität im Stream</div>}
        {top.map((it) => (
          <div key={it.key} className="cc-ticker__row">
            <span className={`cc-dot cc-dot--${it.tone}`} />
            <span className="cc-ticker__time">{it.time}</span>
            <span className="cc-ticker__src">{it.source}</span>
            <span className="cc-ticker__text">{it.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
