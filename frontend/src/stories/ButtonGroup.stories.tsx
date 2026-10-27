import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, ButtonGroup } from '@vkontakte/vkui';
import { fn } from 'storybook/test';
const meta = { title: 'Компоненты из VKUI/Buttons/Button Group', component: ButtonGroup,
  tags: ['figma-unverified'], args: { mode: 'horizontal', gap: 'm', stretched: true },
  parameters: { figma: { nodeId: '339:7954', status: 'Не проверено' }, docs: { description: { component: 'Группа как самостоятельный компонент VKUI. Figma 296 × 44, подробные свойства недоступны из-за лимита MCP.' } } },
} satisfies Meta<typeof ButtonGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Позже / Да, уведомлять', render: (args) => <ButtonGroup {...args}><Button stretched mode="secondary" onClick={fn()}>Позже</Button><Button stretched onClick={fn()}>Да, уведомлять</Button></ButtonGroup> };
