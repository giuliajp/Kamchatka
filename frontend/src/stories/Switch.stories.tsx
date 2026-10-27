import type { Meta, StoryObj } from '@storybook/react-vite';
import { SimpleCell, Switch } from '@vkontakte/vkui';
import { fn } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
const meta = { title: 'Компоненты из VKUI/Переключатели/Switch', component: Switch,
  tags: ['figma-unverified'],
  args: { 'aria-label': 'Push-уведомления', checked: false, onChange: fn() },
  render: function Render(args) {
    const [, update] = useArgs();
    return <SimpleCell Component="div" after={<Switch {...args} onChange={(event) => { args.onChange?.(event); update({ checked: event.target.checked }); }} />}>{args['aria-label']}</SimpleCell>;
  },
  parameters: { figma: { nodeId: '339:7952', status: 'Не проверено' }, docs: { description: { component: 'Каждая строка отдельно. Figma 339:7952 / 339:7953: 296 × 54. Точные свойства ограничены лимитом MCP. Настоящий Switch VKUI, никакие разрешения и подписки не подключаются.' } } },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PushOff: Story = { name: 'Push — выключено' };
export const PushOn: Story = { name: 'Push — включено', args: { checked: true } };
export const VkOff: Story = { name: 'VK — выключено', args: { 'aria-label': 'Уведомления VK' } };
export const VkOn: Story = { name: 'VK — включено', args: { 'aria-label': 'Уведомления VK', checked: true } };
export const Disabled: Story = { name: 'Дополнительно — недоступно', args: { disabled: true } };
