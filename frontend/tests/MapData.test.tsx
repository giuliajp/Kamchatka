import { act, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Countdown, StageContent } from '../src/screens/Map/StageContent';
import { TopParticipantsCard } from '../src/components/TopParticipantsCard';
import { AppProviders } from '../src/app/AppProviders';
import { stage } from './fixtures';
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it('keeps media off the finished-stage map even when demo features are enabled', () => {
  vi.stubEnv('VITE_MOCK_MISSING_FEATURES', 'true');
  render(<AppProviders><StageContent stage={{ ...stage, status: 'finished' }} onStage={vi.fn()} onResults={vi.fn()} /></AppProviders>);
  expect(screen.getByRole('button', { name: 'Результаты этапа' })).toBeVisible();
  expect(screen.queryByText(/Демонстрационные материалы/)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Фото .* этапа/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Смотреть видео/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Открыть .*фото/ })).not.toBeInTheDocument();
});
it('counts from the actual clock and never changes stage status at zero', () => {
  vi.useFakeTimers(); vi.setSystemTime('2026-10-27T00:00:00Z');
  const { unmount } = render(<Countdown startAt="2026-10-27T00:00:02Z" />);
  expect(within(screen.getByRole('timer')).getByText('02')).toBeVisible();
  act(() => vi.advanceTimersByTime(3000));
  expect(within(screen.getByRole('timer')).getAllByText('00')).toHaveLength(4);
  expect(screen.getByText('Ожидаем подтверждение старта организаторами.')).toBeVisible(); unmount(); expect(vi.getTimerCount()).toBe(0);
});
it('renders planned, cancelled and finished stages with real dates and actions', () => {
  const onStage = vi.fn(); const onResults = vi.fn();
  const { rerender } = render(<AppProviders><StageContent stage={{ ...stage, status: 'planned' }} liveStage={stage} onStage={onStage} onResults={onResults} /></AppProviders>);
  screen.getByRole('button', { name: 'Смотреть 3 этап live' }).click(); expect(onStage).toHaveBeenCalledWith(103);
  rerender(<AppProviders><StageContent stage={{ ...stage, start_at: null, status: 'planned' }} onStage={onStage} onResults={onResults} /></AppProviders>);
  expect(screen.getByText('Дата старта пока не объявлена')).toBeVisible();
  rerender(<AppProviders><StageContent stage={{ ...stage, status: 'finished', finish_at: '2026-10-27T05:00:00Z' }} onStage={onStage} onResults={onResults} /></AppProviders>);
  screen.getByRole('button', { name: 'Результаты этапа' }).click(); expect(onResults).toHaveBeenCalledOnce(); expect(screen.getByText('27.10 17:00')).toBeVisible();
  rerender(<AppProviders><StageContent stage={{ ...stage, start_at: null, status: 'finished' }} onStage={onStage} onResults={onResults} /></AppProviders>);
  expect(screen.queryByText('Старт', { selector: 'dt' })).not.toBeInTheDocument(); expect(screen.queryByText('Финиш', { selector: 'dt' })).not.toBeInTheDocument();
  rerender(<AppProviders><StageContent stage={{ ...stage, status: 'finished' }} onStage={onStage} onResults={onResults} /></AppProviders>);
  expect(screen.getByText('Старт', { selector: 'dt' })).toBeVisible(); expect(screen.queryByText('Финиш', { selector: 'dt' })).not.toBeInTheDocument();
  rerender(<AppProviders><StageContent stage={{ ...stage, start_at: null, finish_at: '2026-10-27T05:00:00Z', status: 'finished' }} onStage={onStage} onResults={onResults} /></AppProviders>);
  expect(screen.queryByText('Старт', { selector: 'dt' })).not.toBeInTheDocument(); expect(screen.getByText('Финиш', { selector: 'dt' })).toBeVisible();
  rerender(<AppProviders><StageContent stage={{ ...stage, status: 'cancelled' }} onStage={onStage} onResults={onResults} /></AppProviders>);
  expect(screen.getByRole('heading', { name: 'Этап 3 отменён' })).toBeVisible(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('retains compact leaders empty and timed states', () => {
  const onSelect = vi.fn();
  const { rerender } = render(<AppProviders><TopParticipantsCard compact title="Лидеры" entries={[]} onSelect={onSelect} /></AppProviders>);
  expect(screen.getByText('Результатов пока нет')).toBeVisible();
  rerender(<AppProviders><TopParticipantsCard compact title="Лидеры" entries={[{ id: '1', number: '14', label: 'Алиса', time: '02:45', place: 1 }]} onSelect={onSelect} /></AppProviders>);
  screen.getByRole('button').click(); expect(onSelect).toHaveBeenCalledWith('1');
});
