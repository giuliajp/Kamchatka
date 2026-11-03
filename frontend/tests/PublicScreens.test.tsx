import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { ParticipantsScreen } from '../src/screens/Participants/ParticipantsScreen';
import { ResultsScreen, StandingTable } from '../src/screens/Results/ResultsScreen';
import { ParticipantCard } from '../src/components/ParticipantCard';
import { AppProviders } from '../src/app/AppProviders';
import { fixtureResponse, mockApi, participant, protocols, results, standing, discipline, stage } from './fixtures';
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
  const table = within(screen.getByRole('table'));
  expect(table.getByRole('columnheader', { name: 'Регион' })).toBeVisible();
  expect(table.getByRole('cell', { name: 'Камчатский край' })).toBeVisible();
  expect(table.getByText('Собаки на старте: 8')).toBeVisible();
  expect(table.getByText('Собаки на финише: 8')).toBeVisible();
});
it.each(['Камчатский край', null])('shows region %s and each stage’s own dog counts, including null and zero', region => {
  const cell = standing.stages[0];
  render(<StandingTable rows={[{ ...standing, region, stages: [
    { ...cell, stage_number: 3, dogs_at_start: 8, dogs_at_finish: 7 },
    { ...cell, stage_number: 4, dogs_at_start: 0, dogs_at_finish: null },
    { ...cell, stage_number: 5, dogs_at_start: null, dogs_at_finish: 0 },
  ] }]} onSelect={vi.fn()} />);
  expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell')[1]).toHaveTextContent(region ?? '—');
  const third = within(screen.getByText(/^Этап 3:/));
  expect(third.getByText('Собаки на старте: 8')).toBeVisible();
  expect(third.getByText('Собаки на финише: 7')).toBeVisible();
  const fourth = within(screen.getByText(/^Этап 4:/));
  expect(fourth.getByText('Собаки на старте: 0')).toBeVisible();
  expect(fourth.getByText('Собаки на финише: —')).toBeVisible();
  const fifth = within(screen.getByText(/^Этап 5:/));
  expect(fifth.getByText('Собаки на старте: —')).toBeVisible();
  expect(fifth.getByText('Собаки на финише: 0')).toBeVisible();
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
it('uses server supporter sorting without rearranging the response locally', async () => {
  const api = mockApi(url => url.endsWith('/me/visit') ? { vk_user_id: 42 } : url.endsWith('/me/supports') ? [] : [participant, { ...participant, race_participant_id: 9002, participant_id: 502, full_name: 'Иван Петров' }]);
  render(<AppProviders><ParticipantsScreen raceId={10} discipline="" onSelect={vi.fn()} /></AppProviders>);
  await screen.findByText('Алиса Иванова');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Сортировка участников' }), 'supporters');
  expect(screen.getAllByRole('button', { name: /Открыть карточку/ })[0]).toHaveAccessibleName('Открыть карточку Алиса Иванова');
  expect(api).toHaveBeenCalledWith('/api/races/10/participants?sort=supporters', expect.anything());
});
it('filters official results to supported participation IDs and shows a real empty filter result', async () => {
  let supported = true;
  mockApi(url => url.endsWith('/me/supports') ? supported ? [{ ...participant, race_id: 10, discipline, notifications_enabled: false, supported_since: stage.start_at }] : [] : fixtureResponse(url));
  render(<AppProviders><ResultsScreen raceId={10} stageId={103} stageNumber={3} discipline="" mine onSelect={vi.fn()} /></AppProviders>);
  expect(await screen.findByRole('button', { name: '№14 · Алиса Иванова' })).toBeVisible();
  supported = false; const { act } = await import('@testing-library/react');
  act(() => window.dispatchEvent(new Event('avacha:changed')));
  expect(await screen.findByText('Среди опубликованных результатов нет поддерживаемых вами участников.')).toBeVisible(); expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
