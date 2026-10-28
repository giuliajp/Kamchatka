import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { EventCard } from '../src/components/EventCard';
it('shows event schedule, live state, location and optional image and opens the event', async () => {
  const user = userEvent.setup(); const onOpen = vi.fn();
  render(<AppProviders><EventCard title="Старт этапа 3" category="Гонка" time="08:00 — 09:00" location="Эссо · Стартовая площадка" live photoUrl="/participant-placeholder.svg" onOpen={onOpen} /></AppProviders>);
  expect(screen.getByRole('button')).toHaveAccessibleName(/08:00 — 09:00.*Старт этапа 3/);
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  expect(screen.getByText('08:00 — 09:00')).toBeVisible();
  expect(screen.getByText('Гонка')).toBeVisible();
  expect(screen.getByText('Идёт сейчас')).toBeVisible();
  expect(screen.getByText('Эссо · Стартовая площадка')).toBeVisible();
  expect(screen.getByRole('img', { name: 'Старт этапа 3' })).toBeVisible();
  await user.tab();
  await user.keyboard('{Enter}');
  expect(onOpen).toHaveBeenCalledTimes(1);
});
it('supports an event without image or live badge', () => {
  render(<AppProviders><EventCard title="Награждение" category="Церемония" time="18:00" location="Эссо" live={false} onOpen={vi.fn()} /></AppProviders>);
  expect(screen.getByRole('button', { name: /Награждение/ })).toBeVisible();
  expect(screen.queryByText('Идёт сейчас')).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
it('renders the supplied category asset without adding a duplicate accessible name', () => {
  const { container } = render(<AppProviders><EventCard title="Старт этапа 3" category="Гонка" categoryIconUrl="/figma/352-8418/b5bbd.svg" time="08:00" location="Эссо" live onOpen={vi.fn()} /></AppProviders>);
  const icon = container.querySelector('img[src="/figma/352-8418/b5bbd.svg"]');
  expect(icon).toHaveAttribute('alt', '');
  expect(screen.getByRole('button')).toHaveAccessibleName('08:00 Гонка Идёт сейчас Старт этапа 3 Эссо');
});
