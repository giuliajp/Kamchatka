import { useState } from 'react';
import { Button } from '@vkontakte/vkui';
import { useApi } from '../../hooks/useApi';
import { RequestState } from '../../components/RequestState';
import { externalUrl } from '../../api/links';
import type { Contact, Faq } from '../../types/content';
import type { RaceDetail } from '../../types/api';
import { LocationsScreen } from './LocationsScreen';
import { RouteScreen } from './RouteScreen';
import { MediaScreen } from './MediaScreen';
import { ProfileScreen } from './ProfileScreen';
const pages = { media: 'Новости и фото', profile: 'Профиль и сохранённое', locations: 'Зрительские локации', route: 'Маршрут и высоты', faq: 'Вопросы и ответы', contacts: 'Контакты' };
function Info({ page }: { page: 'faq' | 'contacts' }) {
  const faq = useApi<Faq[]>(page === 'faq' ? '/faq' : null); const contacts = useApi<Contact[]>(page === 'contacts' ? '/contacts' : null);
  return <section className="race-content content-page"><h2>{pages[page]}</h2><RequestState resource={faq} /><RequestState resource={contacts} />
    {faq.data?.length === 0 && <p>Ответы пока не опубликованы.</p>}{contacts.data?.length === 0 && <p>Контакты пока не опубликованы.</p>}
    {faq.data?.map(item => <details className="content-card" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
    {contacts.data?.map(item => <article className="content-card" key={item.id}><h3>{item.title}</h3>{item.name && <p>{item.name}</p>}{item.phone && <p><a href={`tel:${item.phone.replace(/[^+\d]/g, '')}`}>{item.phone}</a></p>}{item.email && <p><a href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a></p>}{item.url && <a href={externalUrl(item.url)} target="_blank" rel="noreferrer">Подробнее</a>}</article>)}
  </section>;
}
export function MoreScreen({ race }: { race: RaceDetail }) {
  const [page, setPage] = useState<keyof typeof pages>();
  return <>{page ? <div className="race-content"><Button mode="tertiary" onClick={() => setPage(undefined)}>← Ещё</Button></div> : <section className="race-content content-page"><h2>Ещё</h2><nav className="more-menu" aria-label="Дополнительные разделы">{Object.entries(pages).map(([key, title]) => <Button mode="secondary" size="l" key={key} onClick={() => setPage(key as keyof typeof pages)}>{title}</Button>)}</nav></section>}
    {page === 'locations' && <LocationsScreen raceId={race.id} />}{page === 'route' && <RouteScreen race={race} />}{page === 'media' && <MediaScreen />}{page === 'profile' && <ProfileScreen raceId={race.id} />}{(page === 'faq' || page === 'contacts') && <Info page={page} />}
  </>;
}
