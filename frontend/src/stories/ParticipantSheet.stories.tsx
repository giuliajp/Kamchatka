import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ParticipantSheet } from '../components/ParticipantSheet';
import { installStoryApi, positions } from './fixtures';
const meta = { title: 'Компоненты созданные в этом документе/Participant bottom sheet', component: ParticipantSheet,
  beforeEach: installStoryApi,
  args: { participantId: 501, entryId: 9001, threshold: 45, position: positions.participants[0], onClose: fn() },
} satisfies Meta<typeof ParticipantSheet>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Карточка с показателями GPS' };
export const NoPosition: Story = { name: 'Без GPS', args: { position: undefined } };
