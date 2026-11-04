import { Button } from '@vkontakte/vkui';
import { Icon20NotificationOutline } from '@vkontakte/icons';
import { useUser } from '../../app/UserProvider';
import { useAction } from '../../hooks/useAction';
import { mutate } from '../../api/client';
import { RequestState } from '../../components/RequestState';

export function ReminderButton({ eventId, startAt, compact = false }: { eventId: number; startAt: string; compact?:boolean }) {
  const user = useUser();
  const reminders = user.reminders;
  const action = useAction();
  const selected = reminders.data?.program_event_ids.includes(eventId) ?? false;
  const past = Date.parse(startAt) <= Date.now();
  return <span className="reminder-action"><Button mode="secondary" size="s" aria-label={selected ? 'Отменить напоминание' : 'Напомнить о событии'} aria-pressed={selected}
    disabled={past || user.loading || action.busy || Boolean(user.id && !reminders.data)} onClick={() => void action.run(async () => {
      if (!user.id) throw new Error('Откройте приложение во ВКонтакте, чтобы включить напоминание');
      if (!selected && !user.allowed) await user.setNotifications(true);
      await mutate(`/program/${eventId}/reminder`, selected ? 'DELETE' : 'PUT');
    })}><Icon20NotificationOutline />{!compact && (selected ? 'Напоминание включено' : 'Напомнить')}</Button>
    {past && <small>Событие уже началось</small>}<RequestState resource={reminders} />{action.error && <span role="alert">{action.error}</span>}
  </span>;
}
