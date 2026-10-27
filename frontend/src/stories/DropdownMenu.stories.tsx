import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CustomSelect } from '@vkontakte/vkui';
import { userEvent } from 'storybook/test';
import { OpenSelect } from './RaceStageSelect.stories';
const meta = { parameters: { figma: {"nodeId": "339:7877", "status": "Расхождение"}, docs: { description: { component: "Расхождение. Figma 339:7877. Меню этапов 328 × 392; дисциплин 339:7919 — 171 × 172. Используется настоящее меню VKUI; точная типографика не совпадает. Полный аудит: docs/UI_KIT_FIGMA_AUDIT.md." } } }, tags: ['figma-mismatch'], title: 'Компоненты из VKUI/Dropdown menu' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const Stages = { ...OpenSelect, render: OpenSelect.render, name: 'Этапы', parameters: { docs: { description: { story: 'Меню этапов открывается настоящим Select. Внешний вид ещё не подтверждён.' } } } };
export const Disciplines: Story = {
  name: 'Dropdown Menu — дисциплины',
  render: function Render() {
    const [value, setValue] = useState('all');
    return <CustomSelect value={value} onChange={(event) => setValue(event.target.value)}
      options={[{ value: 'all', label: 'Все' }, { value: 'sled8', label: 'Нарта, 8 собак' }, { value: 'sled8plus', label: 'Нарта, 8+ собак' }, { value: 'ski2', label: 'Лыжи, 2 собаки' }]}
      slotProps={{ input: { 'aria-label': 'Дисциплина' } }} />;
  },
  play: async ({ canvas }) => { await userEvent.click(canvas.getByRole('combobox', { name: 'Дисциплина' })); },
};
