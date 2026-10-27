import type { Meta, StoryObj } from '@storybook/react-vite';
import { Counter } from '@vkontakte/vkui';
const meta = { tags: ['figma-unverified'], title: 'Компоненты созданные в этом документе/Participant bottom sheet/participant_position', component: Counter,
 args: { children: '2 место', mode: 'primary', appearance: 'accent-red' },
 parameters: { figma: { nodeId: '317:17901', status: 'Не проверено' }, docs: { description: { component: "Не проверено. Figma 317:17901. Место участника 81 × 32; подробные свойства недоступны, пока Counter VKUI. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } },
} satisfies Meta<typeof Counter>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Место участника' };
