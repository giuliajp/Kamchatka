import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InfoCard } from '../src/components/InfoCard';
import { ParticipantCard } from '../src/components/ParticipantCard';

describe('InfoCard', () => {
  it('exposes a named article with its title and content', () => {
    render(<InfoCard title="До старта">Программа будет опубликована позже.</InfoCard>);
    const article = screen.getByRole('article', { name: 'До старта' });
    expect(within(article).getByRole('heading', { name: 'До старта' })).toBeInTheDocument();
    expect(within(article).getByText('Программа будет опубликована позже.')).toBeInTheDocument();
  });
});

const participant = {
  name: 'Александра Константинопольская', number: 12, region: 'Камчатский край',
  discipline: 'Упряжки, 8–12 собак', supported: false, onSupportToggle: vi.fn(),
};

describe('ParticipantCard', () => {
  it('shows participant details and a fallback without a photo', async () => {
    render(<ParticipantCard {...participant} />);
    const article = screen.getByRole('article', { name: participant.name });
    expect(within(article).getByRole('heading', { name: participant.name })).toBeInTheDocument();
    expect(within(article).getByText('№ 12')).toBeInTheDocument();
    expect(within(article).getByText(participant.region)).toBeInTheDocument();
    expect(within(article).getByText(participant.discipline)).toBeInTheDocument();
    expect(screen.getByLabelText('Фото отсутствует')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Болею за' }));
    expect(participant.onSupportToggle).toHaveBeenCalledTimes(1);
  });

  it('renders a row with a supplied photo and selected support', () => {
    render(<ParticipantCard {...participant} variant="row" photoUrl="/participant.svg" supported />);
    expect(screen.getByRole('img', { name: participant.name })).toHaveAttribute('src', '/participant.svg');
    expect(screen.getByRole('article')).toHaveAttribute('data-variant', 'row');
    expect(screen.getByRole('button', { name: 'Вы болеете' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back when a supplied photo cannot load', () => {
    render(<ParticipantCard {...participant} photoUrl="/missing.jpg" />);
    fireEvent.error(screen.getByRole('img', { name: participant.name }));
    expect(screen.getByLabelText('Фото отсутствует')).toBeInTheDocument();
  });

  it('forwards pending and disabled states to the support action', async () => {
    render(<ParticipantCard {...participant} supportLoading supportDisabled />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(participant.onSupportToggle).not.toHaveBeenCalled();
  });
});
