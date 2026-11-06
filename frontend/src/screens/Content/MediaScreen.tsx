import { useState } from 'react';
import bridge from '@vkontakte/vk-bridge';
import { Button, ModalCard } from '@vkontakte/vkui';
import { mutate, query } from '../../api/client';
import { externalUrl } from '../../api/links';
import { raceDate } from '../../api/format';
import { shareRace } from '../../api/navigation';
import { useUser } from '../../app/UserProvider';
import { useAction } from '../../hooks/useAction';
import { useApi } from '../../hooks/useApi';
import { StoryShareButton } from '../../components/StoryShareButton';
import { RequestState } from '../../components/RequestState';
import type { Bookmark, News, NewsItem, Photo, Photos } from '../../types/content';

export function BookmarkButton({ item }: { item: Omit<Bookmark, 'created_at'> }) {
  const user = useUser();
  const saved = user.bookmarks;
  const selected = saved.data?.some(bookmark => bookmark.kind === item.kind && bookmark.item_id === item.item_id);
  const action = useAction();
  return <><Button mode="secondary" size="s" disabled={action.busy || user.loading || Boolean(user.id && !saved.data)} aria-pressed={selected ?? false} onClick={() => void action.run(async () => {
    if (!user.id) throw new Error('Откройте приложение во ВКонтакте, чтобы сохранить материал');
    await mutate(selected ? `/me/bookmarks/${item.kind}/${encodeURIComponent(item.item_id)}` : '/me/bookmarks', selected ? 'DELETE' : 'PUT', selected ? undefined : item);
  })}>{selected ? 'Убрать из сохранённого' : 'Сохранить'}</Button><RequestState resource={saved} />{action.error && <p role="alert">{action.error}</p>}</>;
}
function NewsCard({ item }: { item: NewsItem }) {
  const action = useAction(); const [message, setMessage] = useState('');
  return <article className="content-card"><small>{raceDate(item.date)}</small><h3>{item.title}</h3>
    {externalUrl(item.cover_url) && <img className="content-image" src={externalUrl(item.cover_url)} alt="" loading="lazy" />}<p>{item.preview}</p>
    <div className="content-actions"><a href={externalUrl(item.url)} target="_blank" rel="noreferrer">Читать в VK</a>
      <Button size="s" mode="secondary" disabled={action.busy} onClick={() => void action.run(async () => {
        if (bridge.isEmbedded()) { await bridge.send('VKWebAppShowWallPostBox', { attachments: `wall${item.owner_id}_${item.post_id}` }); setMessage('Запись отправлена в VK'); }
        else setMessage(await shareRace(item.url, item.title));
      })}>Репост</Button><BookmarkButton item={{kind:'news',item_id:item.id,title:item.title,url:item.url,image_url:item.cover_url}} /></div>
    <StoryShareButton link={item.url} card={{heading: 'Новости Авачи', title: item.title, lines: [raceDate(item.date), item.preview], action: 'Читать новость'}} />
    {message && <p role="status">{message}</p>}{action.error && <p role="alert">{action.error}</p>}
  </article>;
}
export function MediaScreen() {
  const [offset, setOffset] = useState(0);
  const news = useApi<News>(query('/news', { offset, count: 20 }));
  const photos = useApi<Photos>('/photos');
  const [preview, setPreview] = useState<Photo>();
  return <div className="race-content content-page">
    {news.error?.status !== 503 && <section><h2>Новости</h2><RequestState resource={news} />{news.data?.stale && <p role="status">Сохранённая версия новостей. Обновление VK временно недоступно.</p>}
      {news.data?.items.map(item => <NewsCard key={item.id} item={item} />)}{news.data?.items.length === 0 && <p>Новостей пока нет.</p>}
      <div className="content-actions">{offset > 0 && <Button onClick={() => setOffset(Math.max(0, offset - 20))}>Предыдущие</Button>}{news.data && offset + news.data.items.length < news.data.total && <Button onClick={() => setOffset(offset + 20)}>Следующие</Button>}</div>
    </section>}
    {photos.error?.status !== 503 && <section><h2>Фото</h2><RequestState resource={photos} />{photos.data?.stale && <p role="status">Сохранённая версия фото. Обновление VK временно недоступно.</p>}
      {photos.data?.days.length === 0 && <p>Фотографий пока нет.</p>}
      {photos.data?.days.map(day => <section key={day.date}><h3>{raceDate(day.date)}</h3><div className="photo-grid">{day.photos.map(photo => <article className="content-card" key={photo.id}>
        {externalUrl(photo.url) && <button className="photo-preview" onClick={() => setPreview(photo)} aria-label={`Открыть фото: ${photo.text || photo.id}`}><img src={externalUrl(photo.url)} alt={photo.text || 'Фото гонки'} loading="lazy" /></button>}
        {photo.text && <p>{photo.text}</p>}<a href={externalUrl(photo.vk_url)} target="_blank" rel="noreferrer">Открыть фото в VK</a>
        <BookmarkButton item={{kind:'photo',item_id:photo.id,title:photo.text,url:photo.vk_url,image_url:photo.url}} />
      </article>)}</div></section>)}
    </section>}
    <ModalCard open={Boolean(preview)} onClose={() => setPreview(undefined)} title={preview?.text || 'Фото гонки'} aria-label="Просмотр фото" dismissLabel="Закрыть фото" dismissButtonMode="inside">{preview && <img className="content-image" src={externalUrl(preview.url)} alt={preview.text || 'Фото гонки'} />}</ModalCard>
  </div>;
}
