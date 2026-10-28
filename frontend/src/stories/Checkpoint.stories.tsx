import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Checkpoint } from '../components/Checkpoint';
const meta = { parameters: { figma: {"nodeId": "280:5610", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 280:5610. КП-1 38 × 24, КП-2 41 × 24. Отступы 4, радиус 12, border 1. Шрифт Gotham Pro Regular 12/14 отсутствует. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты созданные в этом документе/КП', component: Checkpoint, args: { label: 'КП-1', onSelect: fn() } } satisfies Meta<typeof Checkpoint>;
export default meta;
type Story = StoryObj<typeof meta>;
export const First: Story = { name: 'Property 1=КП 1', args: {  } };
export const Second: Story = { name: 'Property 1=КП 2', args: { label: 'КП-2' } };
