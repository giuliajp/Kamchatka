import './race-kit.css';
import { Counter, Flex } from '@vkontakte/vkui';
import { ParticipantGap } from './ParticipantGap';
export interface ParticipantPositionProps { place: number; gap: string }
export function ParticipantPosition({ place, gap }: ParticipantPositionProps) {
  return <Flex align="start" gap="m"><ParticipantGap gap={gap} /><Counter mode="primary" appearance="accent-red">{place} место</Counter></Flex>;
}
