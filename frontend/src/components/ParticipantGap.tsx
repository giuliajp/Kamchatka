import { Text } from '@vkontakte/vkui';
import './race-kit.css';
export interface ParticipantGapProps { gap: string }
export function ParticipantGap({ gap }: ParticipantGapProps) {
  return <div className="race-participant-gap"><Text weight="1">{gap}</Text><Text className="race-secondary">от лидера</Text></div>;
}
