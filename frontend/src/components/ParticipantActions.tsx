import { useState } from 'react';
import { IconButton } from '@vkontakte/vkui';
import { Icon24NotificationOutline, Icon24NotificationCheckOutline } from '@vkontakte/icons';
import { participationKey, useExtras } from '../mocks/extras';
import { SupportButton } from './SupportButton';
import { NotificationPrompt } from './NotificationPrompt';

export interface ParticipationActionProps { raceId: number; entryId: number; number: number; photoUrl?: string }
export function SupportAction({ raceId, entryId, number, photoUrl }: ParticipationActionProps) {
  const { value, change } = useExtras();
  const key = participationKey(raceId, entryId);
  const [prompt, setPrompt] = useState(false);
  const selected = value.supported.includes(key);
  const finish = (subscribe: boolean) => {
    change('prompted', key, true);
    if (subscribe) change('subscriptions', key, true);
    setPrompt(false);
  };
  return <div className="support-action"><SupportButton selected={selected} onToggle={() => {
    change('supported', key, !selected);
    if (!selected && !value.prompted.includes(key)) setPrompt(true);
  }} />
    <NotificationPrompt open={prompt} number={String(number)} photoUrl={photoUrl} onConfirm={() => finish(true)} onLater={() => finish(false)} onClose={() => finish(false)} />
  </div>;
}
export function NotificationToggle({ raceId, entryId }: Pick<ParticipationActionProps, 'raceId' | 'entryId'>) {
  const { value, change } = useExtras();
  const key = participationKey(raceId, entryId);
  const selected = value.subscriptions.includes(key);
  return <IconButton label={selected ? 'Отключить уведомления' : 'Включить уведомления'} aria-pressed={selected}
    title="Демонстрационная подписка: настоящие push пока не отправляются" onClick={() => change('subscriptions', key, !selected)}>
    {selected ? <Icon24NotificationCheckOutline /> : <Icon24NotificationOutline />}
  </IconButton>;
}
