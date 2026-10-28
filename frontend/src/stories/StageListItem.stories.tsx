import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StageListItem } from '../components/StageListItem';
const meta = { parameters: { fixtureWidth: 328, canvasPadding: 16, figma: {"nodeId": "339:7880", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 339:7880. 328 × 48, отступы 12/16. Шрифт Gotham Pro отсутствует; остальные состояния 339:7879, 339:7878 доступны только в общей структуре. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты из VKUI/List item', component: StageListItem,
  args: { label: 'Этап 2,', details: '08.02 09:00 - 18:00, завершен', onClick: fn() },
  decorators: [(Story) => <div role="listbox" aria-label="Этапы"><Story /></div>],
} satisfies Meta<typeof StageListItem>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Completed: Story = { name: 'Завершён' };
export const Current: Story = { name: 'Продолжается', args: { label: 'Этап 3,', details: '09.02 09:00 - продолжается', selected: true } };
export const Future: Story = { name: 'Будущий — доступен', args: { label: 'Этап 4,', details: 'начнётся 10.02 09:00', upcoming: true } };
export const Multiline: Story = { name: 'Две строки', args: { label: 'Этап 1,', details: '07.02 09:00 - 08.02 00:00, завершен' }, decorators: [(Story) => <div style={{ maxWidth: 328 }}><Story /></div>] };
