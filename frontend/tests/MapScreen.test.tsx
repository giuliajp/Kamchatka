import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { currentStage, MapScreen } from '../src/screens/Map/MapScreen';
import { fixtureResponse, mockApi, positions, race, stage } from './fixtures';
import type { MapCanvasProps } from '../src/screens/Map/MapCanvas';
vi.mock('../src/screens/Map/MapCanvas', () => ({ MapCanvas: (props: MapCanvasProps) => <div role="region" aria-label="Карта маршрута">
  {props.data.participants.map(p => <button key={p.race_participant_id} onClick={() => props.onSelect(p)}>Точка {p.start_number}</button>)}
  <button onClick={() => props.onCluster(props.data.participants)}>Кластер</button><button onClick={props.onRefresh}>Обновить карту</button>
  {props.track && <span>Трек участника {props.track.start_number}</span>}
</div> }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });
const show = () => render(<AppProviders><MapScreen /></AppProviders>);
it('uses backend stage IDs, numbers and discipline codes; connects map, track and person', async () => {
  const api = mockApi(); const user = userEvent.setup(); show();
  await screen.findByRole('button', { name: 'Точка 14' });
  await user.keyboard('{ArrowLeft}');
  expect(api).toHaveBeenCalledWith('/api/stages/103', expect.anything());
  expect(api).toHaveBeenCalledWith('/api/races/10/positions?stage=3', expect.anything());
  await user.click(screen.getByRole('button', { name: 'Точка 14' }));
  expect(await screen.findByRole('dialog', { name: 'Карточка участника' })).toBeVisible();
  await screen.findByText('Трек участника 14');
  expect(api).toHaveBeenCalledWith('/api/race-participants/9001/track?stage=3', expect.anything());
  await user.click(screen.getByRole('button', { name: 'Свернуть' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Карточка участника' })).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Кластер' }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Участники рядом' })).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Кластер' }));
  await user.click(await screen.findByRole('button', { name: 'Иван Петров · №22' }));
  expect(await screen.findByRole('button', { name: /Иван Петров/ })).toBeVisible();
  await user.click(await screen.findByRole('button', { name: 'Свернуть' }));
  await user.click(screen.getByRole('button', { name: /Нарта, 8 собак.*№14/ }));
  await user.click(await screen.findByRole('button', { name: 'Свернуть' }));
  await user.click(screen.getByRole('button', { name: 'Обновить карту' }));
  await user.click(screen.getByRole('tab', { name: 'Дисциплина: все' }));
  await user.click(screen.getByRole('radio', { name: 'Нарта, 8 собак' }));
  expect(await screen.findByText('Топ-3 по GPS в дисциплине')).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10/positions?stage=3&discipline=sled_8', expect.anything());
  await user.click(screen.getByRole('button', { name: /1. Алиса Иванова/ }));
  await user.click(await screen.findByRole('button', { name: 'Свернуть' }));
  await user.click(screen.getByRole('button', { name: 'Участники' }));
  expect(await screen.findByText('Алиса Иванова')).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Дисциплина: Нарта, 8 собак' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Назад' }));
  expect(await screen.findByRole('button', { name: 'Точка 14' })).toBeVisible();
}, 15000); // Full keyboard/map/dialog journey with real VKUI transitions under coverage.
it('hides GPS independently for every published discipline and opens official results', async () => {
  mockApi(url => url.includes('/positions') ? { ...positions, official_protocol_disciplines: ['sled_8', 'unknown_internal'] } : fixtureResponse(url));
  const user = userEvent.setup(); show();
  await screen.findByRole('button', { name: 'Точка 22' });
  expect(screen.queryByRole('button', { name: 'Точка 14' })).not.toBeInTheDocument();
  expect(screen.getByText(/По дисциплинам/)).toHaveTextContent('Нарта, 8 собак, дисциплина без названия');
  expect(screen.getByText(/По дисциплинам/)).not.toHaveTextContent('unknown_internal');
  await user.click(screen.getByRole('button', { name: 'Открыть протокол' }));
  expect(await screen.findByText('Зачёт после этапа 3')).toBeVisible();
  await userEvent.click(await screen.findByText('Подробная таблица',{selector:'summary'}));
  await user.click(await screen.findByRole('button', { name: '№14 · Алиса Иванова' }));
  expect(await screen.findByRole('dialog', { name: 'Карточка участника' })).toBeVisible();
  expect(screen.queryByText('Позиция по GPS-трекеру: 1')).not.toBeInTheDocument();
});
it('supports cancelled, planned and finished stages and the overall standings selector', async () => {
  const api = mockApi(); const user = userEvent.setup(); show();
  await screen.findByRole('button', { name: 'Точка 14' });
  const choose = async (number: number) => {
    await user.click(screen.getByRole('combobox', { name: 'Этап гонки' }));
    await user.click(screen.getByRole('option', { name: new RegExp('Этап ' + number) }));
  };
  await choose(5); expect(await screen.findByRole('heading', { name: 'Этап 5 отменён' })).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Карта маршрута' })).not.toBeInTheDocument();
  await choose(4); await user.click(screen.getByRole('button', { name: 'Смотреть 3 этап live' }));
  expect(await screen.findByRole('button', { name: 'Точка 14' })).toBeVisible();
  await choose(2); await user.click(screen.getByRole('button', { name: 'Результаты этапа' }));
  expect(await screen.findByText('Зачёт после этапа 2')).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10/results?stage=2', expect.anything());
  await user.click(screen.getByRole('combobox', { name: 'Этап гонки' }));
  await user.click(screen.getByRole('option', { name: /Общий зачёт/ }));
  expect(await screen.findByRole('heading', { name: 'Общий зачёт' })).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10/results', expect.anything());
  await userEvent.click(await screen.findByText('Подробная таблица',{selector:'summary'}));
  await user.click(screen.getByRole('button', { name: '№14 · Алиса Иванова' }));
  expect(await screen.findByText(/Официальное место в дисциплине за гонку: 2/)).toBeVisible();
  expect(api).toHaveBeenCalledWith('/api/races/10/results?discipline=sled_8', expect.anything());
  await user.click(screen.getByRole('button', { name: 'Свернуть' }));
  await user.click(screen.getByRole('button', { name: 'Карта' }));
  expect(await screen.findByRole('heading', { name: 'Этап 2 завершён' })).toBeVisible();
});
it('renders no stages, no route, no coordinates and zero/null GPS ranks without substitutions', async () => {
  const api = mockApi(url => url.includes('/positions') ? { ...positions, participants: positions.participants.map(p => ({ ...p, position: null, gps_rank: null })) }
    : /\/stages\//.test(url) ? { ...stage, route_geojson: null } : fixtureResponse(url));
  show(); await screen.findByText('Положения отсутствуют'); expect(screen.getByText('Маршрут пока не опубликован.')).toBeVisible();
  expect(screen.queryByText(/Лидеры по GPS/)).not.toBeInTheDocument();
  api.mockImplementation(async () => new Response(JSON.stringify({ data: { ...race, stages: [] } })));
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(await screen.findByText('Этапы пока не объявлены')).toBeVisible();
});
it('shows genuine empty-race errors and retry instead of fixture data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null, error: { message: 'Гонок пока нет' } }), { status: 404 })));
  show(); expect(await screen.findByText('Гонок пока нет')).toBeVisible();
  expect(screen.queryByText(/Гонка Авача 2026/)).not.toBeInTheDocument();
  const api = mockApi(() => ({ ...race, stages: [] }));
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByRole('heading', { name: race.name })).toBeVisible(); expect(api).toHaveBeenCalled();
});
it('shows stale GPS time and suppresses positions once all disciplines publish', async () => {
  mockApi(url => url.includes('/positions') ? { ...positions, participants: positions.participants.map(p => ({ ...p, is_stale: true })) } : fixtureResponse(url));
  const { unmount } = show();
  expect(await screen.findByText(/Последняя подтверждённая точка на/)).toBeVisible(); unmount(); localStorage.clear();
  mockApi(url => url.includes('/positions') ? { ...positions, official_protocol_disciplines: ['sled_8', 'ski_2'] } : fixtureResponse(url));
  show(); await screen.findByRole('button', { name: 'Открыть протокол' });
  expect(screen.queryByText('Положения отсутствуют')).not.toBeInTheDocument();
});
it('orders the top three only within the selected discipline', async () => {
  mockApi(url => url.includes('/positions') ? { ...positions, participants: [positions.participants[0], { ...positions.participants[1], discipline: positions.participants[0].discipline, gps_rank: 2 }] } : fixtureResponse(url));
  const user = userEvent.setup(); show();
  await screen.findByRole('button', { name: 'Точка 14' });
  await user.click(screen.getByRole('tab', { name: 'Дисциплина: все' }));
  await user.click(screen.getByRole('radio', { name: 'Нарта, 8 собак' }));
  expect(await screen.findByRole('button', { name: /2. Иван Петров/ })).toBeVisible();
});
it('chooses the same current-stage fallback as the backend', () => {
  expect(currentStage([])).toBeUndefined(); expect(currentStage([stage])?.id).toBe(103);
  expect(currentStage([{ ...stage, status: 'planned', start_at: null }])?.id).toBe(103);
  expect(currentStage([{ ...stage, id: 1, status: 'finished' }, { ...stage, id: 2, status: 'finished' }], Date.parse('2026-10-28'))?.id).toBe(2);
  expect(currentStage([{ ...stage, status: 'planned', start_at: '2027-01-01T00:00:00Z' }], Date.parse('2026-10-28'))?.id).toBe(103);
});
