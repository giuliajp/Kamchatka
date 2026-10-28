import type { Preview } from '@storybook/react-vite';
import { TextScale } from './TextScale';
import { AppProviders } from '../src/app/AppProviders';

const preview: Preview = {
  tags: ['autodocs'],
  globalTypes: {
    textScale: { description: 'Увеличение только текста (Canvas)', toolbar: { title: 'Текст', icon: 'paragraph', items: [{ value: 1, title: 'Текст 100%' }, { value: 2, title: 'Текст 200%' }] } },
    appearance: {
      description: 'Цветовая схема',
      toolbar: { title: 'Тема', icon: 'paintbrush', dynamicTitle: true, items: [
        { value: 'light', title: 'Светлая' }, { value: 'dark', title: 'Тёмная' },
      ] },
    },
    platform: {
      description: 'Платформа VKUI',
      toolbar: { title: 'Платформа', icon: 'mobile', dynamicTitle: true, items: [
        { value: 'android', title: 'Android' }, { value: 'ios', title: 'iOS' }, { value: 'vkcom', title: 'VK Web' },
      ] },
    },
  },
  initialGlobals: {
    textScale: 1, appearance: 'light', platform: 'android', viewport: { value: 'mobile390', isRotated: false },
  },
  decorators: [(Story, { globals, viewMode, parameters }) => (
    <AppProviders fullScreen={parameters.fullScreen} appearance={globals.appearance} platform={globals.platform}>
      <div style={{ padding: parameters.canvasPadding ?? 16, minHeight: 120, boxSizing: 'border-box' }}><div style={{ width: parameters.fixtureWidth, maxWidth: '100%' }}><Story /></div></div>
      {viewMode === 'story' && <TextScale scale={Number(globals.textScale)} />}
    </AppProviders>
  )],
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    controls: { expanded: true },
    a11y: { test: 'error' },
    options: { storySort: { order: ['Компоненты из VKUI', ['Panel header', 'Select', 'List item', 'Dropdown menu', 'Tabs', 'tab dropdown', 'Banner', 'Buttons', 'IconButton', 'Переключатели', 'Текстовые действия', 'Дополнительные компоненты', 'Справочник'], 'Компоненты созданные в этом документе', ['Tabbar', 'Tab Bar Item', 'Header Panel', 'Top 3 card', 'position', 'Time badge', 'Map points', 'КП', 'start_finish_point', 'Participant cluster', 'legend', 'Participant bottom sheet', 'Modal card', 'Event card', 'Icons', 'Дополнительные компоненты']] } },
    viewport: { options: {
      mobile360: { name: 'Мобильный · 360', styles: { width: '360px', height: '800px' }, type: 'mobile' },
      mobile390: { name: 'Мобильный · 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      tablet: { name: 'Планшет · 768', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
      desktop: { name: 'Desktop · 1280', styles: { width: '1280px', height: '900px' }, type: 'desktop' },
    } },
  },
};
export default preview;
