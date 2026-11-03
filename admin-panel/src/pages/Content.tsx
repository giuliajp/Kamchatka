import { useState } from 'react';
import { save, useResource } from '../api';
import { ConfirmButton, Field, LoadState, SaveForm, kamchatkaInput, kamchatkaValue, numeric, optional, string, time } from '../ui';
import { externalUrl } from '../../../frontend/src/api/links';
import type { Contact, Faq, GuestItem, Location, News, Photos, ProgramEvent } from '../../../frontend/src/types/content';
import type { Stage } from '../types';

const sections = { program: 'Программа', locations: 'Локации', faq: 'FAQ', contacts: 'Контакты', 'guest-info': 'Гостям', media: 'Медиа' };
type Tab = keyof typeof sections;
type Item = Partial<Omit<ProgramEvent, 'location'> & Location & Faq & Contact & GuestItem> & { id: number; is_published: boolean; sort_order: number; location_id?: number | null; section?: string };
const eventTypes = { stage_start: 'Старт этапа', stage_finish: 'Финиш этапа', festival: 'Культурная программа', master_class: 'Мастер-класс', meeting: 'Встреча' };
const locationTypes = { start: 'Старт', finish: 'Финиш', festival: 'Фестивальная площадка', viewpoint: 'Зрительская точка', checkpoint: 'КП' };
const guestSections = { how_to_get_there: 'Как добраться', what_to_bring: 'Что взять с собой', safety: 'Техника безопасности' };

