import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../lib/cc-api';

export interface ApiState<T> {
  data: T | null;
  error: boolean;
  loading: boolean;
  /** Whether data was ever successfully loaded (for skeleton vs refresh) */
  loaded: boolean;
}

/**
 * Polling fetch hook for the Command Center.
 * - Polls `path` every `intervalMs` (0 = once, no polling).
 * - Keeps last good data on transient errors (alive-feel, no flicker).
 * - Aborts in-flight requests on unmount / path change.
 */
export function useApi<T>(path: string, intervalMs = 0): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController;

    async function tick() {
      controller = new AbortController();
      try {
        const result = await apiGet<T>(path, controller.signal);
        if (!mounted.current) return;
        setData(result);
        setError(false);
        setLoaded(true);
      } catch (e) {
        if (!mounted.current || (e instanceof DOMException && e.name === 'AbortError')) return;
        setError(true);
      } finally {
        if (mounted.current) {
          setLoading(false);
          if (intervalMs > 0) timer = setTimeout(tick, intervalMs);
        }
      }
    }

    tick();
    return () => {
      mounted.current = false;
      if (timer) clearTimeout(timer);
      if (controller) controller.abort();
    };
  }, [path, intervalMs]);

  return { data, error, loading, loaded };
}
