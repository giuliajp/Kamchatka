import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import { UserProvider, useUser } from '../src/app/UserProvider';
vi.mock('@vkontakte/vk-bridge', () => ({ default: { isEmbedded: vi.fn(() => true), supports: vi.fn(() => true), send: vi.fn().mockResolvedValue({ result: true }) } }));
afterEach(() => { vi.unstubAllGlobals(); history.replaceState(null, '', '/'); });
function Probe() { const user = useUser(); return <><p>{user.id ?? 'Гость'}</p><p>{String(user.allowed)}</p><button onClick={() => { void user.setNotifications(true).catch(() => {}); }}>Разрешить</button></>; }
it('records the visit and only persists permission after VK confirms it', async () => {
  const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify({ data: String(url).endsWith('/supports') ? [] : String(url).endsWith('/visit') ? { vk_user_id: 42 } : { notifications_allowed: true } })));
  vi.stubGlobal('fetch', fetcher);
  render(<UserProvider><Probe /></UserProvider>);
  await screen.findByText('42');
  vi.mocked(bridge.send).mockRejectedValueOnce(new Error('cancel'));
  await userEvent.click(screen.getByText('Разрешить'));
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/notifications'))).toHaveLength(0);
  expect(screen.getByText('false')).toBeVisible();
  await userEvent.click(screen.getByText('Разрешить'));
  await screen.findByText('true');
  expect(fetcher).toHaveBeenCalledWith('/api/me/notifications', expect.objectContaining({ method: 'PUT', body: '{"allowed":true}' }));
});
it('keeps public UI available on unauthorized visits', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Откройте приложение во ВКонтакте' } }), { status: 401 })));
  render(<UserProvider><Probe /></UserProvider>);
  await waitFor(() => expect(screen.getByText('Гость')).toBeVisible());
});
