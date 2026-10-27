import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataState } from '../src/components/DataState';
import { DataFreshness } from '../src/components/DataFreshness';

describe('DataState', () => {
  it('announces loading while content is pending', () => {
    render(<DataState status="loading" />);
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем данные');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains an empty result', () => {
    render(<DataState status="empty" />);
    expect(screen.getByText('Пока нет данных')).toBeInTheDocument();
    expect(screen.getByText('Данные появятся после публикации организаторами.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a keyboard-accessible retry after an error', async () => {
    const onRetry = vi.fn();
    render(<DataState status="error" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить данные');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Повторить' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('DataFreshness', () => {
  it('does not show a warning for fresh online data', () => {
    const { container } = render(<DataFreshness onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps cached data context and its update time while offline', async () => {
    const onRetry = vi.fn();
    render(<DataFreshness offline lastUpdated="15 октября, 14:20" onRetry={onRetry} />);
    expect(screen.getByRole('status')).toHaveTextContent('Нет соединения');
    expect(screen.getByText('Показаны сохранённые данные.')).toBeInTheDocument();
    expect(screen.getByText('Обновлено: 15 октября, 14:20')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Координата устарела')).not.toBeInTheDocument();
  });

  it('explains first entry without a connection or cached data', () => {
    render(<DataFreshness offline hasCachedData={false} onRetry={vi.fn()} />);
    expect(screen.getByText('Сохранённых данных нет. Подключитесь к интернету и повторите попытку.')).toBeInTheDocument();
    expect(screen.queryByText(/Обновлено:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Показаны сохранённые данные.')).not.toBeInTheDocument();
  });

  it('shows stale coordinates independently of network connectivity', () => {
    render(<DataFreshness stale lastUpdated="14:20" onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Координата устарела');
    expect(screen.getByText('Последняя подтверждённая точка: 14:20')).toBeInTheDocument();
    expect(screen.queryByText('Нет соединения')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('can show both warnings and handles an unknown update time', () => {
    render(<DataFreshness offline stale onRetry={vi.fn()} />);
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByText('Время последней точки неизвестно.')).toBeInTheDocument();
    expect(screen.queryByText(/Обновлено:/)).not.toBeInTheDocument();
  });
});
