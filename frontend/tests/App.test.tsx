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
