import { Tabbar, TabbarItem } from '@vkontakte/vkui';
import { Icon28PlaceOutline, Icon28UsersOutline, Icon28CupOutline, Icon28CalendarOutline, Icon28MenuOutline } from '@vkontakte/icons';
import './race-kit.css';

const destinations = [
  { value: 'map', label: 'Карта', Icon: Icon28PlaceOutline },
  { value: 'participants', label: 'Участники', Icon: Icon28UsersOutline },
  { value: 'results', label: 'Результаты', Icon: Icon28CupOutline },
  { value: 'program', label: 'Программа', Icon: Icon28CalendarOutline },
  { value: 'more', label: 'Ещё', Icon: Icon28MenuOutline },
] as const;
export type RaceDestination = typeof destinations[number]['value'];
export interface RaceTabbarProps { value: RaceDestination; onChange: (value: RaceDestination) => void }

export function RaceTabbar({ value, onChange }: RaceTabbarProps) {
  return (
    <nav aria-label="Разделы гонки">
      <Tabbar className="race-tabbar" mode="vertical">
        {destinations.map(({ value: destination, label, Icon }) => (
          <TabbarItem key={destination} label={label} selected={value === destination}
            aria-current={value === destination ? 'page' : undefined} onClick={() => onChange(destination)}>
            <Icon />
          </TabbarItem>
        ))}
      </Tabbar>
    </nav>
  );
}
