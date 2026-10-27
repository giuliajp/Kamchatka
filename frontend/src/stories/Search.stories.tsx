import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Search } from '@vkontakte/vkui';
const meta = { title: 'Компоненты из VKUI/Дополнительные компоненты/Search', component: Search } satisfies Meta<typeof Search>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SearchField: Story = {
  name: 'Поиск и очистка',
  render: function Render() {
    const [value, setValue] = useState('Александра');
    return <Search value={value} onChange={(e) => setValue(e.target.value)} clearLabel="Очистить поиск" slotProps={{ input: { 'aria-label': 'Поиск участника' } }} />;
  },
};
export const DisabledSearch: Story = {
  name: 'Поиск недоступен',
  render: () => <Search disabled slotProps={{ input: { 'aria-label': 'Поиск участника' } }} />,
};
