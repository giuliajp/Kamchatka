import type { Meta, StoryObj } from '@storybook/react-vite';
import { InfoCard } from '../components/InfoCard';

const meta = {
  title: 'Компоненты созданные в этом документе/Дополнительные компоненты/InfoCard', component: InfoCard,
  args: { title: 'Программа фестиваля', children: 'Пример информационного блока. Содержимое поступит от организаторов.' },
  parameters: { docs: { description: { component: 'Информационная карточка с доступным заголовком. Принимает title и содержимое children.' } } },
} satisfies Meta<typeof InfoCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Информационная карточка' };
