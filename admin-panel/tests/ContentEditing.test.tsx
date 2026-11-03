import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Content } from '../src/pages/Content';
import { fixtureData } from '../src/stories/fixtures';
import { programEvent, spectatorLocation, faq, contact, news, photos } from '../../frontend/src/stories/contentFixtures';
const location = { ...spectatorLocation, race_id: 1, stage_id: null, is_published: false };
const event = { ...programEvent, race_id: 1, stage_id: null, location_id: 1, is_published: false };
const guest = { id: 1, section: 'safety', title: 'На трассе', text: 'Не выходите на трассу.', sort_order: 0, is_published: false };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function server(initial: Record<string, Record<string, unknown>[]> = {}) {
 const rows = { program: [event], locations: [location], faq: [{...faq}], contacts: [{...contact}], 'guest-info': [guest], ...initial } as Record<string, Record<string, unknown>[]>;
 const writes: {path: string; method: string; body: Record<string, unknown>}[] = [];
 let fail = false;
 const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = String(input).replace('/api', ''); const method = init?.method || 'GET'; const part = path.match(/\/(program|locations|faq|contacts|guest-info)(?:\/(\d+))?$/);
  let data: unknown;
  if (part) {
   const kind = part[1]; const id = Number(part[2]);
   if (method === 'GET') data = path.includes('/races/2/') ? [] : rows[kind].map(item => ({ is_published: false, ...item }));
   else {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    writes.push({path, method, body});
    if (fail) return new Response(JSON.stringify({error:{code:'validation_error',message:'Проверьте название',details:[{field:'title',problem:'Ошибка поля'}]}}),{status:422});
    const previous = rows[kind].find(item => item.id === id) || { ...rows[kind][0], id: 2 };
    data = {...previous, ...body};
    rows[kind] = method === 'DELETE' ? rows[kind].filter(item => item.id !== id) : method === 'POST' ? [...rows[kind], data as Record<string,unknown>] : rows[kind].map(item => item.id === id ? data as Record<string,unknown> : item);
   }
  } else data = path === '/news' ? news : path === '/photos' ? {...photos, stale: true} : fixtureData(path);
  return new Response(JSON.stringify({data: data ?? [],error:null}));
 });vi.stubGlobal('fetch',fetcher);return {writes,fetcher,rows,setFailure:(value:boolean)=>{fail=value;}};
}
const cases = [
 ['Программа','program','Название события',event.title], ['Локации','locations','Название локации',location.name], ['FAQ','faq','Вопрос',faq.question], ['Контакты','contacts','Название контакта',contact.title], ['Гостям','guest-info','Заголовок пункта',guest.title],
];
it.each(cases)('creates, edits, publishes and deletes %s with server responses', async (label, kind, field, original) => {
 const api = server();vi.spyOn(window,'confirm').mockReturnValue(true);render(<Content raceId={1}/>);
 if(kind !== 'program') await userEvent.click(screen.getByRole('button',{name:label}));
 await screen.findByRole('button',{name:original});
 await userEvent.click(screen.getByRole('button',{name:original}));
 expect(screen.getByLabelText(field)).toHaveValue(original);
 fireEvent.change(screen.getByLabelText(field),{target:{value:'Обновлённый материал'}});
 await userEvent.click(screen.getByLabelText('Опубликовано в приложении'));
 fireEvent.change(screen.getByLabelText('Порядок'),{target:{value:'4'}});
 await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));
 await waitFor(()=>expect(api.writes[0]).toMatchObject({path:`/admin/${kind}/1`,method:'PATCH',body:{is_published:true,sort_order:4}}));
 await screen.findByText('Сохранено');
 expect(await screen.findByRole('button',{name:'Обновлённый материал'})).toBeVisible();
 await userEvent.click(screen.getByRole('button',{name:'Добавить материал'}));
 fireEvent.change(screen.getByLabelText(field),{target:{value:'Новый пункт'}});
 if(kind==='program') fireEvent.change(screen.getByLabelText('Начало · Камчатка'),{target:{value:'2027-02-05T13:00'}});
 if(kind==='locations') {fireEvent.change(screen.getByLabelText('Широта'),{target:{value:'53'}});fireEvent.change(screen.getByLabelText('Долгота'),{target:{value:'158'}});}
 if(kind==='faq') fireEvent.change(screen.getByLabelText('Ответ'),{target:{value:'Новый ответ'}});
 if(kind==='guest-info') fireEvent.change(screen.getByLabelText('Текст'),{target:{value:'Правило'}});
 await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));
 await waitFor(()=>expect(api.writes.some(write=>write.method==='POST')).toBe(true));
 expect(await screen.findByRole('button',{name:'Новый пункт'})).toBeVisible();
 await userEvent.click(screen.getByRole('button',{name:'Удалить материал'}));
 await waitFor(()=>expect(api.writes.some(write=>write.method==='DELETE')).toBe(true));
 expect(screen.getByRole('heading',{name:'Новый материал'})).toBeVisible();
});
it('retains draft fields on server failure and validates photo URLs before sending', async () => {
 const api=server();render(<Content raceId={1}/>);await userEvent.click(await screen.findByRole('button',{name:event.title}));
 fireEvent.change(screen.getByLabelText('Название события'),{target:{value:'Не терять текст'}});api.setFailure(true);
 await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));expect(await screen.findByRole('alert')).toHaveTextContent('Проверьте название');expect(screen.getByLabelText('Название события')).toHaveValue('Не терять текст');
 fireEvent.change(screen.getByLabelText('Фотографии, одна ссылка в строке'),{target:{value:'javascript:alert(1)'}});await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));expect(await screen.findByRole('alert')).toHaveTextContent('не более 20');expect(api.writes).toHaveLength(1);
 fireEvent.change(screen.getByLabelText('Фотографии, одна ссылка в строке'),{target:{value:Array(21).fill('https://example.org/p.jpg').join('\n')}});await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));expect(api.writes).toHaveLength(1);
 api.setFailure(false);await userEvent.selectOptions(screen.getByLabelText('Тип события'),'meeting');fireEvent.change(screen.getByLabelText('Фотографии, одна ссылка в строке'),{target:{value:' https://example.org/a.jpg\n\nhttps://example.org/b.jpg '}});await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));await screen.findByText('Сохранено');expect(api.writes.at(-1)?.body).toMatchObject({event_type:'meeting',image_urls:['https://example.org/a.jpg','https://example.org/b.jpg']});
});
it('loads only same-season stages and locations, warns about unlinking events and resets on season changes',async()=>{
 const api=server({locations:[{...location,stage_id:1,is_published:false}]});const {rerender}=render(<Content raceId={1}/>);await screen.findByRole('button',{name:event.title});expect(screen.getByLabelText('Локация события')).toHaveTextContent('черновик');
 await userEvent.selectOptions(screen.getByLabelText('Тип события'),'master_class');expect(screen.getByLabelText('Тип события')).toHaveValue('master_class');
 await userEvent.click(screen.getByRole('button',{name:'Локации'}));await userEvent.click(await screen.findByRole('button',{name:location.name}));vi.spyOn(window,'confirm').mockReturnValue(false);await userEvent.click(screen.getByRole('button',{name:'Удалить материал'}));expect(window.confirm).toHaveBeenCalledWith('Удалить локацию? Связанные события сохранятся без места.');expect(api.writes).toHaveLength(0);
 rerender(<Content raceId={2}/>);await screen.findByText('Материалов пока нет.');expect(screen.getByLabelText('Название события')).toHaveValue('');expect(api.fetcher).toHaveBeenCalledWith('/api/admin/races/2/program',expect.anything());
});
it('keeps VK media previews and stale labels',async()=>{server();render(<Content raceId={1}/>);await userEvent.click(screen.getByRole('button',{name:'Медиа'}));expect(await screen.findByText('Сохранённая версия новостей VK')).toBeVisible();expect(screen.getByText('Сохранённая версия фото VK')).toBeVisible();expect(screen.getByRole('link',{name:'Открыть в VK'})).toBeVisible();});
it('renders untitled guest items and nullable media without inventing images',async()=>{
 server({'guest-info':[{...guest,title:null}]});const original=fetch;vi.stubGlobal('fetch',vi.fn((input,init)=>String(input).endsWith('/photos')?Promise.resolve(new Response(JSON.stringify({data:{...photos,days:[{...photos.days[0],photos:[{...photos.days[0].photos[0],text:null,url:null},{...photos.days[0].photos[0],id:'other',text:null}]}]}}))):original(input,init)));
 render(<Content raceId={1}/>);await userEvent.click(screen.getByRole('button',{name:'Гостям'}));expect(await screen.findByRole('button',{name:guest.text})).toBeVisible();await userEvent.click(screen.getByRole('button',{name:'Медиа'}));expect(await screen.findByRole('img',{name:'Фото гонки'})).toBeVisible();expect(screen.getAllByRole('link',{name:/Открыть фото в VK/})).toHaveLength(2);
});
it('restores existing stage and venue after delayed selectors load and prevents accidental unlinking while unavailable',async()=>{
 const api=server({program:[{...event,stage_id:1}]});const original=fetch;let ready=false;
 vi.stubGlobal('fetch',vi.fn((input,init)=>!ready&&(String(input).endsWith('/stages')||String(input).endsWith('/locations'))?Promise.resolve(new Response(JSON.stringify({error:{message:'Временно недоступно'}}),{status:503})):original(input,init)));
 render(<Content raceId={1}/>);await userEvent.click(await screen.findByRole('button',{name:event.title}));await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));expect(await screen.findByText('Дождитесь загрузки этапов и локаций перед сохранением.')).toBeVisible();expect(api.writes).toHaveLength(0);ready=true;fireEvent(window,new Event('admin:changed'));await waitFor(()=>expect(screen.getByLabelText('Локация события')).toHaveValue('1'));expect(screen.getByLabelText('Этап материала')).toHaveValue('1');await userEvent.click(screen.getByRole('button',{name:'Сохранить материал'}));await screen.findByText('Сохранено');expect(api.writes[0].body).toMatchObject({stage_id:1,location_id:1});
});
