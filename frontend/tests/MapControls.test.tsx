import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { MapControls } from '../src/components/MapControls';
it('calls independent zoom and refresh actions', async () => {
  const user = userEvent.setup(); const onZoomIn = vi.fn(); const onZoomOut = vi.fn(); const onRefresh = vi.fn();
  render(<AppProviders><MapControls canZoomIn canZoomOut refreshing={false} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onRefresh={onRefresh} /></AppProviders>);
  await user.click(screen.getByRole('button', { name: 'Увеличить масштаб' }));
  expect(onZoomIn).toHaveBeenCalledTimes(1); expect(onZoomOut).not.toHaveBeenCalled(); expect(onRefresh).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Уменьшить масштаб' }));
  await user.click(screen.getByRole('button', { name: 'Обновить' }));
  expect(onZoomOut).toHaveBeenCalledTimes(1); expect(onRefresh).toHaveBeenCalledTimes(1);
});
it('blocks actions at zoom limits and during refresh', async () => {
  const user = userEvent.setup(); const callback = vi.fn();
  render(<AppProviders><MapControls canZoomIn={false} canZoomOut={false} refreshing onZoomIn={callback} onZoomOut={callback} onRefresh={callback} /></AppProviders>);
  for (const button of screen.getAllByRole('button')) { expect(button).toBeDisabled(); await user.click(button); }
  expect(screen.getByRole('button', { name: 'Обновить' })).toHaveAttribute('aria-busy', 'true');
  expect(callback).not.toHaveBeenCalled();
});
