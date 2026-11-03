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
export const InvalidApi: Story = {
  name: 'Некорректный ответ API',
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }));
    return () => { globalThis.fetch = original; };
  },
};
export const NetworkError: Story = {
  name: 'Ошибка сети',
  beforeEach: () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    return () => { globalThis.fetch = original; };
  },
};
export const Offline: Story = {
  name: 'Офлайн с кэшем или без него',
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    return () => {
      if (descriptor) Object.defineProperty(navigator, 'onLine', descriptor);
      else Reflect.deleteProperty(navigator, 'onLine');
    };
  },
};
