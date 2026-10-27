import { Tappable } from '@vkontakte/vkui';
import './race-kit.css';
const positionLabels = { confirmed: 'позиция подтверждена', estimated: 'позиция расчётная', stale: 'позиция устарела' };
const rings = {
  confirmed: ['039a1.svg', '655cc.svg'], estimated: ['7148f.png', 'c4525.png'], stale: ['a7e46.svg', 'd17ac.svg'],
};
const clocks = { clock: ['79812.svg', 'e3214.svg'], live: ['b2520.svg', '8d565.svg'] };
export interface RaceMapMarkerProps {
  number: string;
  position: keyof typeof positionLabels;
  supported: boolean;
  leader: boolean;
  staleVariant?: keyof typeof clocks;
  onSelect: () => void;
}
export function RaceMapMarker({ number, position, supported, leader, staleVariant = 'clock', onSelect }: RaceMapMarkerProps) {
  const variant = Number(supported);
  const size = supported ? 44 : 36;
  return <Tappable Component="button" className="race-map-marker" data-supported={supported} data-position={position}
    aria-label={`Участник ${number}, ${positionLabels[position]}${supported ? ', мой участник' : ''}${leader ? ', лидер' : ''}`}
    onClick={onSelect}>
    <img className="race-map-marker__ring" src={`/figma/276-5012/${rings[position][variant]}`} width={size} height={size} alt="" />
    {position === 'estimated' && <img className="race-map-marker__inset" src={`/figma/276-5012/${supported ? 'da58a.png' : 'cd996.png'}`} width={size - 4} height={size - 4} alt="" />}
    <span className="race-map-marker__number">{number}</span>
    {leader && position !== 'stale' && <img className="race-map-marker__badge" src="/figma/276-5012/34c07.svg" width={24} height={24} alt="" />}
    {position === 'stale' && <img className="race-map-marker__badge" src={`/figma/276-5012/${clocks[staleVariant][variant]}`} width={24} height={24} alt="" />}
  </Tappable>;
}
