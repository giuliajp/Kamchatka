import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { MapScreen } from '../src/screens/Map/MapScreen';
import { readPreferences } from '../src/screens/Map/demo';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
const show = (props: React.ComponentProps<typeof MapScreen> = {}) => render(<AppProviders><MapScreen {...props} /></AppProviders>);
it('closes successive prompts with Escape using current support and notification preferences', async () => {
  const user = userEvent.setup(); show();
  for (const id of [14, 21]) {
    await user.click(screen.getByRole('button', { name: new RegExp('Участник ' + id + ',') }));
    await user.click(screen.getByRole('button', { name: 'Болею за' }));
    await screen.findByRole('button', { name: 'Позже' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }
  expect(readPreferences()).toEqual({ supported: [14, 21], prompted: [14, 21], notifications: [] });
  await user.click(screen.getByRole('button', { name: 'Меню' }));
  expect(screen.getByText(/Демонстрационные данные\. Карта/)).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByText(/Демонстрационные данные\. Карта/)).not.toBeInTheDocument();
  expect(readPreferences()).toEqual({ supported: [14, 21], prompted: [14, 21], notifications: [] });
});
it('opens the map and supports a participant across reloads', async () => {
  const user = userEvent.setup();
  const first = show();
  expect(screen.getByRole('heading', { name: 'Гонка Авача 2027' })).toBeVisible();
  expect(screen.getByText('Демонстрационные данные')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Участник 14,/ }));
  const sheet = await screen.findByRole('dialog', { name: 'Участник №14' });
  await user.click(within(sheet).getByRole('button', { name: /Алиса Иванова/ }));
  expect(screen.getByText('Биография участника')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  await user.click(await screen.findByRole('button', { name: 'Позже' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('tab', { name: /Мои/ }));
  expect(screen.getByRole('button', { name: /Участник 14,.*мой участник/ })).toBeVisible();
  first.unmount();
  show();
  expect(screen.getByRole('button', { name: /Участник 14,.*мой участник/ })).toBeVisible();
});

it('switches future and finished stages, opens gallery and returns to live', async () => {
  const user = userEvent.setup();
  show();
  await user.click(screen.getByRole('combobox', { name: 'Этап гонки' }));
  await user.click(screen.getByRole('option', { name: /Этап 4/ }));
  expect(screen.getByRole('heading', { name: 'Этап 4 начнётся' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Смотреть 3 этап live' }));
  expect(screen.getByRole('region', { name: /Карта маршрута/ })).toBeVisible();
  await user.click(screen.getByRole('combobox', { name: 'Этап гонки' }));
  await user.click(screen.getByRole('option', { name: /Этап 2/ }));
  expect(screen.getByRole('heading', { name: 'Этап 2 завершён' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Все.*фото/ }));
  await user.click(screen.getByRole('button', { name: 'Открыть фото 11' }));
  expect(await screen.findByRole('dialog', { name: 'Фото этапа' })).toBeVisible();
  await user.keyboard('{Escape}');
});

it('retains positions when connectivity is lost', async () => {
  show();
  act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByText(/Нет соединения/)).toBeVisible();
  expect(screen.getByRole('button', { name: /Участник 14,/ })).toBeVisible();
  act(() => window.dispatchEvent(new Event('online')));
  expect(screen.queryByText(/Нет соединения/)).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('region', { name: /Карта маршрута/ }), { key: 'ArrowRight' });
});

it('filters disciplines and supports an empty personal list', async () => {
  const user = userEvent.setup(); show({ persist: false });
  await user.click(screen.getByRole('tab', { name: /Мои/ }));
  expect(screen.getByText('Вы пока ни за кого не болеете')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Все участники' }));
  await user.click(screen.getByRole('tab', { name: 'Дисциплина: все' }));
  await user.click(screen.getByRole('radio', { name: 'Нарта, 8 собак' }));
  expect(screen.getByText('Топ-3 по дисциплине')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Участник 14,/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /1. Алексей Вершинин/ }));
  expect(await screen.findByRole('dialog', { name: 'Участник №21' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Свернуть' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('opens clusters, follows checkpoints and reports unavailable navigation', async () => {
  const user = userEvent.setup(); show();
  await user.click(screen.getByRole('button', { name: '+4 — ещё участники на маршруте' }));
  expect(await screen.findByRole('dialog', { name: 'Участники рядом' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Дмитрий Лесной/ }));
  expect(await screen.findByRole('dialog', { name: 'Участник №11' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Старт — КП-1/ }));
  expect(screen.getByText(/Демонстрационные отметки/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Поделиться' }));
  expect(screen.getByText(/Это действие недоступно/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Закрыть сообщение' }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: '+2 — ещё участники на маршруте' }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  for (const name of ['Назад', 'Меню', 'Закрыть', 'Участники', 'Результаты', 'Программа', 'Ещё', 'Карта', 'КП-1', 'КП-2', 'Старт маршрута', 'Финиш маршрута', 'Обновить']) {
    await user.click(screen.getByRole('button', { name }));
  }
  expect(screen.getByText(/Новые координаты с сервера не запрашивались/)).toBeVisible();
});

it('confirms demo notifications once and removes support without repeating the prompt', async () => {
  const user = userEvent.setup(); show({ initialParticipant: 14 });
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  await user.click(await screen.findByRole('button', { name: 'Да, уведомлять' }));
  expect(screen.getByText(/Выбор сохранён только для демонстрации/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Закрыть сообщение' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /Участник 14,/ }));
  await user.click(screen.getByRole('button', { name: 'Вы болеете' }));
  expect(screen.getByText(/1240 болельщиков/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  expect(screen.getByRole('button', { name: 'Вы болеете' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Да, уведомлять' })).not.toBeInTheDocument();
});

it('closes notification prompt with Escape and reports unavailable storage', async () => {
  const user = userEvent.setup();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
  show({ initialPrompt: 14, initialSupported: [14] });
  await screen.findByRole('button', { name: 'Позже' });
  await user.keyboard('{Escape}');
  expect(await screen.findByText(/Не удалось сохранить выбор/)).toBeVisible();
});

it.each(['loading', 'error', 'empty', 'stale', 'offline'] as const)('renders and recovers the %s scenario', async scenario => {
  const user = userEvent.setup(); show({ scenario, persist: false });
  if (scenario === 'loading' || scenario === 'error') {
    await user.click(screen.getByRole('button', { name: scenario === 'loading' ? 'Показать демоданные' : 'Повторить' }));
    expect(screen.getByRole('region', { name: /Карта маршрута/ })).toBeVisible();
  } else if (scenario === 'empty') {
    expect(screen.getAllByText('Положения отсутствуют').length).toBe(2);
    expect(screen.queryByRole('button', { name: /Участник 14,/ })).not.toBeInTheDocument();
  } else if (scenario === 'offline') {
    await user.click(screen.getByRole('button', { name: 'Обновить данные' }));
    expect(screen.getByText(/Нет соединения/)).toBeVisible();
  } else {
    expect(screen.getByText('Обновлено 48 минут назад')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Участник 21,/ }));
    expect(await screen.findByRole('dialog')).toBeVisible();
  }
});

it('supports a fresh participant locally and handles an unknown initial stage', async () => {
  const user = userEvent.setup(); show({ initialStage: 999, initialParticipant: 21, persist: false, initialExpanded: true });
  expect(screen.getByText('Биография участника')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Алексей Вершинин.*Камчатский/ }));
  expect(screen.queryByText('Биография участника')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Болею за' }));
  await user.click(await screen.findByRole('button', { name: 'Позже' }));
});

it('renders finished stage one and handles preview-only media actions', async () => {
  const user = userEvent.setup(); show({ initialStage: 1, initialGalleryExpanded: true });
  expect(screen.getByText('Этап завершён. Подробный отчёт будет опубликован организаторами.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Смотреть видео: Старт' }));
  expect(screen.getByText(/Это действие недоступно/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Закрыть сообщение' }));
  await user.click(screen.getAllByRole('button', { name: 'Результаты' })[0]);
  await user.click(screen.getByRole('button', { name: 'Открыть главное фото' }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Свернуть фото' }));
  expect(screen.queryByRole('button', { name: 'Открыть фото 11' })).not.toBeInTheDocument();
});

it('dismisses the notification card using its close button', async () => {
  const user = userEvent.setup(); show({ initialPrompt: 14, initialSupported: [14] });
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Закрыть' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
