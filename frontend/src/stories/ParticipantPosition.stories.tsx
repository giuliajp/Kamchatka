import type { Meta, StoryObj } from '@storybook/react-vite';
import { ParticipantPosition } from '../components/ParticipantPosition';
const meta = { title: 'Компоненты созданные в этом документе/Дополнительные компоненты/Место и отставание', component: ParticipantPosition, args: { place: 2, gap: '+03:42' } } satisfies Meta<typeof ParticipantPosition>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Место и отставание' };
