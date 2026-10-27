import { render, screen } from '@testing-library/react';
import { Button } from '@vkontakte/vkui';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '../src/app/AppProviders';

describe('AppProviders', () => {
  it('renders real VKUI controls in the default light Android theme', () => {
    render(<AppProviders><Button>Обновить</Button></AppProviders>);
    const button = screen.getByRole('button', { name: 'Обновить' });
    expect(button.closest('.vkui--vkBase--light')).not.toBeNull();
  });

  it.each([
    ['dark', 'android', 'vkBase'],
    ['light', 'ios', 'vkIOS'],
    ['dark', 'ios', 'vkIOS'],
    ['light', 'vkcom', 'vkCom'],
    ['dark', 'vkcom', 'vkCom'],
  ] as const)('applies %s appearance on %s and updates without remounting', (appearance, platform, theme) => {
    const { rerender } = render(<AppProviders><input aria-label="Имя" defaultValue="Анна" /></AppProviders>);
    const input = screen.getByRole('textbox', { name: 'Имя' });
    rerender(<AppProviders appearance={appearance} platform={platform}><input aria-label="Имя" defaultValue="Анна" /></AppProviders>);
    expect(screen.getByRole('textbox', { name: 'Имя' })).toBe(input);
    expect(input).toHaveValue('Анна');
    expect(input.closest(`.vkui--${theme}--${appearance}`)).not.toBeNull();
  });
});
