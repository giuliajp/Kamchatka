import { useEffect, useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { Avatar, Button } from '@vkontakte/vkui';
import { Icon16Chevron, Icon28UserOutline } from '@vkontakte/icons';
import { useUser } from '../../app/UserProvider';
import { useAction } from '../../hooks/useAction';
import { useApi } from '../../hooks/useApi';
import { mutate, query } from '../../api/client';
import { externalUrl } from '../../api/links';
import { updateRoute } from '../../api/navigation';
import { RequestState } from '../../components/RequestState';
import { NotificationToggle, SupportAction } from '../../components/ParticipantActions';
import { BookmarkButton } from './MediaScreen';
import type { SupportRating, NotificationSettings } from '../../types/content';
export function ProfileScreen({ raceId }: { raceId: number }) {
  const user = useUser(); const action = useAction();
  const settings = useApi<NotificationSettings>(user.id ? '/me/notification-settings' : null, 0, false);
  const [identity, setIdentity] = useState<{first_name: string; last_name: string; photo_100: string}>();
  useEffect(() => {
    if (!user.id || !bridge.isEmbedded()) return;
    let active = true;
    void bridge.send('VKWebAppGetUserInfo').then(value => { if (active && typeof value.first_name === 'string' && typeof value.last_name === 'string') setIdentity(value); }).catch(() => { /* Profile settings remain available without VK's avatar. */ });
    return () => { active = false; };
  }, [user.id]);
  const bookmarks = user.bookmarks;
  const rating = useApi<SupportRating[]>(query(`/races/${raceId}/support-rating`, {}), 120000);
  const supports = user.supports.data?.filter(support => support.race_id === raceId);
  return <section className="race-content content-page profile-page" aria-label="Профиль">
    {user.loading ? <p role="status">Проверяем вход…</p> : !user.id ? <div className="content-card"><p>Откройте мини-приложение во ВКонтакте, чтобы болеть за участников, сохранять материалы и получать уведомления.</p>{user.error && <p>{user.error}</p>}<Button onClick={user.refresh}>Проверить вход</Button></div> : <>
      <div className="venue-card profile-identity">{identity?.photo_100 && <img src={identity.photo_100} alt="" />}<strong>{identity ? `${identity.first_name} ${identity.last_name}` : 'Мой профиль'}</strong><small>Вход через ВКонтакте</small></div>{!user.allowed && <Button disabled={action.busy} onClick={() => void action.run(() => user.setNotifications(true))}>Разрешить уведомления</Button>}
      <h3>За кого болею</h3><RequestState resource={user.supports} />{supports?.length === 0 && <p>Вы пока ни за кого не болеете.</p>}
      <div className="profile-supports">{supports?.map(support => <article className="profile-support" key={support.race_participant_id}>
        <SupportAction compact number={support.start_number} raceId={raceId} entryId={support.race_participant_id}/>
        <button className="profile-person" aria-label={`Карточка участника ${support.full_name}`} onClick={()=>updateRoute({raceId,section:'more',page:'profile',entryId:support.race_participant_id})}><Avatar size={44} src={support.photo_url ?? undefined} alt="" fallbackIcon={<Icon28UserOutline/>}/><span><strong>{support.full_name}</strong><small>{support.discipline.name}</small></span><span className="profile-person__end">№{support.start_number}<Icon16Chevron aria-hidden/></span></button>
      </article>)}</div>
      {action.error && <p role="alert">{action.error}</p>}
      <h3>Push-уведомления</h3><RequestState resource={settings} />
      {settings.data && (['checkpoints', 'results', 'news'] as const).map(key => <label className="venue-card notification-setting" key={key}><span><strong>{{ checkpoints: 'Прохождение КП', results: 'Финиш и итоги', news: 'Новости организаторов' }[key]}</strong><small>{{ checkpoints: 'Уведомлять, когда мой участник проходит контрольный пункт', results: 'Уведомлять о результатах этапа и итоговом месте участника', news: 'Изменения программы и сообщения организаторов' }[key]}</small></span>
        <input type="checkbox" role="switch" checked={settings.data![key]} disabled={action.busy} onChange={event => { const checked = event.target.checked; void action.run(async () => { if (checked && !user.allowed) await user.setNotifications(true); await mutate('/me/notification-settings', 'PUT', { [key]: checked }); }); }} />
      </label>)}
      <h3>Сохранённые материалы</h3><RequestState resource={bookmarks} />{bookmarks.data?.length === 0 && <p>Сохранённых материалов пока нет.</p>}
      {bookmarks.data?.map(item => <article className="saved-material" key={`${item.kind}:${item.item_id}`}><h4>{item.title || (item.kind === 'protocol' ? 'Протокол' : item.kind === 'photo' ? 'Фото' : 'Новость')}</h4>{externalUrl(item.url) ? <a href={externalUrl(item.url)} target="_blank" rel="noreferrer">{item.kind === 'protocol' ? 'Открыть сохранённый протокол' : 'Открыть в VK'}</a> : <span>Ссылка недоступна</span>}<BookmarkButton item={item} /></article>)}
    </>}
    <details className="profile-additional"><summary>Настройки поддержки и рейтинг</summary>
      <Button disabled={action.busy} onClick={() => void action.run(() => user.setNotifications(!user.allowed))}>{user.allowed ? 'Отключить уведомления' : 'Разрешить уведомления VK'}</Button>
      {Boolean(supports?.length) && <Button mode="tertiary" disabled={action.busy} onClick={() => void action.run(async () => { await mutate(query('/me/supports', {race_id:raceId}), 'DELETE'); })}>Отменить поддержку всех в сезоне</Button>}
      {supports?.map(support=><div className="content-actions" key={support.race_participant_id}><span>{support.full_name}</span><NotificationToggle raceId={raceId} entryId={support.race_participant_id}/></div>)}
      <h3>Рейтинг поддержки</h3><RequestState resource={rating} />{rating.data?.length === 0 && <p>Поддержите первого участника.</p>}
    <ol className="support-rating">{rating.data?.map(item => <li key={item.race_participant_id} value={item.rank}><button onClick={() => updateRoute({raceId,section:'more',page:'profile',entryId:item.race_participant_id})}>{item.full_name} · №{item.start_number}</button><span>{item.supporters_count} болельщиков · {item.change_24h > 0 ? '+' : ''}{item.change_24h} за сутки</span></li>)}</ol></details>
  </section>;
}
