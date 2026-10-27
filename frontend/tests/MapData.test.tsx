import { act, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { readPreferences, storageKey, writePreferences, demoNow } from '../src/screens/Map/demo';
import { Countdown } from '../src/screens/Map/StageContent';
import { App } from '../src/App';
import { TopParticipantsCard } from '../src/components/TopParticipantsCard';
import { AppProviders } from '../src/app/AppProviders';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('validates stored data and survives unavailable browser storage', () => {
  for (const bad of ['invalid json', '3', '{}', '{"supported":[999],"prompted":[],"notifications":[]}', '{"supported":[],"prompted":null,"notifications":[]}']) {
    localStorage.setItem(storageKey, bad);
    expect(readPreferences()).toEqual({ supported: [], prompted: [], notifications: [] });
  }
  const prefs = { supported: [14], prompted: [14], notifications: [14] };
  expect(writePreferences(prefs)).toBe(true); expect(readPreferences()).toEqual(prefs);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(readPreferences().supported).toEqual([]);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
  expect(writePreferences(prefs)).toBe(false);
});
it('stops the countdown at zero without starting the stage', () => {
  vi.useFakeTimers();
  const { unmount } = render(<Countdown startAt={new Date(demoNow + 2000).toISOString()} now={demoNow} />);
  expect(within(screen.getByRole('timer')).getByText('02')).toBeVisible();
  act(() => vi.advanceTimersByTime(3000));
  expect(within(screen.getByRole('timer')).getAllByText('00')).toHaveLength(4);
  expect(screen.getByText('Ожидаем подтверждение старта организаторами.')).toBeVisible();
  expect(vi.getTimerCount()).toBe(0);
  unmount(); expect(vi.getTimerCount()).toBe(0);
});
it('does not run an expired countdown and restarts when the start time changes', () => {
  vi.useFakeTimers();
  const { rerender, unmount } = render(<Countdown startAt={new Date(demoNow - 1000).toISOString()} now={demoNow} />);
  expect(within(screen.getByRole('timer')).getAllByText('00')).toHaveLength(4);
  expect(screen.getByText('Ожидаем подтверждение старта организаторами.')).toBeVisible();
  expect(vi.getTimerCount()).toBe(0);
  rerender(<Countdown startAt={new Date(demoNow + 2000).toISOString()} now={demoNow} />);
  expect(within(screen.getByRole('timer')).getByText('02')).toBeVisible();
  act(() => vi.advanceTimersByTime(1000));
  expect(within(screen.getByRole('timer')).getByText('01')).toBeVisible();
  rerender(<Countdown startAt={new Date(demoNow + 2000).toISOString()} now={demoNow + 1000} />);
  expect(within(screen.getByRole('timer')).getByText('01')).toBeVisible();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it('uses the OS dark theme for the application', () => {
  vi.mocked(window.matchMedia).mockReturnValueOnce({ ...window.matchMedia('(prefers-color-scheme: dark)'), matches: true });
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Гонка Авача 2027' }).closest('.vkui--vkBase--dark')).not.toBeNull();
});
it('renders empty and timed compact leaders without losing action semantics', () => {
  const onSelect = vi.fn();
  const { rerender } = render(<AppProviders><TopParticipantsCard compact title="Лидеры" entries={[]} onSelect={onSelect} /></AppProviders>);
  expect(screen.getByText('Результатов пока нет')).toBeVisible();
  rerender(<AppProviders><TopParticipantsCard compact title="Лидеры" entries={[{ id: '1', number: '14', label: 'Алиса', time: '02:45', place: 1 }]} onSelect={onSelect} /></AppProviders>);
  screen.getByRole('button').click(); expect(onSelect).toHaveBeenCalledWith('1');
});
