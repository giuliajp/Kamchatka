import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ParticipantGap } from '../src/components/ParticipantGap';
it('shows supplied gap and its meaning as a separate participant detail', () => {
 render(<AppProviders><ParticipantGap gap="+03:42" /></AppProviders>);
 expect(screen.getByText('+03:42')).toBeVisible();
 expect(screen.getByText('от лидера')).toBeVisible();
 expect(screen.queryByText(/место/)).not.toBeInTheDocument();
});
