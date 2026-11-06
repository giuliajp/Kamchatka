import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@vkontakte/vkui';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { NotificationPrompt, type NotificationPromptProps } from '../components/NotificationPrompt';
const meta = { tags: ['figma-unverified'], title: 'Компоненты созданные в этом документе/Modal card', component: NotificationPrompt,
  args: { open: true, number: '14', onConfirm: fn(), onLater: fn(), onClose: fn() },
  render: function Render(args) {
    const [, update] = useArgs<NotificationPromptProps>();
    return <><Button onClick={() => update({ open: true })}>Открыть предложение подписки</Button><NotificationPrompt {...args}
      onConfirm={() => { args.onConfirm(); update({ open: false }); }}
      onLater={() => { args.onLater(); update({ open: false }); }}
      onClose={() => { args.onClose(); update({ open: false }); }} /></>;
  },
  parameters: { fullScreen: true, figma: { nodeId: '317:18332', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 317:18332. Modal Card 328 × 298. Подробные свойства недоступны, используется настоящая ModalCard VKUI. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof NotificationPrompt>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = { name: 'Предложение подписки' };
export const Loading: Story = { name: 'Подтверждение', args: { loading: true } };
export const Closed: Story = { name: 'Закрыт', args: { open: false } };
