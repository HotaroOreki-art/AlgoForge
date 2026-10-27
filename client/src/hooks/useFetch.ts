import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../api/client.ts';

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Minimal data hook: fetches `path` whenever it changes, aborts stale
 * requests, exposes `reload`, and lets callers patch data optimistically.
 */
export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: path !== null });
  const abortRef = useRef<AbortController | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState((s) => ({ ...s, loading: true, error: null }));
    api<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setState((s) => ({ ...s, error: errorMessage(err), loading: false }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((updater: (prev: T | null) => T | null) => setState((s) => ({ ...s, data: updater(s.data) })), []);

  return { ...state, reload, setData };
}
