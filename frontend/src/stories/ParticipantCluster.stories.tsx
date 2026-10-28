import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ParticipantCluster } from '../components/ParticipantCluster';
const meta = { parameters: { figma: {"nodeId": "278:5118", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 278:5118. Контур +4 размером 28 × 28 выгружен из Map points. Число динамическое; Gotham Pro не установлен. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты созданные в этом документе/Participant cluster', component: ParticipantCluster, args: { count: 4, onSelect: fn() } } satisfies Meta<typeof ParticipantCluster>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Four: Story = { name: 'Ещё 4 участника', args: {  } };
