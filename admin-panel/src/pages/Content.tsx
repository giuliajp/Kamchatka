import { useState } from 'react';
import { useResource } from '../api';
import { LoadState, time } from '../ui';
import { externalUrl } from '../../../frontend/src/api/links';
import type { Contact, Faq, Location, News, Photos, ProgramEvent } from '../../../frontend/src/types/content';
const sections={program:'Программа',locations:'Локации',faq:'FAQ',contacts:'Контакты',media:'Медиа'};
export function Content({raceId}:{raceId:number}) {
  const [tab,setTab]=useState<keyof typeof sections>('program');
  const program=useResource<ProgramEvent[]>(tab==='program'?`/program?race_id=${raceId}`:null);
  const locations=useResource<Location[]>(tab==='locations'?`/locations?race_id=${raceId}`:null);
  const faq=useResource<Faq[]>(tab==='faq'?'/faq':null);const contacts=useResource<Contact[]>(tab==='contacts'?'/contacts':null);
  const news=useResource<News>(tab==='media'?'/news':null);const photos=useResource<Photos>(tab==='media'?'/photos':null);
  return <><p className="notice">Опубликованный контент. Редактирование пока недоступно.</p><div className="tabs">{Object.entries(sections).map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>setTab(key as keyof typeof sections)}>{label}</button>)}</div><section className="card"><h2>{sections[tab]}</h2>
    <LoadState resource={program}/><LoadState resource={locations}/><LoadState resource={faq}/><LoadState resource={contacts}/>
    {program.data?.map(item=><article className="content-item" key={item.id}><h3>{item.title}</h3><p>{time(item.start_at)} — {time(item.end_at)}</p><p>{item.description}</p>{item.location&&<p>{item.location.name} · {item.location.address}</p>}</article>)}
    {locations.data?.map(item=><article className="content-item" key={item.id}><h3>{item.name}</h3><p>{item.description}</p><p>{item.address}</p><p>{item.how_to_get_there}</p><small>{item.latitude}, {item.longitude}</small></article>)}
    {faq.data?.map(item=><details className="content-item" key={item.id}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
    {contacts.data?.map(item=><article className="content-item" key={item.id}><h3>{item.title}</h3><p>{item.name}</p><p>{item.phone} {item.email}</p>{item.url&&<a href={externalUrl(item.url)} target="_blank" rel="noreferrer">Сайт</a>}</article>)}
    {tab==='media'&&<><LoadState resource={news}/><LoadState resource={photos}/>{news.data?.stale&&<p className="notice">Новости: сохранённая версия VK</p>}{news.data?.items.map(item=><article className="content-item" key={item.id}><h3>{item.title}</h3><p>{item.preview}</p><a href={externalUrl(item.url)} target="_blank" rel="noreferrer">Открыть в VK</a></article>)}{photos.data?.stale&&<p className="notice">Фото: сохранённая версия VK</p>}{photos.data?.days.map(day=><article key={day.date}><h3>{day.date}</h3><div className="admin-gallery">{day.photos.map(photo=><a key={photo.id} href={externalUrl(photo.vk_url)} target="_blank" rel="noreferrer">{photo.url&&<img src={externalUrl(photo.url)} alt={photo.text || 'Фото гонки'} loading="lazy"/>}{photo.text || 'Открыть фото в VK'}</a>)}</div></article>)}</>}
    {[program,locations,faq,contacts].some(resource=>resource.data?.length===0)&&<p>Материалы пока не опубликованы.</p>}
  </section></>;
}
