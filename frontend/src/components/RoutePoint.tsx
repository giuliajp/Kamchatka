import './race-kit.css';
import { Counter, Tappable } from '@vkontakte/vkui';
export interface RoutePointProps {
  index: number;
  title: string;
  time: string;
  status: string;
  onSelect: () => void;
}
export function RoutePoint({ index, title, time, status, onSelect }: RoutePointProps) {
  return <Tappable Component="button" className="race-route-point" onClick={onSelect}>
    <Counter className="race-route-point__index" size="s">{index}</Counter>
    <span className="race-route-point__content"><span className="race-route-point__title">{title}</span><span className="race-route-point__time">{time}</span></span>
    <span className="race-route-point__status">{status}</span>
  </Tappable>;
}
