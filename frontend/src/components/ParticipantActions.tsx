import { useState } from 'react';
import { IconButton } from '@vkontakte/vkui';
import { Icon24NotificationOutline, Icon24NotificationCheckOutline } from '@vkontakte/icons';
import { useUser } from '../app/UserProvider';
import { mutate } from '../api/client';
import { useAction } from '../hooks/useAction';
import { SupportButton } from './SupportButton';
import { NotificationPrompt } from './NotificationPrompt';

export interface ParticipationActionProps { raceId: number; entryId: number; number: number; photoUrl?: string }
export function SupportAction({ raceId, entryId, number, photoUrl }: ParticipationActionProps) {
  const user = useUser();
  const action = useAction();
  const [prompt, setPrompt] = useState(false);
  const selected = user.supports.data?.some(item => item.race_id === raceId && item.race_participant_id === entryId) ?? false;
  return <div className="support-action"><SupportButton selected={selected} loading={action.busy} disabled={user.loading || (Boolean(user.id) && !user.supports.data)} onToggle={() => {
    void action.run(async () => {
      if (!user.id) throw new Error('Откройте приложение во ВКонтакте, чтобы болеть за участника');
      await mutate(`/race-participants/${entryId}/support`, selected ? 'DELETE' : 'PUT');
      if (!selected && !user.allowed) setPrompt(true);
    });
  }} />
    {action.error && <p role="alert">{action.error}</p>}
    <NotificationPrompt open={prompt} number={String(number)} photoUrl={photoUrl} onConfirm={() => { void action.run(() => user.setNotifications(true)).then(ok => { if (ok) setPrompt(false); }); }} onLater={() => setPrompt(false)} onClose={() => setPrompt(false)} />
  </div>;
}
export function NotificationToggle({ raceId, entryId }: Pick<ParticipationActionProps, 'raceId' | 'entryId'>) {
  const user = useUser();
  const action = useAction();
  const support = user.supports.data?.find(item => item.race_id === raceId && item.race_participant_id === entryId);
  const selected = Boolean(support?.notifications_enabled && user.allowed);
  return <span><IconButton label={selected ? 'Отключить уведомления' : 'Включить уведомления'} aria-pressed={selected} disabled={!support || action.busy} onClick={() => {
    void action.run(async () => {
      if (!selected && !user.allowed) await user.setNotifications(true);
      await mutate(`/me/supports/${entryId}`, 'PATCH', { notifications_enabled: !selected });
    });
  }}>
    {selected ? <Icon24NotificationCheckOutline /> : <Icon24NotificationOutline />}
  </IconButton>{action.error && <span role="alert">{action.error}</span>}</span>;
}
