import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vkontakte/vkui';
import { expect, fn, userEvent } from 'storybook/test';

const meta = { tags: ['figma-unverified'],
  title: 'Компоненты из VKUI/Buttons', component: Button,
  args: { children: 'Основное действие', size: 'l', appearance: 'accent', onClick: fn() },
  argTypes: { mode: { control: 'select', options: ['primary', 'secondary', 'tertiary', 'outline', 'link'] } },
  parameters: { figma: { nodeId: '339:7954', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 339:7954. Группа кнопок 296 × 44. Подробные свойства не получены из-за лимита MCP. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { name: 'Основная' };
export const Secondary: Story = { name: 'Вторичная', args: { mode: 'secondary', children: 'Поделиться' } };
export const Disabled: Story = { name: 'Недоступна', args: { disabled: true } };
export const Loading: Story = { name: 'Загрузка', args: { loading: true, loadingLabel: 'Обновляем данные' } };
export const KeyboardFocus: Story = {
  name: 'Клавиатурный фокус',
  play: async ({ canvas }) => { const button = canvas.getByRole('button'); button.focus(); await expect(button).toHaveFocus(); },
};
export const Hover: Story = { name: 'Наведение', play: async ({ canvas }) => { await userEvent.hover(canvas.getByRole('button')); } };
export const Pressed: Story = { name: 'Нажатие', play: async ({ canvas }) => { await userEvent.pointer({ target: canvas.getByRole('button'), keys: '[MouseLeft>]' }); } };
export const Share: Story = { name: 'Поделиться', args: { mode: 'outline', children: 'Поделиться' } };
