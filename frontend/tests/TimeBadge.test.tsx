import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { TimeBadge } from '../src/components/TimeBadge';
it.each([
  ['fresh', 'Обновлено 2 минуты назад'], ['stale', 'Обновлено 48 минут назад'],
  ['position', 'Положение на 14:36'], ['unavailable', 'Положение недоступно.'],
  ['offline', 'Нет соединения. Данные на 14:36'],
] as const)('announces %s with the supplied label', (state, text) => {
  render(<AppProviders><TimeBadge state={state}>{text}</TimeBadge></AppProviders>);
  expect(screen.getByRole('status')).toHaveTextContent(text);
});

it('lets the user retry offline data with a named keyboard action', async () => {
  const { default: userEvent } = await import('@testing-library/user-event');
  const { vi } = await import('vitest');
  const user = userEvent.setup();
  const onRetry = vi.fn();
  const { rerender } = render(<AppProviders><TimeBadge state="offline" onRetry={onRetry}>Нет соединения.</TimeBadge></AppProviders>);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Обновить данные' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onRetry).toHaveBeenCalledTimes(1);
  rerender(<AppProviders><TimeBadge state="fresh" onRetry={onRetry}>Обновлено</TimeBadge></AppProviders>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
