import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { SupportAction, NotificationToggle } from '../src/components/ParticipantActions';
import { mockFeaturesEnabled, mockFinish, mockVisits, participationKey, preferencesKey, readPreferences, supporters, useExtras } from '../src/mocks/extras';
import { stage } from './fixtures';
afterEach(() => { localStorage.clear(); vi.unstubAllEnvs(); });
function Snapshot() { return <output>{JSON.stringify(useExtras().value)}</output>; }
const actions = <AppProviders><SupportAction raceId={10} entryId={9001} number={14} /><NotificationToggle raceId={10} entryId={9001} /><Snapshot /></AppProviders>;
it('persists one support vote, offers a subscription once and toggles both actions independently', async () => {
  const user = userEvent.setup(); const { unmount } = render(actions);
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  expect(screen.getByRole('button', { name: 'Вы болеете' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(await screen.findByRole('button', { name: 'Да, уведомлять' }));
  expect(readPreferences()).toEqual({ supported: ['10:9001'], subscriptions: ['10:9001'], prompted: ['10:9001'] });
  await user.click(screen.getByRole('button', { name: 'Отключить уведомления' }));
  await user.click(screen.getByRole('button', { name: 'Включить уведомления' }));
  await user.click(screen.getByRole('button', { name: 'Вы болеете' }));
  expect(readPreferences().supported).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  unmount(); render(actions);
  expect(screen.getByRole('button', { name: 'Вы болеете' })).toBeVisible();
  expect(supporters(9001, true).total - supporters(9001, false).total).toBe(1);
  expect(participationKey(11, 9001)).not.toBe(participationKey(10, 9001));
});
it.each(['Позже', 'Закрыть'])('defers notifications through %s and keeps support', async name => {
  const user = userEvent.setup(); render(actions);
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  await user.click(await screen.findByRole('button', { name }));
  expect(readPreferences().subscriptions).toEqual([]); expect(readPreferences().prompted).toEqual(['10:9001']);
});
it('validates stored data, synchronises tabs and survives unavailable storage in memory', async () => {
  expect(readPreferences().supported).toEqual([]);
  for (const value of ['{', '{}', '{"supported":[2],"subscriptions":[],"prompted":[]}', '{"supported":["bad"],"subscriptions":[],"prompted":[]}']) {
    localStorage.setItem(preferencesKey, value); expect(readPreferences().supported).toEqual([]);
  }
  localStorage.clear(); render(actions);
  localStorage.setItem(preferencesKey, JSON.stringify({ supported: ['10:9001'], subscriptions: [], prompted: [] }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' })));
  expect(screen.getByRole('button', { name: 'Болею за' })).toBeVisible();
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: preferencesKey })));
  expect(screen.getByRole('button', { name: 'Вы болеете' })).toBeVisible();
  localStorage.clear(); act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(screen.getByRole('button', { name: 'Болею за' })).toBeVisible();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  await userEvent.click(screen.getByRole('button', { name: 'Болею за' }));
  expect(screen.getByRole('button', { name: 'Вы болеете' })).toBeVisible();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  expect(readPreferences().supported).toEqual([]);
});
it('requires a provider', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Snapshot />)).toThrow('ExtrasProvider is required');
});
it('produces deterministic supplemental visits only for existing checkpoints and valid dates', () => {
  const checkpoint = stage.checkpoints[0];
  const detail = { ...stage, checkpoints: [{ ...checkpoint, id: 2, order_index: 2, label: null, km_from_start: null, required_rest_minutes: 20 }, checkpoint] };
  const live = mockVisits(detail, 9001);
  expect(live).toEqual(mockVisits(detail, 9001)); expect(live[0].status).toBe('Проходит'); expect(live[0].title).toBe(checkpoint.name);
  expect(live[1].departedAt).not.toBeNull();
  expect(mockVisits({ ...detail, status: 'finished', finish_at: '2026-10-27T06:00:00Z' }, 9001)[0].status).toBe('Пройден');
  expect(mockVisits({ ...stage, checkpoints: [] }, 1)).toEqual([]);
  for (const patch of [{ start_at: null }, { start_at: 'bad' }, { finish_at: 'bad' }, { finish_at: '2020-01-01' }, { status: 'cancelled' as const }]) expect(mockVisits({ ...detail, ...patch }, 1)).toEqual([]);
});
it('derives demo finish only from completed participation with valid start and official duration, and can disable all mocks', () => {
  const finished = { ...stage, status: 'finished' as const };
  expect(mockFinish(finished, 'finished', 60)).toBe('2026-10-27T01:01:00.000Z');
  for (const [value, status, duration] of [[stage, 'finished', 60], [finished, 'dnf', 60], [{ ...finished, start_at: null }, 'finished', 60], [finished, 'finished', null], [{ ...finished, start_at: 'bad' }, 'finished', 60]] as const) expect(mockFinish(value, status, duration)).toBeNull();
  vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'false'); expect(mockFeaturesEnabled()).toBe(false);
  expect(mockFinish(finished, 'finished', 60)).toBeNull(); expect(mockVisits(stage, 1)).toEqual([]);
});
it('preserves another tab’s just-saved preferences before the storage event arrives', async () => {
  render(actions);
  localStorage.setItem(preferencesKey, JSON.stringify({ supported: ['10:9002'], subscriptions: ['10:9002'], prompted: [] }));
  await userEvent.click(screen.getByRole('button', { name: 'Включить уведомления' }));
  expect(readPreferences()).toEqual({ supported: ['10:9002'], subscriptions: ['10:9002', '10:9001'], prompted: [] });
});
