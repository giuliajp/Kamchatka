import { act, renderHook, waitFor, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiBase, ApiError, query, readCache, request } from '../src/api/client';
import { useApi } from '../src/hooks/useApi';
import { metric, raceDate, raceTime, stageOption, stale, statusLabel } from '../src/api/format';
import { RequestState } from '../src/components/RequestState';
import { AppProviders } from '../src/app/AppProviders';
import { positions, stage } from './fixtures';

beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });
const signal = () => new AbortController().signal;
const respond = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status })));
it('uses configured bases, canonical query parameters and validates cached envelopes', async () => {
  expect(query('/test', { stage: 3, discipline: 'sled_8', q: '', absent: undefined })).toBe('/test?stage=3&discipline=sled_8');
  expect(query('/test', {})).toBe('/test');
  expect(readCache('/test')).toBeUndefined();
  for (const invalid of ['bad json', 'null', '{}', '{"data":[],"savedAt":"bad"}']) {
    localStorage.setItem(`avacha-api-v2:${apiBase}/test`, invalid);
    expect(readCache('/test')).toBeUndefined();
  }
  respond({ data: [1], error: null });
  const saved = await request('/test', signal());
  expect(readCache('/test')).toEqual(saved);
  expect(fetch).toHaveBeenCalledWith(apiBase + '/test', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await expect(request('/test', signal())).resolves.toMatchObject({ data: [1] });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
  expect(readCache('/test')).toBeUndefined();
  vi.resetModules(); vi.stubEnv('VITE_API_BASE_URL', 'https://example.test/api/');
  expect((await import('../src/api/client')).apiBase).toBe('https://example.test/api');
});
it('rejects HTTP and envelope failures without replacing cached data', async () => {
  for (const [body, status, message] of [
    [{ data: null, error: { message: 'Гонок пока нет' } }, 404, 'Гонок пока нет'],
    [{}, 503, 'Не удалось загрузить данные'],
    [{ error: { message: 'Ошибка' } }, 200, 'Ошибка'],
    [null, 200, 'В ответе сервера отсутствуют данные'],
    [{ data: null }, 200, 'В ответе сервера отсутствуют данные'],
    [{}, 200, 'В ответе сервера отсутствуют данные'],
  ] as const) {
    respond(body, status); await expect(request('/test', signal())).rejects.toThrow(message);
    expect(readCache('/test')).toBeUndefined();
  }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('html')));
  await expect(request('/test', signal())).rejects.toThrow('Сервер вернул некорректный ответ');
  respond({ data: false }); await request('/private', signal(), false); expect(readCache('/private')).toBeUndefined();
});
it('loads, refreshes, polls and keeps a last successful response on errors', async () => {
  respond({ data: { value: 1 } });
  const { result, unmount } = renderHook(() => useApi<{ value: number }>('/test', 120000));
  await waitFor(() => expect(result.current.data?.value).toBe(1));
  vi.mocked(fetch).mockRejectedValue(new Error('network'));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.error?.message).toBe('Не удалось связаться с сервером'));
  expect(result.current.data?.value).toBe(1);
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { value: 2 } })));
  act(() => window.dispatchEvent(new Event('online')));
  await waitFor(() => expect(result.current.data?.value).toBe(2));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  act(() => window.dispatchEvent(new Event('offline')));
  await waitFor(() => expect(result.current.error?.message).toBe('Нет соединения'));
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  const before = vi.mocked(fetch).mock.calls.length;
  await act(async () => { vi.advanceTimersByTime(120000); });
  expect(vi.mocked(fetch).mock.calls.length).toBe(before);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ data: { value: 3 } })));
  act(() => result.current.refresh());
  await act(async () => {});
  await act(async () => { vi.advanceTimersByTime(120000); });
  expect(result.current.data?.value).toBe(3);
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  unmount();
});
it('polls every two minutes while visible and removes its timer', async () => {
  vi.useFakeTimers(); respond({ data: [] });
  const clear = vi.spyOn(window, 'clearInterval');
  const { unmount } = renderHook(() => useApi('/poll', 120000));
  await act(async () => {});
  const initial = vi.mocked(fetch).mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(120000); });
  expect(vi.mocked(fetch).mock.calls.length).toBe(initial + 1);
  unmount(); expect(clear).toHaveBeenCalledOnce();
});
it('aborts obsolete queries, never mixes filters and supports disabled/non-persistent resources', async () => {
  const resolvers: ((value: Response) => void)[] = [];
  const signals: AbortSignal[] = [];
  vi.stubGlobal('fetch', vi.fn((_url, options) => { signals.push(options.signal); return new Promise<Response>(resolve => resolvers.push(resolve)); }));
  const { result, rerender, unmount } = renderHook(({ path }) => useApi<string>(path, 0, false), { initialProps: { path: '/one' as string | null } });
  rerender({ path: '/two' }); expect(signals[0].aborted).toBe(true);
  await act(async () => resolvers[0](new Response(JSON.stringify({ data: 'old' }))));
  expect(result.current.data).toBeUndefined();
  await act(async () => resolvers[1](new Response(JSON.stringify({ data: 'new' }))));
  expect(result.current.data).toBe('new'); expect(readCache('/two')).toBeUndefined();
  rerender({ path: null }); expect(result.current.data).toBeUndefined(); expect(result.current.loading).toBe(false);
  unmount();
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort'))))));
  const pending = renderHook(() => useApi('/pending')); pending.unmount();
  await act(async () => {});
});
it('starts offline from a saved response and renders loading, errors and cache times honestly', async () => {
  respond({ data: [] }); const snapshot = await request('/cached', signal());
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  const { result } = renderHook(() => useApi('/cached'));
  await waitFor(() => expect(result.current.error?.status).toBe(0)); expect(result.current.data).toEqual([]);
  const { rerender } = render(<AppProviders><RequestState resource={{ loading: true, refresh: vi.fn() }} /></AppProviders>);
  expect(screen.getByText('Загружаем данные')).toBeInTheDocument();
  rerender(<AppProviders><RequestState resource={{ ...snapshot, loading: false, error: new ApiError('fail', 0), refresh: vi.fn() }} /></AppProviders>);
  expect(screen.getByText('Нет соединения')).toBeVisible(); expect(screen.getByText(/Сохранённые данные/)).toBeVisible();
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  const retry = vi.fn();
  rerender(<AppProviders><RequestState resource={{ loading: false, error: new ApiError('Ошибка API', 503), refresh: retry }} /></AppProviders>);
  screen.getByRole('button', { name: 'Повторить' }).click(); expect(retry).toHaveBeenCalledOnce(); expect(screen.getByText('Ошибка API')).toBeVisible();
  rerender(<AppProviders><RequestState resource={{ data: [], loading: false, error: new ApiError('fail', 0), refresh: retry }} /></AppProviders>);
  expect(screen.getByText('Не удалось обновить данные')).toBeVisible();
  rerender(<AppProviders><RequestState resource={{ data: [], loading: true, refresh: retry }} /></AppProviders>); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('formats server units, statuses, stage dates and freshness without invented values', () => {
  expect(metric(null, 'км')).toBe('—'); expect(metric(0, 'км')).toBe('0 км'); expect(metric(9.4, 'км/ч')).toBe('9,4 км/ч');
  expect(raceDate('2026-10-27T23:30:00Z')).toBe('28.10'); expect(raceTime('2026-10-27T23:30:00Z')).toBe('11:30');
  expect(stageOption(stage).value).toBe('103'); expect(stageOption({ ...stage, start_at: null, status: 'planned' }).upcoming).toBe(true);
  expect(statusLabel('finished')).toBe('Финишировал'); expect(statusLabel('dnf')).toBe('DNF'); expect(statusLabel('custom')).toBe('custom');
  expect(stale(positions.participants[0], 45, Date.parse(positions.participants[0].position!.position_at))).toBe(false);
  expect(stale(positions.participants[0], 45, Date.parse(positions.participants[0].position!.position_at) + 46 * 60000)).toBe(true);
  expect(stale(positions.participants[1], 45)).toBe(true); expect(stale({ ...positions.participants[0], position: null }, 45)).toBe(false);
});

 it.each(['', 'https://example.test/api/'])('requests data using the configured or default base: %s', async base => {
  vi.resetModules(); vi.stubEnv('VITE_API_BASE_URL', base);
  const client = await import('../src/api/client');
  respond({data: [], error: null});
  await client.request('/test', signal());
  expect(fetch).toHaveBeenCalledWith((base ? base.slice(0, -1) : '/api') + '/test', expect.anything());
 });
