import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from '../src/components/TextField';

describe('TextField', () => {
  it('labels a controlled field and supports input and clearing', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return <TextField label="Имя" value={value} onChange={setValue} description="Как в протоколе" />;
    }
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Имя' });
    expect(input).toHaveAccessibleDescription('Как в протоколе');
    expect(input).not.toBeInvalid();
    await userEvent.type(input, 'Анна');
    expect(input).toHaveValue('Анна');
    await userEvent.clear(input);
    expect(input).toHaveValue('');
  });

  it('announces an error instead of a hint and clears it when corrected', () => {
    const props = { label: 'Имя', value: '', onChange: vi.fn(), description: 'Как в протоколе' };
    const { rerender } = render(<TextField {...props} error="Введите имя" />);
    const input = screen.getByRole('textbox', { name: 'Имя' });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('Введите имя');
    expect(screen.queryByText('Как в протоколе')).not.toBeInTheDocument();
    rerender(<TextField label="Имя" value="Анна" onChange={props.onChange} />);
    expect(input).not.toBeInvalid();
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('blocks editing when disabled and keeps labels unique', async () => {
    const onChange = vi.fn();
    render(<><TextField label="Первый" value="Анна" disabled onChange={onChange} /><TextField label="Второй" value="" onChange={onChange} /></>);
    const first = screen.getByRole('textbox', { name: 'Первый' });
    const second = screen.getByRole('textbox', { name: 'Второй' });
    expect(first).toBeDisabled();
    expect(first.id).not.toBe(second.id);
    await userEvent.type(first, 'Изменение');
    expect(first).toHaveValue('Анна');
    expect(onChange).not.toHaveBeenCalled();
  });
});
