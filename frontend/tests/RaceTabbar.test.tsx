import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RaceTabbar } from '../src/components/RaceTabbar';

it('exposes five destinations and reports each selected destination without mutating controlled state', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const { rerender } = render(<AppProviders><RaceTabbar value="map" onChange={onChange} /></AppProviders>);
  const labels = ['Карта', 'Участники', 'Результаты', 'Программа', 'Ещё'];
  const values = ['map', 'participants', 'results', 'program', 'more'];
  expect(screen.getByRole('navigation', { name: 'Разделы гонки' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Карта' })).toHaveAttribute('aria-current', 'page');
  for (const [index, label] of labels.entries()) {
    await user.click(screen.getByRole('button', { name: label }));
    expect(onChange).toHaveBeenLastCalledWith(values[index]);
  }
  rerender(<AppProviders><RaceTabbar value="more" onChange={onChange} /></AppProviders>);
  expect(screen.getByRole('button', { name: 'Ещё' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Карта' })).not.toHaveAttribute('aria-current');
});
it('supports sequential keyboard focus and activation', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<AppProviders><RaceTabbar value="map" onChange={onChange} /></AppProviders>);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Карта' })).toHaveFocus();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(onChange).toHaveBeenCalledExactlyOnceWith('participants');
});
