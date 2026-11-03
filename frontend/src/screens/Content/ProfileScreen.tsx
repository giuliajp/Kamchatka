import { Button } from '@vkontakte/vkui';
import { useUser } from '../../app/UserProvider';
import { useAction } from '../../hooks/useAction';
import { useApi } from '../../hooks/useApi';
import { mutate, query } from '../../api/client';
import { externalUrl } from '../../api/links';
import { navigateRace } from '../../api/navigation';
import { RequestState } from '../../components/RequestState';
import { NotificationToggle, SupportAction } from '../../components/ParticipantActions';
import { BookmarkButton } from './MediaScreen';
import type { Bookmark, SupportRating } from '../../types/content';
export function ProfileScreen({ raceId }: { raceId: number }) {
  const user = useUser(); const action = useAction();
  const bookmarks = useApi<Bookmark[]>(user.id ? '/me/bookmarks' : null, 0, false);
  const rating = useApi<SupportRating[]>(query(`/races/${raceId}/support-rating`, {}), 120000);
  const supports = user.supports.data?.filter(support => support.race_id === raceId);
  return <section className="race-content content-page"><h2>Профиль</h2>
    {user.loading ? <p role="status">Проверяем вход…</p> : !user.id ? <div className="content-card"><p>Откройте мини-приложение во ВКонтакте, чтобы болеть за участников, сохранять материалы и получать уведомления.</p>{user.error && <p>{user.error}</p>}<Button onClick={user.refresh}>Проверить вход</Button></div> : <>
      <p>Вы вошли через VK · {user.id}</p><Button disabled={action.busy} onClick={() => void action.run(() => user.setNotifications(!user.allowed))}>{user.allowed ? 'Отключить уведомления' : 'Разрешить уведомления'}</Button>
      <h3>Мои участники</h3><RequestState resource={user.supports} />{supports?.length === 0 && <p>Вы пока ни за кого не болеете.</p>}
      {supports?.map(support => <article className="content-card" key={support.race_participant_id}><h4>{support.full_name} · №{support.start_number}</h4><p>{support.discipline.name}</p><div className="content-actions">
        <Button mode="secondary" onClick={() => navigateRace(`race=${raceId}&participant=${support.race_participant_id}`)}>Карточка участника</Button>
        <SupportAction number={support.start_number} raceId={raceId} entryId={support.race_participant_id} /><NotificationToggle raceId={raceId} entryId={support.race_participant_id} />
      </div></article>)}
      {Boolean(supports?.length) && <Button mode="tertiary" disabled={action.busy} onClick={() => void action.run(async () => { await mutate(query('/me/supports', {race_id:raceId}), 'DELETE'); })}>Отменить поддержку всех в сезоне</Button>}
      {action.error && <p role="alert">{action.error}</p>}
      <h3>Сохранённые материалы</h3><RequestState resource={bookmarks} />{bookmarks.data?.length === 0 && <p>Сохранённых материалов пока нет.</p>}
      {bookmarks.data?.map(item => <article className="content-card" key={`${item.kind}:${item.item_id}`}><h4>{item.title || (item.kind === 'photo' ? 'Фото' : 'Новость')}</h4><a href={externalUrl(item.url)} target="_blank" rel="noreferrer">Открыть в VK</a><BookmarkButton item={item} /></article>)}
    </>}
    <h3>Рейтинг поддержки</h3><RequestState resource={rating} />{rating.data?.length === 0 && <p>Поддержите первого участника.</p>}
    <ol className="support-rating">{rating.data?.map(item => <li key={item.race_participant_id} value={item.rank}><button onClick={() => navigateRace(`race=${raceId}&participant=${item.race_participant_id}`)}>{item.full_name} · №{item.start_number}</button><span>{item.supporters_count} болельщиков · {item.change_24h > 0 ? '+' : ''}{item.change_24h} за сутки</span></li>)}</ol>
  </section>;
}
