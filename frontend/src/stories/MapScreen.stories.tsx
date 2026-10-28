import type { Meta, StoryObj } from '@storybook/react-vite';
import { MapScreen } from '../screens/Map/MapScreen';
const meta = {
  title: 'Экраны/Карта Авача', component: MapScreen,
  parameters: { fullScreen: true, canvasPadding: 0, figma: { nodeId: '339:7523' }, docs: { description: { component: 'Интерактивная демонстрация всего раздела карты. Данные тестовые, API и VK не подключены. Время — Камчатка, UTC+12. Тема и шрифты из Storybook; изображения из Figma.' } } },
  args: { persist: false },
} satisfies Meta<typeof MapScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Live: Story = { name: 'Карта — все дисциплины' };
export const Discipline: Story = { name: 'Дисциплина и топ-3', args: { initialDiscipline: '1' } };
export const Mine: Story = { name: 'Мои участники', args: { initialTab: 'mine', initialSupported: [14, 21] } };
export const MineEmpty: Story = { name: 'Мои — пусто', args: { initialTab: 'mine' } };
export const Participant: Story = { name: 'Шторка участника', args: { initialParticipant: 14 } };
export const Biography: Story = { name: 'Биография', args: { initialParticipant: 14, initialExpanded: true } };
export const Supported: Story = { name: 'Вы болеете', args: { initialParticipant: 14, initialSupported: [14] } };
export const Notifications: Story = { name: 'Диалог уведомлений', args: { initialPrompt: 14, initialSupported: [14] } };
export const Upcoming: Story = { name: 'Этап не начался', args: { initialStage: 4 } };
export const Finished: Story = { name: 'Этап завершён', args: { initialStage: 2 } };
export const Gallery: Story = { name: 'Галерея раскрыта', args: { initialStage: 2, initialGalleryExpanded: true } };
export const Loading: Story = { name: 'Загрузка', args: { scenario: 'loading' } };
export const Error: Story = { name: 'Ошибка и повтор', args: { scenario: 'error' } };
export const NoPositions: Story = { name: 'Нет координат', args: { scenario: 'empty' } };
export const Stale: Story = { name: 'Устаревшие координаты', args: { scenario: 'stale' } };
export const Offline: Story = { name: 'Нет соединения', args: { scenario: 'offline' } };
