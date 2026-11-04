import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { validResponse } from './validate';
export const tokenKey = 'avacha:admin-token';
export class ApiError extends Error {
  constructor(message: string, public status = 0, public code?: string, public details?: unknown) { super(message); }
}
let memoryToken: string | null = null;
export let memorySession = false;
export function readToken() {
  if (memorySession) return memoryToken;
  try { return sessionStorage.getItem(tokenKey); }
  catch { memorySession = true; return memoryToken; }
}
export function storeToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(tokenKey, token); else sessionStorage.removeItem(tokenKey);
    memorySession = false;
  } catch { memorySession = true; }
}
function expireSession(response: Response, token: string | null, signal?: AbortSignal | null) {
  if (response.status === 401 && !signal?.aborted && readToken() === token) {
    storeToken(null); window.dispatchEvent(new Event('admin:expired'));
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = readToken();
  const response = await fetch((import.meta.env.VITE_API_BASE_URL || '/api') + path, { ...options, headers: { Accept: 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}), ...options.headers } });
  if (path !== '/admin/login') expireSession(response, token, options.signal);
  let body;
  try { body = await response.json(); } catch { throw new ApiError('Сервер вернул некорректный ответ', response.status); }
  if (!response.ok || body?.error) throw new ApiError(body?.error?.message || `Ошибка ${response.status}`, response.status, body?.error?.code, body?.error?.details);
  if (!body || body.data === undefined || body.data === null || !validResponse(path, body.data, options.method)) throw new ApiError('Ответ сервера не соответствует формату', response.status);
  return body.data;
}
export async function save<T>(path: string, method: string, data?: unknown): Promise<T> {
  const multipart = data instanceof FormData;
  const result = await api<T>(path, { method, ...(data === undefined ? {} : { body: multipart ? data : JSON.stringify(data), headers: multipart ? {} : { 'Content-Type': 'application/json' } }) });
  window.dispatchEvent(new Event('admin:changed')); return result;
}
export interface Resource<T> { data?: T; loading: boolean; error?: Error; refresh: () => void }
export const ResourceAccess = createContext(true);
export function useResource<T>(path: string | null, poll = 0): Resource<T> {
  const enabled = useContext(ResourceAccess);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const [state, setState] = useState<{ path: string | null; data?: T; error?: Error; loading: boolean }>({ path: null, loading: false });
  useEffect(() => {
    if (!enabled || !path) return;
    const controller = new AbortController();
    setState(old => ({ path, data: old.path === path ? old.data : undefined, loading: true }));
    void api<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setState({ path, data, loading: false }); }).catch(error => { if (!controller.signal.aborted) setState(old => ({ ...old, error: error instanceof Error ? error : new Error('Не удалось связаться с сервером'), loading: false })); });
    return () => controller.abort();
  }, [path, revision, enabled]);
  useEffect(() => { window.addEventListener('admin:changed', refresh); const timer = poll ? setInterval(refresh, poll) : undefined; return () => { window.removeEventListener('admin:changed', refresh); clearInterval(timer); }; }, [poll, refresh]);
  return { ...(path === state.path ? state : { loading: Boolean(path) }), refresh };
}
export function useAction() {
  const lock = useRef(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<Error>(); const [done, setDone] = useState(false);
  const run = async (action: () => Promise<unknown>) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(undefined); setDone(false);
    try { await action(); setDone(true); return true; } catch (error) { setError(error instanceof Error ? error : new Error('Не удалось выполнить действие')); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, error, done, run };
}
export async function downloadStats(raceId: number, days: number) {
  const token = readToken();
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/admin/races/${raceId}/support-stats.csv?days=${days}`, { headers: { Authorization: `Bearer ${token}` } });
  expireSession(response, token);
  if (!response.ok) throw new ApiError(`Не удалось загрузить CSV (${response.status})`, response.status);
  const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `support-${raceId}.csv`; anchor.click(); URL.revokeObjectURL(url);
}
