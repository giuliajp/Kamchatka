import { validApiData } from './validate';

export const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: unknown) { super(message); }
}
export interface Snapshot<T> { data: T; savedAt: string }
const cacheKey = (path: string) => `avacha-api-v1:${apiBase}${path}`;
export const canPersist = (path: string) => !/^\/me(?:\/|$)|\/support(?:\?|$)/.test(path);

export function readCache<T>(path: string): Snapshot<T> | undefined {
  if (!canPersist(path)) return;
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey(path)) || 'null');
    if (saved && typeof saved === 'object' && saved.data !== undefined && saved.data !== null && validApiData(path, saved.data) && typeof saved.savedAt === 'string' && Number.isFinite(Date.parse(saved.savedAt))) return saved;
  } catch { /* Browser storage can be disabled or contain obsolete data. */ }
}
async function send<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(apiBase + path, { ...init, headers: { Accept: 'application/json', 'X-VK-Launch-Params': window.location.search, ...init.headers } });
  let body;
  try { body = await response.json(); }
  catch { throw new ApiError('Сервер вернул некорректный ответ', response.status); }
  if (!response.ok || body?.error) throw new ApiError(body?.error?.message || 'Не удалось загрузить данные', response.status, body?.error?.code, body?.error?.details);
  if (!body || body.data === undefined || body.data === null) throw new ApiError('В ответе сервера отсутствуют данные', response.status);
  if (!validApiData(path, body.data, init.method)) throw new ApiError('Данные сервера не соответствуют формату API', response.status);
  return body.data as T;
}
export async function request<T>(path: string, signal: AbortSignal, persist = true): Promise<Snapshot<T>> {
  const data = await send<T>(path, { signal });
  const snapshot = { data, savedAt: new Date().toISOString() };
  if (persist && canPersist(path) && !signal.aborted) {
    try { localStorage.setItem(cacheKey(path), JSON.stringify(snapshot)); }
    catch { /* Keep the successful response in memory if storage is unavailable. */ }
  }
  return snapshot;
}
export async function mutate<T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', data?: unknown, signal?: AbortSignal): Promise<T> {
  const result = await send<T>(path, { method, signal, ...(data === undefined ? {} : { body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }) });
  if (!signal?.aborted) window.dispatchEvent(new Event('avacha:changed'));
  return result;
}
export function query(path: string, values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') params.set(key, String(value));
  return path + (params.size ? '?' + params.toString() : '');
}
