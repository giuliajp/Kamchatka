import { Tappable, Text } from '@vkontakte/vkui';
import './race-kit.css';
export interface EventCardProps {
  title: string;
  category: string;
  categoryIconUrl?: string;
  time: string;
  location: string;
  live: boolean;
  photoUrl?: string;
  onOpen: () => void;
}
export function EventCard({ title, category, categoryIconUrl, time, location, live, photoUrl, onOpen }: EventCardProps) {
  return <Tappable Component="button" className="race-event" onClick={onOpen}>
    <span className="race-event__time">{time}</span>
    <div className="race-event__content">
      <div className="race-event__tags">
        <span className="race-event__category">{categoryIconUrl && <img src={categoryIconUrl} width={20} height={20} alt="" />}{category}</span>{' '}
        {live && <span className="race-event__live">Идёт сейчас</span>}
      </div>
      <div className="race-event__text"><Text weight="2">{title}</Text>{' '}<Text className="race-event__location">{location}</Text></div>
      {photoUrl && <div className="race-event__crop"><img className="race-event__image" src={photoUrl} alt={title} /></div>}
    </div>
  </Tappable>;
}
