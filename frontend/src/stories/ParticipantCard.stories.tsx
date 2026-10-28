import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { ParticipantCard, type ParticipantCardProps } from '../components/ParticipantCard';

const meta = {
  title: 'Компоненты созданные в этом документе/Дополнительные компоненты/ParticipantCard', component: ParticipantCard,
  args: { name: 'Александра Константинопольская', number: 12, region: 'Камчатский край', discipline: 'Упряжки, 8–12 собак', supported: false, onSupportToggle: fn() },
  render: function Render(args) {
    const [, updateArgs] = useArgs<ParticipantCardProps>();
    return <ParticipantCard {...args} onSupportToggle={() => { args.onSupportToggle(); updateArgs({ supported: !args.supported }); }} />;
  },
  parameters: { docs: { description: { component: 'Компактная карточка или строка участника. Фото необязательно; при ошибке загрузки VKUI показывает стандартную иконку. Данные и обработчики поступают через props.' } } },
} satisfies Meta<typeof ParticipantCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Без фотографии' };
export const WithImage: Story = { name: 'С изображением', args: { photoUrl: '/participant-placeholder.svg' } };
export const Row: Story = { name: 'Строка', args: { variant: 'row' } };
export const Supported: Story = { name: 'Поддерживаемый участник', args: { supported: true } };
export const Pending: Story = { name: 'Сохранение поддержки', args: { supportLoading: true } };
export const Disabled: Story = { name: 'Поддержка недоступна', args: { supportDisabled: true } };
export const LongContent: Story = { name: 'Длинные подписи', args: { region: 'Петропавловск-Камчатский городской округ, Камчатский край', discipline: 'Гонка на собачьих упряжках, 8–12 собак, длинная дистанция' } };