function ContentForm({ tab, raceId, item, onSaved }: { tab: Tab; raceId: number; item?: Item; onSaved: (item: Item) => void }) {
  const seasonal = tab === 'program' || tab === 'locations';
  const stages = useResource<Stage[]>(seasonal ? `/admin/races/${raceId}/stages` : null);
  const locations = useResource<Item[]>(tab === 'program' ? `/admin/races/${raceId}/locations` : null);
  return <><LoadState resource={stages} /><LoadState resource={locations} /><SaveForm label="Сохранить материал" onSave={async data => {
    if ((seasonal && !stages.data) || (tab === 'program' && !locations.data)) throw new Error('Дождитесь загрузки этапов и локаций перед сохранением.');
    const common = { sort_order: numeric(data, 'sort_order'), is_published: data.has('is_published') };
    let fields: object;
    if (tab === 'program' || tab === 'locations') {
      const urls = string(data, 'image_urls').split('\n').map(url => url.trim()).filter(Boolean);
      if (urls.length > 20 || urls.some(url => !externalUrl(url))) throw new Error('Укажите не более 20 ссылок на фотографии с http или https');
      const links = { stage_id: numeric(data, 'stage_id'), image_urls: urls, ...(!item ? { race_id: raceId } : {}) };
      fields = tab === 'program' ? { ...links, event_type: string(data, 'event_type'), title: string(data, 'title'), description: optional(data, 'description'), start_at: kamchatkaValue(data, 'start_at'), end_at: kamchatkaValue(data, 'end_at'), location_id: numeric(data, 'location_id') }
        : { ...links, location_type: string(data, 'location_type'), name: string(data, 'name'), description: optional(data, 'description'), latitude: numeric(data, 'latitude'), longitude: numeric(data, 'longitude'), address: optional(data, 'address'), how_to_get_there: optional(data, 'how_to_get_there') };
    } else if (tab === 'faq') fields = { question: string(data, 'question'), answer: string(data, 'answer') };
    else if (tab === 'contacts') fields = { title: string(data, 'title'), name: optional(data, 'name'), phone: optional(data, 'phone'), email: optional(data, 'email'), url: optional(data, 'url') };
    else fields = { section: string(data, 'section'), title: optional(data, 'title'), text: string(data, 'text') };
    const saved = await save<Item>(`/admin/${tab}${item ? `/${item.id}` : ''}`, item ? 'PATCH' : 'POST', { ...common, ...fields });
    onSaved(saved);
  }}>
    {seasonal && <label className="field">Этап материала<select name="stage_id" key={stages.data ? 'ready' : 'loading'} disabled={!stages.data} defaultValue={item?.stage_id ?? ''}><option value="">Без привязки к этапу</option>{stages.data?.map(stage => <option key={stage.id} value={stage.id}>Этап {stage.number} · {stage.name}</option>)}</select></label>}
    {tab === 'program' && <><label className="field">Тип события<select name="event_type" defaultValue={item?.event_type ?? 'festival'}>{Object.entries(eventTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <Field label="Название события" name="title" required maxLength={200} defaultValue={item?.title ?? ''} />
      <Field label="Начало · Камчатка" name="start_at" type="datetime-local" required defaultValue={kamchatkaInput(item?.start_at ?? null)} /><Field label="Окончание · Камчатка" name="end_at" type="datetime-local" defaultValue={kamchatkaInput(item?.end_at ?? null)} />
      <label className="field">Локация события<select name="location_id" key={locations.data ? 'ready' : 'loading'} disabled={!locations.data} defaultValue={item?.location_id ?? ''}><option value="">Место не указано</option>{locations.data?.map(place => <option key={place.id} value={place.id}>{place.name}{!place.is_published && ' · черновик'}</option>)}</select></label>
    </>}
    {tab === 'locations' && <><label className="field">Тип локации<select name="location_type" defaultValue={item?.location_type ?? 'viewpoint'}>{Object.entries(locationTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Field label="Название локации" name="name" required maxLength={200} defaultValue={item?.name ?? ''} />
      <div className="grid"><Field label="Широта" name="latitude" type="number" step="any" min={-90} max={90} required defaultValue={item?.latitude} /><Field label="Долгота" name="longitude" type="number" step="any" min={-180} max={180} required defaultValue={item?.longitude} /></div><Field label="Адрес" name="address" maxLength={500} defaultValue={item?.address ?? ''} /><label className="field">Как добраться<textarea name="how_to_get_there" defaultValue={item?.how_to_get_there ?? ''} /></label>
    </>}
    {seasonal && <><label className="field">Описание<textarea name="description" defaultValue={item?.description ?? ''} /></label><label className="field">Фотографии, одна ссылка в строке<textarea name="image_urls" defaultValue={item?.image_urls?.join('\n') ?? ''} /></label><small>До 20 фотографий. Порядок ссылок задаёт порядок карусели.</small></>}
    {tab === 'faq' && <><Field label="Вопрос" name="question" required maxLength={500} defaultValue={item?.question ?? ''} /><label className="field">Ответ<textarea name="answer" required defaultValue={item?.answer ?? ''} /></label></>}
    {tab === 'contacts' && <><Field label="Название контакта" name="title" required maxLength={200} defaultValue={item?.title ?? ''} /><Field label="Имя" name="name" maxLength={200} defaultValue={item?.name ?? ''} /><Field label="Телефон" name="phone" type="tel" maxLength={100} defaultValue={item?.phone ?? ''} /><Field label="Email" name="email" type="email" maxLength={320} defaultValue={item?.email ?? ''} /><Field label="Сайт" name="url" type="url" maxLength={2000} defaultValue={item?.url ?? ''} /></>}
    {tab === 'guest-info' && <><label className="field">Раздел для гостей<select name="section" defaultValue={item?.section ?? 'how_to_get_there'}>{Object.entries(guestSections).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Field label="Заголовок пункта" name="title" maxLength={200} defaultValue={item?.title ?? ''} /><label className="field">Текст<textarea name="text" required defaultValue={item?.text ?? ''} /></label></>}
    <Field label="Порядок" name="sort_order" type="number" min={0} required defaultValue={item?.sort_order ?? 0} /><Field label="Опубликовано в приложении" name="is_published" type="checkbox" defaultChecked={item?.is_published ?? false} />
  </SaveForm></>;
}
function Media() {
  const news = useResource<News>('/news'); const photos = useResource<Photos>('/photos');
  return <section className="card"><h2>Медиа сообщества VK</h2><LoadState resource={news} /><LoadState resource={photos} />{news.data?.stale && <p>Сохранённая версия новостей VK</p>}{news.data?.items.map(item => <article key={item.id}><h3>{item.title}</h3><p>{item.preview}</p><a href={externalUrl(item.url)} target="_blank" rel="noreferrer">Открыть в VK</a></article>)}{photos.data?.stale && <p>Сохранённая версия фото VK</p>}{photos.data?.days.map(day => <article key={day.date}><h3>{day.date}</h3><div className="admin-gallery">{day.photos.map(photo => <a key={photo.id} href={externalUrl(photo.vk_url)} target="_blank" rel="noreferrer">{photo.url && <img src={externalUrl(photo.url)} alt={photo.text || 'Фото гонки'} loading="lazy" />}{photo.text || 'Открыть фото в VK'}</a>)}</div></article>)}</section>;
}
function ContentEditor({ raceId }: { raceId: number }) {
  const [tab, setTab] = useState<Tab>('program'); const [selected, setSelected] = useState<Item>();
  const path = tab === 'media' ? null : tab === 'program' || tab === 'locations' ? `/admin/races/${raceId}/${tab}` : `/admin/${tab}`;
  const items = useResource<Item[]>(path);
  return <><div className="tabs">{Object.entries(sections).map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => { setTab(key as Tab); setSelected(undefined); }}>{label}</button>)}</div>
    {tab === 'media' ? <Media /> : <div className="grid"><section className="card"><h2>{sections[tab]}</h2><p>Черновики видны только организаторам.</p><button onClick={() => setSelected(undefined)}>Добавить материал</button><LoadState resource={items} />{items.data?.length === 0 && <p>Материалов пока нет.</p>}
      {items.data?.map(item => <article className="content-item" key={item.id}><button className="link-button" onClick={() => setSelected(item)}>{item.title || item.name || item.question || item.text}</button><small>{item.is_published ? 'Опубликовано' : 'Черновик'} · порядок {item.sort_order}</small>{item.start_at && <p>{time(item.start_at)}</p>}</article>)}
    </section><section className="card"><h2>{selected ? 'Редактирование материала' : 'Новый материал'}</h2><ContentForm key={`${tab}:${selected?.id ?? 'new'}`} tab={tab} raceId={raceId} item={selected} onSaved={setSelected} />
      {selected && <ConfirmButton question={tab === 'locations' ? 'Удалить локацию? Связанные события сохранятся без места.' : 'Удалить материал?'} action={async () => { await save(`/admin/${tab}/${selected.id}`, 'DELETE'); setSelected(undefined); }}>Удалить материал</ConfirmButton>}
    </section></div>}
  </>;
}

export function Content({raceId}:{raceId:number}) { return <ContentEditor key={raceId} raceId={raceId}/>; }
