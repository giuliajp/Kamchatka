import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '@vkontakte/vkui';
import { Icon24Add, Icon24MinusOutline, Icon24RefreshOutline, Icon24ShareOutline } from '@vkontakte/icons';
import { fn } from 'storybook/test';
const meta = { parameters: { figma: {"nodeId": "339:7955", "status": "Не проверено"}, docs: { description: { component: "Не проверено. Figma 339:7955. Кнопки 44 × 44; также 339:7956 и 339:7922. Детальные свойства недоступны. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-unverified'], title: 'Компоненты из VKUI/IconButton', component: IconButton,
 args: { label: 'Обновить', onClick: fn(), children: <Icon24RefreshOutline /> },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Refresh: Story = { name: 'Обновить' };
export const ZoomIn: Story = { name: 'Увеличить', args: { label: 'Увеличить', children: <Icon24Add /> } };
export const ZoomOut: Story = { name: 'Уменьшить', args: { label: 'Уменьшить', children: <Icon24MinusOutline /> } };
export const Share: Story = { name: 'Поделиться', args: { label: 'Поделиться', children: <Icon24ShareOutline /> } };
export const Disabled: Story = { name: 'Дополнительно — недоступна', args: { disabled: true } };
