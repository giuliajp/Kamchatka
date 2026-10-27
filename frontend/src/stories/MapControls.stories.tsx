import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MapControls } from '../components/MapControls';
const meta = { title: 'Компоненты созданные в этом документе/Дополнительные компоненты/MapControls', component: MapControls,
  args: { canZoomIn: true, canZoomOut: true, refreshing: false, onZoomIn: fn(), onZoomOut: fn(), onRefresh: fn() },
} satisfies Meta<typeof MapControls>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { name: 'Масштаб и обновление' };
export const Loading: Story = { name: 'Обновление', args: { refreshing: true } };
export const Limits: Story = { name: 'Пределы масштаба', args: { canZoomIn: false, canZoomOut: false } };
