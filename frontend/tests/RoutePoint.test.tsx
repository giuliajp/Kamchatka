import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RoutePoint } from '../src/components/RoutePoint';
it('shows supplied checkpoint details and activates by keyboard', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<AppProviders><RoutePoint index={1} title="Старт — КП-1 — 42 км" time="08:30" status="Пройден" onSelect={onSelect} /></AppProviders>);
  expect(screen.getByText('08:30')).toBeVisible();
  expect(screen.getByText('Пройден')).toBeVisible();
  await user.tab();
  expect(screen.getByRole('button', { name: /Старт — КП-1 — 42 км/ })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledTimes(1);
});
