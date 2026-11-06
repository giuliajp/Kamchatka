import {render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import {AppProviders} from '../src/app/AppProviders';
import {ParticipantSheet} from '../src/components/ParticipantSheet';
import {TrackScreen} from '../src/screens/Content/TrackScreen';
import {MediaScreen} from '../src/screens/Content/MediaScreen';
import {createStoryImages} from '../src/api/storyImage';
import {fixtureResponse,mockApi,participant,race} from './fixtures';
import {news} from '../src/stories/contentFixtures';
vi.mock('../src/api/storyImage',async importOriginal=>({...await importOriginal<typeof import('../src/api/storyImage')>(),createStoryImages:vi.fn(async()=>({background:'data:image/png;base64,YQ==',sticker:'data:image/png;base64,Yg=='}))}));
vi.mock('../src/screens/Map/MapCanvas',()=>({MapCanvas:()=> <div>Карта трека</div>}));
beforeEach(()=>{
 history.replaceState(null,'','/?vk_app_id=12345&vk_user_id=42&sign=private');
 vi.spyOn(bridge,'isEmbedded').mockReturnValue(true);vi.spyOn(bridge,'supportsAsync').mockResolvedValue(true);vi.spyOn(bridge,'send').mockResolvedValue({result:true});
});
function destination(){const call=vi.mocked(bridge.send).mock.calls.find(([method])=>method==='VKWebAppShowStoryBox');return JSON.stringify(call);}
it('shares a participant story with identity and season while preserving the link action',async()=>{
 mockApi();render(<AppProviders><ParticipantSheet raceId={10} participantId={501} entryId={9001} threshold={45} onClose={()=>undefined}/></AppProviders>);
 await userEvent.click(await screen.findByRole('button',{name:'В историю VK'}));
 expect(await screen.findByRole('status')).toHaveTextContent('История передана в VK');expect(destination()).toContain('https://vk.com/app12345#race=10&person=501&participant=9001');expect(destination()).not.toContain('private');
 expect(createStoryImages).toHaveBeenCalledWith(expect.objectContaining({title:participant.full_name,heading:expect.stringContaining('2026'),lines:expect.arrayContaining([expect.stringContaining('14')])}));
 await userEvent.click(screen.getByRole('button',{name:'Поделиться участником'}));expect(bridge.send).toHaveBeenCalledWith('VKWebAppShare',{link:expect.stringContaining('participant=9001')});
});
it('shares the result with official race totals and a track route, including missing results',async()=>{
 mockApi(url=>url.endsWith('/participants')?[{...participant,total_time:null,place:null}]:fixtureResponse(url));
 render(<AppProviders><TrackScreen race={race} stageId={103} entryId={9001}/></AppProviders>);
 await userEvent.click(await screen.findByRole('button',{name:'В историю VK'}));await waitFor(()=>expect(destination()).toContain('view=track'));
 expect(destination()).toContain('stage=103');expect(createStoryImages).toHaveBeenCalledWith(expect.objectContaining({lines:expect.arrayContaining(['Итоговое время за гонку: —','Место в дисциплине: —'])}));
 await userEvent.click(screen.getByRole('button',{name:'Опубликовать результаты'}));expect(bridge.send).toHaveBeenCalledWith('VKWebAppShare',{link:expect.stringContaining('view=track')});
});
it('shares a news story with the original post and keeps wall repost separate',async()=>{
 mockApi(url=>url.includes('/news?')?news:fixtureResponse(url));render(<AppProviders><MediaScreen/></AppProviders>);
 await userEvent.click(await screen.findByRole('button',{name:'В историю VK'}));await waitFor(()=>expect(destination()).toContain('https://vk.com/wall-1_1'));
 expect(createStoryImages).toHaveBeenCalledWith(expect.objectContaining({title:news.items[0].title,lines:expect.arrayContaining([news.items[0].preview])}));
 expect(bridge.send).not.toHaveBeenCalledWith('VKWebAppShare',expect.anything());await userEvent.click(screen.getByRole('button',{name:'Репост'}));expect(bridge.send).toHaveBeenCalledWith('VKWebAppShowWallPostBox',{attachments:'wall-1_1'});
});
