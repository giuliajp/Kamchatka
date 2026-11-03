import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ParticipantsScreen } from '../src/screens/Participants/ParticipantsScreen';
import { ResultsScreen, StandingTable } from '../src/screens/Results/ResultsScreen';
import { ParticipantCard } from '../src/components/ParticipantCard';
import { AppProviders } from '../src/app/AppProviders';
import { fixtureResponse, mockApi, participant, protocols, results, standing } from './fixtures';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });
it('searches and sorts real participants and opens a card with independent IDs', async () => {
  const api = mockApi(); const selected = vi.fn(); const user = userEvent.setup();
  render(<AppProviders><ParticipantsScreen raceId={10} discipline="sled_8" onSelect={selected} /></AppProviders>);
  await user.click(await screen.findByRole('button', { name: 'Открыть карточку Алиса Иванова' }));
  expect(selected).toHaveBeenCalledWith(501, 9001);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Сортировка участников' }), 'name');
  await user.type(screen.getByRole('searchbox'), '14');
  expect(api).toHaveBeenCalledWith('/api/races/10/participants?discipline=sled_8&q=14&sort=name', expect.anything());
  await user.clear(screen.getByRole('searchbox')); await user.type(screen.getByRole('searchbox'), 'Нет такого');
  expect(await screen.findByText('Пока нет данных')).toBeVisible();
});
it('renders participant nullable fields and an open action without support', async () => {
  mockApi(() => [{ ...participant, photo_url: '/p.jpg', region: null, place: null, total_time: null }]);
  render(<AppProviders><ParticipantsScreen raceId={10} discipline="" onSelect={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('Регион не указан')).toBeVisible(); expect(screen.getByText(/Место в дисциплине: —/)).toBeVisible();
});
it('retains optional card handlers for the UI kit', async () => {
  const open = vi.fn(); const support = vi.fn();
  render(<AppProviders><ParticipantCard name="Каюр" number={1} region="Камчатка" discipline="Нарта" supported={false} onSupportToggle={support} onOpen={open} /></AppProviders>);
  await userEvent.click(screen.getByRole('button', { name: 'Болею за' })); expect(support).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', { name: 'Открыть карточку Каюр' })); expect(open).toHaveBeenCalledOnce();
});
it('shows published protocols, penalty explanations and corrections without adding times', async () => {
  mockApi(); const select = vi.fn();
  render(<AppProviders><ResultsScreen raceId={10} stageId={103} stageNumber={3} discipline="sled_8" onSelect={select} /></AppProviders>);
  await userEvent.click(await screen.findByRole('button', { name: '№14 · Алиса Иванова' })); expect(select).toHaveBeenCalledWith(501, 9001);
  expect(screen.getAllByText('00:16:40').length).toBeGreaterThan(0); expect(screen.queryByText('00:18:40')).not.toBeInTheDocument();
  expect(screen.getByText(/Главный судья: Иванов/)).toBeVisible(); expect(screen.getByText(/Главный секретарь: Петрова/)).toBeVisible(); expect(screen.getByText('Погода: Ясно')).toBeVisible();
  expect(screen.getByText(/Исправлено после утверждения/)).toBeVisible();
});
it('handles preliminary, empty and unpublished protocols without inventing results', async () => {
  mockApi(url => url.endsWith('/protocols') ? { ...protocols, protocols: [{ ...protocols.protocols[0], chief_judge: null, chief_secretary: null, weather: null }, { ...protocols.protocols[0], discipline: { id: 5, code: 'other', name: 'Другая' } }] }
    : url.includes('/results') ? { ...results, penalty_included_in_stage_times: false, disciplines: [{ ...results.disciplines[0], stages: [{ ...results.disciplines[0].stages[0], is_final: false }], rows: [] }] } : fixtureResponse(url));
  const { unmount } = render(<AppProviders><ResultsScreen raceId={10} stageId={103} stageNumber={3} discipline="" onSelect={vi.fn()} /></AppProviders>);
  expect(await screen.findByText(/предварительный протокол/)).toBeVisible(); expect(screen.getByText(/Итоговое время рассчитано организаторами/)).toBeVisible();
  expect(screen.getByText('Пока нет данных')).toBeVisible(); unmount(); localStorage.clear();
  mockApi(() => ({ ...results, disciplines: [] }));
  render(<AppProviders><ResultsScreen raceId={10} stageId={undefined} stageNumber={undefined} discipline="" onSelect={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('Пока нет данных')).toBeVisible();
});
it('preserves null, DNF/DNS/DSQ and penalty metadata in result rows', () => {
  const rows = [{ ...standing, place: null, total_time: null, gap_to_leader: null, penalty_total: null,
    stages: [{ ...standing.stages[0], status: 'dnf', time: null, note: null, is_corrected_after_final: false },
      { ...standing.stages[0], stage_number: 4, status: null }, { ...standing.stages[0], stage_number: 5, status: 'dns' }, { ...standing.stages[0], stage_number: 6, status: 'dsq' }],
    penalties: [{ ...standing.penalties[0], reason: null, rule_reference: null }] }];
  render(<AppProviders><StandingTable rows={rows} onSelect={vi.fn()} /></AppProviders>);
  expect(screen.getByText(/\(DNF\)/)).toBeVisible(); expect(screen.getByText(/\(DNS\)/)).toBeVisible(); expect(screen.getByText(/\(DSQ\)/)).toBeVisible();
});
it('sorts supporters locally with the existing API sort and honours the supplemental switch', async () => {
  vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'true');
  const api = mockApi(() => [participant, { ...participant, race_participant_id: 9002, participant_id: 502, full_name: 'Иван Петров' }]);
  const { rerender } = render(<AppProviders><ParticipantsScreen raceId={10} discipline="" onSelect={vi.fn()} /></AppProviders>);
  await screen.findByText('Алиса Иванова');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Сортировка участников' }), 'supporters');
  expect(screen.getAllByRole('button', { name: /Открыть карточку/ })[0]).toHaveAccessibleName('Открыть карточку Иван Петров');
  expect(api).toHaveBeenCalledWith('/api/races/10/participants?sort=start_number', expect.anything());
  vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'false'); rerender(<AppProviders><ParticipantsScreen raceId={10} discipline="" onSelect={vi.fn()} /></AppProviders>);
  expect(screen.queryByRole('option', { name: 'По количеству болельщиков' })).not.toBeInTheDocument(); vi.unstubAllEnvs();
});
it('filters official results to supported participation IDs and shows a real empty filter result', async () => {
  const { preferencesKey } = await import('../src/mocks/extras'); mockApi();
  localStorage.setItem(preferencesKey, JSON.stringify({ supported: ['10:9001'], subscriptions: [], prompted: [] }));
  render(<AppProviders><ResultsScreen raceId={10} stageId={103} stageNumber={3} discipline="" mine onSelect={vi.fn()} /></AppProviders>);
  expect(await screen.findByRole('button', { name: '№14 · Алиса Иванова' })).toBeVisible();
  localStorage.clear(); const { act } = await import('@testing-library/react');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
  expect(await screen.findByText('Среди опубликованных результатов нет поддерживаемых вами участников.')).toBeVisible(); expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
