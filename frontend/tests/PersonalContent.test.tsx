import {render,screen,waitFor,within,fireEvent,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import {AppProviders} from '../src/app/AppProviders';
import {ProfileScreen} from '../src/screens/Content/ProfileScreen';
import {MediaScreen,BookmarkButton} from '../src/screens/Content/MediaScreen';
import {SupportAction,NotificationToggle} from '../src/components/ParticipantActions';
import {fixtureResponse,participant,discipline} from './fixtures';
import {news,photos} from '../src/stories/contentFixtures';
import type {Bookmark,MySupport} from '../src/types/content';
vi.mock('@vkontakte/vk-bridge',()=>({default:{isEmbedded:vi.fn(()=>true),send:vi.fn().mockResolvedValue({result:true})}}));
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();history.replaceState(null,'','/');});
const support:MySupport={race_id:10,race_participant_id:9001,start_number:14,full_name:participant.full_name,photo_url:null,discipline,notifications_enabled:true,supported_since:'2026-11-03T00:00Z'};
const bookmark:Bookmark={kind:'photo',item_id:'p1',title:null,url:'https://vk.com/photo-1_1',image_url:null,created_at:'2026-11-03T00:00Z'};
function personalApi(initialSupports:MySupport[]=[support],initialBookmarks:Bookmark[]=[]) {
 let supports=initialSupports;let bookmarks=initialBookmarks;const writes:{path:string;method:string;body:unknown}[]=[];
 const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const path=String(input).replace('/api','');const method=init?.method??'GET';let data;
  if(method!=='GET') {const body=init?.body?JSON.parse(String(init.body)):undefined;writes.push({path,method,body});
   if(path==='/me/visit')data={vk_user_id:42};
   else if(path==='/me/notifications')data={notifications_allowed:body.allowed};
   else if(path==='/me/bookmarks'){const saved={...body,created_at:'2026-11-03T00:00Z'};bookmarks=[saved];data=saved;}
   else if(path.startsWith('/me/bookmarks/')){bookmarks=[];data={deleted:1};}
   else if(path.startsWith('/me/supports?')){supports=[];data={cancelled:1};}
   else {supports=method==='DELETE'?[]:[{...support,notifications_enabled:body?.notifications_enabled??true}];data={race_participant_id:9001,supporters_count:supports.length,change_24h:0,is_supported:!!supports.length,notifications_enabled:supports[0]?.notifications_enabled??false};}
  } else data=path==='/me/bookmarks'?bookmarks:path==='/me/supports'?supports:path.includes('/support-rating')?[{...participant,rank:1,change_24h:2},{...participant,race_participant_id:9002,full_name:'Второй участник',rank:2,change_24h:-1}]:path.startsWith('/news')?{...news,total:21}:path==='/photos'?{...photos,days:[{...photos.days[0],photos:[...photos.days[0].photos,{...photos.days[0].photos[0],id:'p2',text:null}]}]}:fixtureResponse(path);
  return new Response(JSON.stringify({data,error:null}));
 });vi.stubGlobal('fetch',fetcher);return {fetcher,writes};
}
const click=(name:string)=>userEvent.click(screen.getByRole('button',{name}));
it('loads the server profile, manages participant/global notifications and clears seasonal support',async()=>{
 history.replaceState(null,'','/?vk_are_notifications_enabled=1');const {writes}=personalApi([support],[bookmark,{...bookmark,kind:'news',item_id:'n1'},{...bookmark,item_id:'p3',title:'Сохранённый снимок'}]);render(<AppProviders><ProfileScreen raceId={10}/></AppProviders>);expect(screen.getByText('Проверяем вход…')).toBeVisible();await screen.findByText('Вы вошли через VK · 42');expect(await screen.findByText('Сохранённый снимок')).toBeVisible();expect(screen.getByRole('heading',{name:'Фото'})).toBeVisible();expect(screen.getByRole('heading',{name:'Новость'})).toBeVisible();
 await userEvent.click(screen.getByRole('button',{name:'Отключить уведомления',pressed:true}));await waitFor(()=>expect(writes.some(w=>w.method==='PATCH'&&w.path==='/me/supports/9001')).toBe(true));await click('Отключить уведомления');expect(await screen.findByRole('button',{name:'Разрешить уведомления'})).toBeVisible();expect(bridge.send).toHaveBeenCalledWith('VKWebAppDenyNotifications');await click('Включить уведомления');await waitFor(()=>expect(writes.filter(w=>w.path==='/me/notifications')).toHaveLength(2));expect(bridge.send).toHaveBeenCalledWith('VKWebAppAllowNotifications');
 await click('Карточка участника');expect(location.hash).toBe('#race=10&participant=9001');await click('Второй участник · №14');expect(location.hash).toBe('#race=10&participant=9002');await click('Отменить поддержку всех в сезоне');expect(await screen.findByText('Вы пока ни за кого не болеете.')).toBeVisible();expect(writes).toContainEqual({path:'/me/supports?race_id=10',method:'DELETE',body:undefined});
});
it('saves and removes media bookmarks through confirmed server writes and never persists them on disk',async()=>{
 const {writes}=personalApi([],[]);render(<AppProviders><MediaScreen/></AppProviders>);const card=(await screen.findByRole('heading',{name:'Новости гонки'})).closest('article')!;const button=within(card).getByRole('button',{name:'Сохранить'});await waitFor(()=>expect(button).toBeEnabled());await userEvent.click(button);await within(card).findByRole('button',{name:'Убрать из сохранённого'});expect(writes.find(w=>w.path==='/me/bookmarks')).toMatchObject({method:'PUT',body:{kind:'news',item_id:'-1_1'}});await userEvent.click(within(card).getByRole('button',{name:'Убрать из сохранённого'}));await within(card).findByRole('button',{name:'Сохранить'});expect(writes.some(w=>w.method==='DELETE'&&w.path==='/me/bookmarks/news/-1_1')).toBe(true);expect(Object.keys(localStorage).some(key=>key.includes('bookmarks'))).toBe(false);
 await click('Открыть фото: Фото гонки');expect(await screen.findByRole('dialog',{name:'Фото гонки'})).toBeVisible();await click('Закрыть фото');await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Фото гонки'})).not.toBeInTheDocument());await click('Открыть фото: p2');expect(await screen.findByRole('dialog',{name:'Фото гонки'})).toHaveTextContent('Фото гонки');await click('Закрыть фото');await click('Следующие');await screen.findByRole('button',{name:'Предыдущие'});await click('Предыдущие');await waitFor(()=>expect(screen.queryByRole('button',{name:'Предыдущие'})).not.toBeInTheDocument());
});
it('shares news using VK and shows cancelled/rejected share errors without claiming success',async()=>{
 personalApi();render(<AppProviders><MediaScreen/></AppProviders>);await screen.findByRole('button',{name:'Репост'});vi.mocked(bridge.send).mockRejectedValueOnce(new Error('Репост отменён'));await click('Репост');expect(await screen.findByRole('alert')).toHaveTextContent('Репост отменён');await click('Репост');expect(await screen.findByText('Запись отправлена в VK')).toBeVisible();expect(bridge.send).toHaveBeenCalledWith('VKWebAppShowWallPostBox',{attachments:'wall-1_1'});vi.mocked(bridge.isEmbedded).mockReturnValueOnce(false);await click('Репост');expect(await screen.findByText(/Ссылка/)).toBeVisible();
});
it('keeps guest public content available and explains why personal actions require VK',async()=>{
 const fetcher=vi.fn(async(input:string)=>input.includes('/me/visit')?new Response(JSON.stringify({error:{message:'Войдите через VK'}}),{status:401}):new Response(JSON.stringify({data:fixtureResponse(input)})));vi.stubGlobal('fetch',fetcher);render(<AppProviders><ProfileScreen raceId={10}/><BookmarkButton item={bookmark}/><SupportAction raceId={10} entryId={9001} number={14}/></AppProviders>);await screen.findByText('Войдите через VK');await click('Проверить вход');await click('Сохранить');expect(await screen.findByText('Откройте приложение во ВКонтакте, чтобы сохранить материал')).toBeVisible();await click('Болею за');expect(await screen.findByText('Откройте приложение во ВКонтакте, чтобы болеть за участника')).toBeVisible();expect(await screen.findByText('Поддержите первого участника.')).toBeVisible();expect(fetcher.mock.calls.filter(([path])=>path.includes('/me/visit'))).toHaveLength(2);
});
it('keeps support after denied notification permission, then allows explicit cancellation',async()=>{
 personalApi([],[]);render(<AppProviders><SupportAction raceId={10} entryId={9001} number={14}/><NotificationToggle raceId={10} entryId={9001}/></AppProviders>);const button=screen.getByRole('button',{name:'Болею за'});await waitFor(()=>expect(button).toBeEnabled());await click('Болею за');const dialog=await screen.findByRole('dialog');vi.mocked(bridge.send).mockResolvedValueOnce({result:false});await userEvent.click(within(dialog).getByRole('button',{name:'Да, уведомлять'}));await screen.findByText('Разрешение не подтверждено');await userEvent.click(within(dialog).getByRole('button',{name:/Позже/}));await click('Вы болеете');await waitFor(()=>expect(screen.getByRole('button',{name:'Болею за'})).toBeVisible());
});
it('clears personalized content when the VK user changes while public content remains accessible',async()=>{
 personalApi([support],[bookmark]);render(<AppProviders><ProfileScreen raceId={10}/></AppProviders>);await screen.findByText('Вы вошли через VK · 42');await screen.findByRole('heading',{name:'Фото'});vi.stubGlobal('fetch',vi.fn(async(input:string)=>new Response(JSON.stringify({data:input.includes('/me/visit')?{vk_user_id:99}:input.includes('/me/')?[]:fixtureResponse(input)}))));act(()=>{history.replaceState(null,'','/?vk_user_id=99');fireEvent(window,new PopStateEvent('popstate'));});await screen.findByText('Вы вошли через VK · 99');expect(screen.queryByRole('heading',{name:'Фото'})).not.toBeInTheDocument();expect(await screen.findByText('Сохранённых материалов пока нет.')).toBeVisible();
});
