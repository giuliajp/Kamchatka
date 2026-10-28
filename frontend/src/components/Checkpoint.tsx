import { Tappable } from '@vkontakte/vkui';
import './race-kit.css';
export interface CheckpointProps { label: string; onSelect: () => void }
export function Checkpoint({ label, onSelect }: CheckpointProps) {
  return <Tappable Component="button" className="race-checkpoint" onClick={onSelect}>{label}</Tappable>;
}
