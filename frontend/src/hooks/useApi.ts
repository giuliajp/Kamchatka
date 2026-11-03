import { useCallback, useEffect, useState } from 'react';
import { ApiError, readCache, request, type Snapshot } from '../api/client';

export interface Resource<T> { data?: T; savedAt?: string; error?: ApiError; loading: boolean; refresh: () => void }
export function useApi<T>(path: string | null, poll = 0, persist = true): Resource<T> {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const [state, setState] = useState<{ path: string | null; snapshot?: Snapshot<T>; error?: ApiError; loading: boolean }>({ path: null, loading: false });
  useEffect(() => {
    if (path === null) { setState({ path: null, loading: false }); return; }
    const controller = new AbortController();
    setState(previous => ({ path, snapshot: previous.path === path ? previous.snapshot : persist ? readCache<T>(path) : undefined, loading: true }));
    const load = async () => {
      try {
        if (!navigator.onLine) throw new ApiError('Нет соединения', 0);
        const snapshot = await request<T>(path, controller.signal, persist);
        if (!controller.signal.aborted) setState({ path, snapshot, loading: false });
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false,
          error: error instanceof ApiError ? error : new ApiError('Не удалось связаться с сервером', 0) }));
      }
    };
    void load();
    return () => controller.abort();
  }, [path, revision, persist]);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('avacha:changed', refresh);
    const timer = poll > 0 ? window.setInterval(visible, poll) : undefined;
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('avacha:changed', refresh);
      window.clearInterval(timer);
    };
  }, [poll, refresh]);
  if (path === null) return { loading: false, refresh };
  if (state.path !== path) return { loading: true, refresh };
  return { ...state.snapshot, error: state.error, loading: state.loading, refresh };
}
