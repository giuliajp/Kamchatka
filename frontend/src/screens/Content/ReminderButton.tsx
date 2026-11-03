import { Button } from '@vkontakte/vkui';
import { Icon20NotificationOutline } from '@vkontakte/icons';
import { useUser } from '../../app/UserProvider';
import { useApi } from '../../hooks/useApi';
import { useAction } from '../../hooks/useAction';
import { mutate } from '../../api/client';
import { RequestState } from '../../components/RequestState';
import type { Reminders } from '../../types/content';

export function ReminderButton({ eventId, startAt }: { eventId: number; startAt: string }) {
  const user = useUser();
  const reminders = useApi<Reminders>(user.id ? '/me/reminders' : null, 0, false);
  const action = useAction();
  const selected = reminders.data?.program_event_ids.includes(eventId) ?? false;
  const past = Date.parse(startAt) <= Date.now();
  return <span className="reminder-action"><Button mode="secondary" size="s" aria-label={selected ? 'Отменить напоминание' : 'Напомнить о событии'} aria-pressed={selected}
    disabled={past || user.loading || action.busy || Boolean(user.id && !reminders.data)} onClick={() => void action.run(async () => {
      if (!user.id) throw new Error('Откройте приложение во ВКонтакте, чтобы включить напоминание');
      if (!selected && !user.allowed) await user.setNotifications(true);
      await mutate(`/program/${eventId}/reminder`, selected ? 'DELETE' : 'PUT');
    })}><Icon20NotificationOutline />{selected ? 'Напоминание включено' : 'Напомнить'}</Button>
    {past && <small>Событие уже началось</small>}<RequestState resource={reminders} />{action.error && <span role="alert">{action.error}</span>}
  </span>;
}
