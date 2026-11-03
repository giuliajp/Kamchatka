import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { RaceTabbar } from '../src/components/RaceTabbar';
it('retains the explicit destination subset for embedded consumers', () => {
  render(<AppProviders><RaceTabbar value="map" onChange={vi.fn()} available={['map', 'participants']} /></AppProviders>);
  expect(screen.queryByRole('button', { name: 'Результаты' })).not.toBeInTheDocument(); expect(screen.getAllByRole('button')).toHaveLength(2);
});
