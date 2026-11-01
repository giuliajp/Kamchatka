import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { mockApi, race } from './fixtures';
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it('starts with the actual API race and all five destinations and local extras', async () => {
  mockApi(() => ({ ...race, stages: [] }));
  render(<App />);
  expect(await screen.findByRole('heading', { name: race.name })).toBeVisible();
  expect(screen.getByRole('navigation', { name: 'Разделы гонки' })).toBeVisible();
  expect(screen.queryByText(/демонстраци|демоданные/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Программа' })).toBeVisible();
  expect(screen.getByRole('tab', { name: /Мои/ })).toBeVisible();
});
it('uses the OS dark theme', async () => {
  mockApi(() => ({ ...race, stages: [] }));
  vi.mocked(window.matchMedia).mockReturnValueOnce({ ...window.matchMedia('(prefers-color-scheme: dark)'), matches: true });
  render(<App />);
  expect((await screen.findByRole('heading', { name: race.name })).closest('.vkui--vkBase--dark')).not.toBeNull();
});
it('follows OS theme changes and removes the media listener when unmounted', async () => {
  mockApi(() => ({ ...race, stages: [] }));
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  const media = { ...window.matchMedia('(prefers-color-scheme: dark)'), matches: false,
    addEventListener: vi.fn((_type, listener) => listeners.push(listener)), removeEventListener: vi.fn() };
  vi.mocked(window.matchMedia).mockReturnValue(media);
  const { unmount } = render(<App />);
  const heading = await screen.findByRole('heading', { name: race.name });
  expect(listeners).toHaveLength(1);
  const { act } = await import('@testing-library/react');
  act(() => listeners[0]({ matches: true } as MediaQueryListEvent));
  expect(heading.closest('.vkui--vkBase--dark')).not.toBeNull();
  act(() => listeners[0]({ matches: false } as MediaQueryListEvent));
  expect(heading.closest('.vkui--vkBase--dark')).toBeNull();
  unmount(); expect(media.removeEventListener).toHaveBeenCalledWith('change', listeners[0]);
});
