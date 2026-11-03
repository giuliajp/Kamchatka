import { Tappable } from '@vkontakte/vkui';
import './race-kit.css';
export interface ParticipantClusterProps { count: number; onSelect?: () => void }
export function ParticipantCluster({ count, onSelect }: ParticipantClusterProps) {
 return <Tappable Component={onSelect ? 'button' : 'span'} role={onSelect ? undefined : 'img'} className="race-participant-cluster" aria-label={`+${count} — ещё участники на маршруте`} onClick={onSelect}>
   <img src="/figma/276-5012/cc3ee.svg" width={28} height={28} alt="" /><span>+{count}</span>
 </Tappable>;
}
