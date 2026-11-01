import type { Meta, StoryObj } from '@storybook/react-vite';
import { MapScreen } from '../screens/Map/MapScreen';
import { installStoryApi } from './fixtures';
const meta = { title: 'Экраны/Карта Авача', component: MapScreen,
  beforeEach: installStoryApi,
  parameters: { fullScreen: true, canvasPadding: 0, figma: { nodeId: '339:7524' }, docs: { description: { component: 'Карта, участники и результаты. Только в Storybook запросы заменены тестовыми ответами API.' } } },
} satisfies Meta<typeof MapScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Live: Story = { name: 'Карта и навигация' };
