import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ParticipantSheet } from '../src/components/ParticipantSheet';
import { mockApi, person, positions } from './fixtures';
beforeEach(() => { vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'true'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });
it.each([undefined, 'false', 'anything'])('keeps official data without fake counters, checkpoint visits or finish (flag: %s)', async flag => {
  const { stage } = await import('./fixtures');
  vi.stubEnv('VITE_MOCK_MISSING_FEATURES', flag); mockApi();
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={{ ...stage, status: 'finished' }} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('00:16:40')).toBeVisible();
  expect(screen.queryByText(/болельщиков/)).not.toBeInTheDocument();
  expect(screen.queryByText(/^Финиш /)).not.toBeInTheDocument();
  expect(screen.queryByText('Прохождение контрольных пунктов (КП)')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Болею за' })).not.toBeInTheDocument();
});
it('loads identity by person ID and matches participation by entry ID, with labelled demonstration extras', async () => {
  const api = mockApi(); const close = vi.fn(); const user = userEvent.setup();
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} position={positions.participants[0]} threshold={45} onClose={close} /></AppProviders>);
  expect(await screen.findByText('Алиса Иванова')).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/participants/501', expect.anything());
  expect(screen.getByLabelText('Позиция по GPS-трекеру: 1')).toBeVisible(); expect(screen.getByText('9,4 км/ч')).toBeVisible();
  expect(screen.getByText(/Официальное место.*2/)).toBeVisible();
  expect(screen.getByText(/болельщиков/)).toBeVisible(); expect(screen.getByText('Прохождение контрольных пунктов (КП)')).toBeVisible(); expect(screen.getByRole('button', { name: 'Болею за' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Алиса Иванова/ })); expect(screen.getByText(person.bio!)).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Алиса Иванова/ })); expect(screen.queryByText(person.bio!)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Свернуть' })); expect(close).toHaveBeenCalledOnce();
});
it('handles missing biography, photo, region, time, place and GPS independently', async () => {
  mockApi(() => ({ ...person, photo_url: '/photo.jpg', bio: null, races: [{ ...person.races[0], place: null, total_time: null, region: null }] }));
  const { rerender } = render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} position={{ ...positions.participants[0], position: null, gps_rank: null, km_on_route: null, avg_speed_kmh: null, gap_to_leader_km: null }} threshold={45} onClose={vi.fn()} /></AppProviders>);
  await userEvent.click(await screen.findByRole('button', { name: /Алиса Иванова/ }));
  expect(screen.getByText('Биография пока не опубликована.')).toBeVisible(); expect(screen.getByText('Положения отсутствуют')).toBeVisible();
  rerender(<AppProviders><ParticipantSheet participantId={501} entryId={9001} position={{ ...positions.participants[0], is_stale: true }} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(screen.getByText(/Последняя подтверждённая точка/)).toBeVisible();
});
it('allows an empty history and a person without a matching participation', async () => {
  mockApi(() => ({ ...person, races: [] }));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9999} threshold={45} onClose={vi.fn()} /></AppProviders>);
  await userEvent.click(await screen.findByText('История выступлений')); expect(screen.getByText('Выступления пока не опубликованы.')).toBeVisible();
  expect(screen.queryByText(/Позиция по GPS/)).not.toBeInTheDocument();
});
it('links real checkpoint identities to supplemental history, shares, supports and displays a derivable finish', async () => {
  const { stage, fixtureResponse } = await import('./fixtures');
  mockApi(url => url.includes('/participants/501') ? { ...person, races: [{ ...person.races[0], dogs_count: null, place: null, status: 'finished' }] } : fixtureResponse(url));
  const writeText = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const close = vi.fn(); const detail = { ...stage, status: 'finished' as const, finish_at: '2026-10-27T06:00:00Z', checkpoints: [{ ...stage.checkpoints[0], required_rest_minutes: 30 }] };
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={detail} threshold={45} onClose={close} /></AppProviders>);
  expect(await screen.findByText(/Финиш 27.10/)).toBeVisible();
  expect(screen.getByText('Старт · 0 км')).toBeVisible();
  await userEvent.click(screen.getByText('Обязательные остановки')); expect(screen.getByText('Старт · 0 км: 30 мин.')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Поделиться участником' })); expect(await screen.findByText('Ссылка скопирована')).toBeVisible();
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('race=10&person=501&entry=9001&stage=103'));
  await userEvent.click(screen.getByRole('button', { name: 'Болею за' })); await userEvent.click(await screen.findByRole('button', { name: 'Позже' }));
  expect(screen.getByText(/болельщиков/)).toBeVisible();
});
it('has official fallbacks, no invented CPs, and honours the mock switch', async () => {
  const { stage } = await import('./fixtures');
  mockApi(() => ({ ...person, races: [{ ...person.races[0], total_time: null, place: null, dogs_count: null }] }));
  const { rerender } = render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={{ ...stage, race_id: 99 }} threshold={45} onClose={vi.fn()} /></AppProviders>);
  await screen.findByText('Алиса Иванова'); expect(screen.getByText('История прохождения КП пока отсутствует.')).toBeVisible();
  vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'false');
  rerender(<AppProviders><ParticipantSheet participantId={501} entryId={9001} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(screen.queryByText(/болельщиков/)).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Болею за' })).not.toBeInTheDocument();
  vi.unstubAllEnvs();
});
it('closes with a downward gesture on its surface, while a long gesture on an action does not close it', async () => {
  mockApi(); const close = vi.fn();
  const { container } = render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} threshold={45} onClose={close} /></AppProviders>);
  await screen.findByText('Алиса Иванова'); const surface = container.querySelector('.map-participant')!;
  fireEvent(surface, new MouseEvent('pointerdown', { bubbles: true, clientY: 10 }));
  fireEvent(screen.getByRole('button', { name: 'Свернуть' }), new MouseEvent('pointerup', { bubbles: true, clientY: 150 }));
  expect(close).not.toHaveBeenCalled();
  fireEvent(surface, new MouseEvent('pointerup', { bubbles: true, clientY: 180 })); expect(close).toHaveBeenCalledOnce();
});
it('does not derive finish when an official stage result lacks completed status', async () => {
  const { stage, fixtureResponse, results } = await import('./fixtures');
  mockApi(url => url.includes('/results') ? { ...results, disciplines: [{ ...results.disciplines[0], rows: [{ ...results.disciplines[0].rows[0], stages: [{ ...results.disciplines[0].rows[0].stages[0], status: null, time: '02:00:00' }] }] }] } : fixtureResponse(url));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={{ ...stage, status: 'finished' }} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('02:00:00')).toBeVisible(); expect(screen.queryByText(/^Финиш /)).not.toBeInTheDocument();
});
it('uses the selected-stage standings and never substitutes final-race places for an empty stage result', async () => {
  const { stage, fixtureResponse, results } = await import('./fixtures');
  const api = mockApi(url => url.includes('/results') ? { ...results, disciplines: [{ ...results.disciplines[0], rows: [{ ...results.disciplines[0].rows[0], place: 5, gap_to_leader_seconds: 300 }] }] } : fixtureResponse(url));
  const { unmount } = render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={{ ...stage, status: 'finished' }} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('5 место')).toBeVisible(); expect(screen.getByText('300 с')).toBeVisible(); expect(screen.getByText('время этапа')).toBeVisible();
  expect(screen.queryByText('2 место')).not.toBeInTheDocument(); unmount(); localStorage.clear();
  api.mockImplementation(async input => new Response(JSON.stringify({ data: String(input).includes('/results') ? { ...results, disciplines: [] } : fixtureResponse(String(input)), error: null })));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={{ ...stage, status: 'finished' }} threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText('Результат участника для выбранного этапа пока не опубликован.')).toBeVisible(); expect(screen.queryByText('2 место')).not.toBeInTheDocument();
});
it('loads overall official standings without inventing a stage or a personal finish', async () => {
  const { fixtureResponse, results } = await import('./fixtures');
  const api = mockApi(url => url.includes('/results') ? { ...results, disciplines: [{ ...results.disciplines[0], rows: [{ ...results.disciplines[0].rows[0], place: null, status: 'dnf', total_time: null }] }] } : fixtureResponse(url));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} showOfficial threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText(/Официальное место в дисциплине за гонку: —/)).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10/results?discipline=sled_8', expect.anything());
  expect(screen.queryByText('2 место')).not.toBeInTheDocument(); expect(screen.queryByText(/^Финиш /)).not.toBeInTheDocument();
});
it('requests the selected live protocol before detailed checkpoint metadata arrives', async () => {
  const { stage, fixtureResponse } = await import('./fixtures');
  const { id, number, name, distance_km, start_at, finish_at, status } = stage;
  const api = mockApi(url => fixtureResponse(url));
  render(<AppProviders><ParticipantSheet participantId={501} entryId={9001} stage={{ id, number, name, distance_km, start_at, finish_at, status }} showOfficial threshold={45} onClose={vi.fn()} /></AppProviders>);
  expect(await screen.findByText(/Официальное место в дисциплине после этапа 3: 2/)).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10/results?stage=3&discipline=sled_8', expect.anything());
  expect(screen.getByText('История прохождения КП пока отсутствует.')).toBeVisible();
});

it('does not use an entry from another race when a shared URL mixes identities', async () => {
  mockApi();
  render(<AppProviders><ParticipantSheet raceId={99} participantId={501} entryId={9001} threshold={45} onClose={vi.fn()} /></AppProviders>);
  await screen.findByText('Алиса Иванова');
  expect(screen.queryByRole('button', { name: 'Болею за' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Поделиться участником' })).not.toBeInTheDocument();
  expect(screen.getByText('Участник не заявлен на выбранную гонку.')).toBeVisible();
});
