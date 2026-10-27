import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';
import { ParticipantBanner } from '../src/components/ParticipantBanner';

const identity = { name: 'Алиса Иванова', region: 'Камчатский край', discipline: 'Ездовые лайки | 12 собак' };

describe('ParticipantBanner', () => {
  it('shows identity and opens participant details by pointer and keyboard', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<AppProviders><ParticipantBanner {...identity} onOpen={onOpen} /></AppProviders>);
    expect(screen.getByText(identity.region)).toBeVisible();
    expect(screen.getByText(identity.discipline)).toBeVisible();
    const button = screen.getByRole('button', { name: /Алиса Иванова/ });
    expect(screen.getByRole('img', { name: 'Фото отсутствует' })).toBeVisible();
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('accepts a photo and blocks opening when disabled', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<AppProviders><ParticipantBanner {...identity} photoUrl="/participant-placeholder.svg" disabled onOpen={onOpen} /></AppProviders>);
    expect(screen.getByRole('img', { name: identity.name })).toHaveAttribute('src', '/participant-placeholder.svg');
    const button = screen.getByRole('button', { name: /Алиса Иванова/ });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
