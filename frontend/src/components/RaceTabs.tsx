import { useState } from 'react';
import { Counter, Popover, Radio, RadioGroup, Tabs, TabsItem } from '@vkontakte/vkui';
import { Icon16Dropdown } from '@vkontakte/icons';

export interface RaceTabsProps {
  tab: 'all' | 'mine';
  discipline: string;
  options: { value: string; label: string }[];
  mineCount: number;
  onTabChange: (tab: 'all' | 'mine') => void;
  onDisciplineChange: (value: string) => void;
}

export function RaceTabs({ tab, discipline, options, mineCount, onTabChange, onDisciplineChange }: RaceTabsProps) {
  const [shown, setShown] = useState(false);
  const selected = options.find((option) => option.value === discipline);
  return (
    <Tabs mode="secondary" aria-label="Фильтр участников">
      <Popover aria-label="Выбор дисциплины" trigger="click" shown={shown} onShownChange={setShown} placement="bottom-start" restoreFocus autoFocus
        content={(
          <div>
            <RadioGroup aria-label="Дисциплина">
              {options.map((option) => (
                <Radio key={option.value} name="discipline" readOnly value={option.value} checked={option.value === discipline}
                  onClick={() => { onTabChange('all'); onDisciplineChange(option.value); setShown(false); }}>
                  {option.label}
                </Radio>
              ))}
            </RadioGroup>
          </div>
        )}>
        <TabsItem selected={tab === 'all'} aria-haspopup="dialog" aria-expanded={shown} after={<Icon16Dropdown />}>
          {selected ? `Дисциплина: ${selected.label}` : 'Дисциплина'}
        </TabsItem>
      </Popover>
      <TabsItem selected={tab === 'mine'} onClick={() => onTabChange('mine')}
        status={mineCount > 0 ? <Counter size="s" mode="primary" appearance="accent-red">{mineCount}</Counter> : undefined}>
        Мои
      </TabsItem>
    </Tabs>
  );
}
