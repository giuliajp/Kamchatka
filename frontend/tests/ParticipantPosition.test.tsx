import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ParticipantPosition } from '../src/components/ParticipantPosition';
it('shows the supplied standing and gap without calculating race results', () => {
  render(<AppProviders><ParticipantPosition place={2} gap="+03:42" /></AppProviders>);
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  expect(screen.getByText('2 место')).toBeVisible();
  expect(screen.getByText('+03:42')).toBeVisible();
  expect(screen.getByText('от лидера')).toBeVisible();
});
