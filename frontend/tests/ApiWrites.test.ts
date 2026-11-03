import { afterEach, expect, it, vi } from 'vitest';
import { mutate, request, readCache } from '../src/api/client';

afterEach(() => { vi.unstubAllGlobals(); history.replaceState(null, '', '/'); localStorage.clear(); });
it('sends launch params unchanged on reads and writes and keeps personal data out of disk cache', async () => {
  history.replaceState(null, '', '/?vk_user_id=42&sign=a%2Bb');
  const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify({ data: String(url).endsWith('/visit') ? { vk_user_id: 42 } : { notifications_allowed: true } })));
  vi.stubGlobal('fetch', fetcher);
  await request('/me/visit', new AbortController().signal);
  expect(fetcher.mock.calls[0]).toEqual(['/api/me/visit', expect.objectContaining({ headers: expect.objectContaining({ 'X-VK-Launch-Params': '?vk_user_id=42&sign=a%2Bb' }) })]);
  expect(readCache('/me/visit')).toBeUndefined();
  await mutate('/me/notifications', 'PUT', { allowed: true });
  expect(fetcher).toHaveBeenLastCalledWith('/api/me/notifications', expect.objectContaining({ method: 'PUT', body: '{"allowed":true}' }));
});
it('preserves server error code and field details on a failed write', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: null, error: { code: 'validation_error', message: 'Проверьте поля', details: [{ field: 'name', problem: 'required' }] } }), { status: 422 })));
  await expect(mutate('/me/notifications', 'PUT', {})).rejects.toMatchObject({ status: 422, code: 'validation_error', details: [{ field: 'name', problem: 'required' }] });
});
