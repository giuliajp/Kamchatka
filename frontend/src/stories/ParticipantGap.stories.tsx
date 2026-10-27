import type { Meta, StoryObj } from '@storybook/react-vite';
import { ParticipantGap } from '../components/ParticipantGap';
const meta = { parameters: { figma: {"nodeId": "167:2831", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 167:2831. Отставание: 104 × 62, фон #F6F7FB, radius 8, padding 12, gap 2. Gotham Pro Regular/Bold 14/18 отсутствует. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты созданные в этом документе/Participant bottom sheet/participant details', component: ParticipantGap, args: { gap: '+03:42' } } satisfies Meta<typeof ParticipantGap>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Отставание от лидера', args: {  } };
