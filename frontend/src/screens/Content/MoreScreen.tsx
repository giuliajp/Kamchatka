import type { ReactNode } from 'react';
import { useApi } from '../../hooks/useApi';
import { useRoute } from '../../hooks/useRoute';
import { updateRoute } from '../../api/navigation';
import { RequestState } from '../../components/RequestState';
import { externalUrl } from '../../api/links';
import type { Contact, Faq, GuestInfo } from '../../types/content';
import type { RaceDetail } from '../../types/api';
import { LocationsScreen } from './LocationsScreen';
import { RouteScreen } from './RouteScreen';
import { MediaScreen } from './MediaScreen';
import { ProfileScreen } from './ProfileScreen';

export function MoreScreen({ race, season, embedded = false }: { race: RaceDetail; season?: ReactNode; embedded?:boolean }) {
  const { page } = useRoute();
  const faq = useApi<Faq[]>('/faq');
  const contacts = useApi<Contact[]>('/contacts');
  const guests = useApi<GuestInfo>('/guest-info');
  const open = (page: string | undefined) => updateRoute({ section: 'more', page });
  if (page) return <>{!embedded && <div className="race-content"><button className="text-action" onClick={() => open(undefined)}>← Ещё</button></div>}
    {page === 'locations' && <LocationsScreen raceId={race.id} />}{page === 'route' && <RouteScreen race={race} />}{page === 'media' && <MediaScreen />}{page === 'profile' && <ProfileScreen raceId={race.id} />}
  </>;
  return <section className="race-content content-page more-page" aria-label="Ещё">
    <button className="profile-link venue-card" onClick={() => open('profile')}><strong>Мой профиль</strong><span>Перейти к настройкам →</span></button>
    <h3>Для гостей гонки</h3><RequestState resource={guests} />
    <details className="venue-card"><summary>Гостям <small>Как добраться, что взять с собой</small></summary>
      <h4>Как добраться</h4>{guests.data?.how_to_get_there.map(item => <article key={item.id}>{item.title && <h4>{item.title}</h4>}<p>{item.text}</p></article>)}
      <button className="text-action" onClick={() => updateRoute({ section: 'program', view: 'watch', page: undefined })}>Карта зрительских локаций</button>
      <h4>Что взять с собой</h4><ul>{guests.data?.what_to_bring.map(item => <li key={item.id}>{item.title && <strong>{item.title}: </strong>}{item.text}</li>)}</ul>
      {guests.data && !guests.data.how_to_get_there.length && !guests.data.what_to_bring.length && <p>Информация для гостей пока не опубликована.</p>}
    </details>
    <details className="venue-card"><summary>Техника безопасности <small>Правила для зрителей на трассе</small></summary>{guests.data?.safety.map(item => <article key={item.id}>{item.title && <h4>{item.title}</h4>}<p>{item.text}</p></article>)}{guests.data?.safety.length === 0 && <p>Правила пока не опубликованы.</p>}</details>
    <details className="venue-card"><summary>FAQ <small>Ответы на частые вопросы</small></summary><RequestState resource={faq} />{faq.data?.map(item => <details key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}{faq.data?.length === 0 && <p>Ответы пока не опубликованы.</p>}</details>
    <h3>Контакты организаторов</h3><RequestState resource={contacts} />{contacts.data?.length === 0 && <p>Контакты пока не опубликованы.</p>}{contacts.data?.map(item => <article className="venue-card" key={item.id}>{item.title && <h4>{item.title}</h4>}{item.name && <p>{item.name}</p>}{item.phone && <a className="contact-phone" href={`tel:${item.phone.replace(/[^+\d]/g, '')}`}>{item.phone}</a>}{item.email && <p><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a></p>}{externalUrl(item.url) && <a href={externalUrl(item.url)} target="_blank" rel="noreferrer">Сайт</a>}</article>)}
    <nav className="content-actions" aria-label="Другие материалы"><button className="text-action" onClick={() => open('media')}>Новости и фото</button><button className="text-action" onClick={() => open('route')}>Маршрут и высоты</button><button className="text-action" onClick={() => open('locations')}>Зрительские локации</button></nav>{season && <details><summary>Выбрать сезон</summary>{season}</details>}
  </section>;
}
