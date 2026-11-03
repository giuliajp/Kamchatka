import {act,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import {App} from '../src/App';
import {mockApi,race} from './fixtures';
import {externalUrl} from '../src/api/links';
import {shareRace,raceLink,resolveParticipantLink} from '../src/api/navigation';
afterEach(()=>{vi.unstubAllGlobals();history.replaceState(null,'','/');localStorage.clear();});
it('initializes VK, follows its appearance events and removes the listener on unmount',async()=>{
 mockApi(()=>({...race,stages:[]}));vi.spyOn(bridge,'isEmbedded').mockReturnValue(true);vi.spyOn(bridge,'send').mockRejectedValue(new Error('Init unavailable'));let update!:Parameters<typeof bridge.subscribe>[0];vi.spyOn(bridge,'subscribe').mockImplementation(fn=>{update=fn;});const unsubscribe=vi.spyOn(bridge,'unsubscribe').mockImplementation(()=>{});const {unmount}=render(<App/>);const heading=await screen.findByRole('heading',{name:race.name});expect(bridge.send).toHaveBeenCalledWith('VKWebAppInit');act(()=>update({detail:{type:'VKWebAppUpdateConfig',data:{appearance:'dark'}}} as Parameters<typeof update>[0]));expect(heading.closest('.vkui--vkBase--dark')).not.toBeNull();act(()=>update({detail:{type:'VKWebAppUpdateConfig',data:{appearance:'light'}}} as Parameters<typeof update>[0]));expect(heading.closest('.vkui--vkBase--dark')).toBeNull();act(()=>update({detail:{type:'VKWebAppInitResult',data:{result:true}}} as Parameters<typeof update>[0]));unmount();expect(unsubscribe).toHaveBeenCalledWith(update);
});
it('shares only a clean app fragment and treats cancelled VK sharing as cancellation',async()=>{
 vi.spyOn(bridge,'isEmbedded').mockReturnValue(true);vi.spyOn(bridge,'send').mockResolvedValueOnce({result:true}).mockRejectedValueOnce(new Error('cancel'));history.replaceState(null,'','/?vk_app_id=12345&sign=private');const link=raceLink(10,undefined,501,9001);expect(link).toBe('https://vk.com/app12345#race=10&person=501&participant=9001');expect(await shareRace(link,'Авача')).toBe('Ссылка отправлена');expect(await shareRace(link,'Авача')).toBe('');
});
it('rejects unsafe or malformed external links',()=>{expect(externalUrl('javascript:alert(1)')).toBeUndefined();expect(externalUrl('not a url')).toBeUndefined();expect(externalUrl(null)).toBeUndefined();expect(externalUrl('https://vk.com/wall-1_1')).toBe('https://vk.com/wall-1_1');});
it('does not continue a participant search if it was cancelled while seasons loaded',async()=>{const controller=new AbortController();vi.stubGlobal('fetch',vi.fn(async()=>{controller.abort();return new Response(JSON.stringify({data:[race]}));}));expect(await resolveParticipantLink(1,controller.signal)).toBeUndefined();expect(fetch).toHaveBeenCalledOnce();});
