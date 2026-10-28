import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { NotificationPreferences, type NotificationPreferencesProps } from '../components/NotificationPreferences';
const meta = { tags: ['figma-unverified'], title: 'Компоненты из VKUI/Дополнительные компоненты/NotificationPreferences', component: NotificationPreferences,
  args: { push: true, vk: false, onPushChange: fn(), onVkChange: fn() },
  render: function Render(args) {
    const [, update] = useArgs<NotificationPreferencesProps>();
    return <NotificationPreferences {...args} onPushChange={(push) => { args.onPushChange(push); update({ push }); }} onVkChange={(vk) => { args.onVkChange(vk); update({ vk }); }} />;
  },
  parameters: { figma: { nodeId: '339:7952', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 339:7952. Строки переключателей 296 × 54; второй узел 339:7953. Пока существующая композиция двух каналов. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof NotificationPreferences>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Каналы уведомлений' };
export const AllEnabled: Story = { name: 'Оба включены', args: { vk: true } };
export const Disabled: Story = { name: 'Недоступны', args: { disabled: true } };
