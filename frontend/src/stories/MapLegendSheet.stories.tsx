import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MapLegend } from '../components/MapLegend';

const meta = {
  title: 'Компоненты созданные в этом документе/Легенда карты',
  component: MapLegend,
  args: { open: true, onClose: fn() },
} satisfies Meta<typeof MapLegend>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Standalone: Story = {};
