import {afterEach,expect,it,vi} from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import {storyLink,supportsStories,sendStory,withDeadline} from '../src/api/story';
const images={background:'data:image/png;base64,YmFjaw==',sticker:'data:image/png;base64,bGluaw=='};
afterEach(()=>vi.useRealTimers());
it('keeps only public VK destinations and strips launch parameters',()=>{
 expect(storyLink('https://vk.com/app12345?sign=secret#race=10&participant=9001')).toBe('https://vk.com/app12345#race=10&participant=9001');
 expect(storyLink('https://vk.ru/wall-1_2')).toBe('https://vk.ru/wall-1_2');
 for(const url of ['http://vk.com/app1','https://vk.com.evil.org/app1','http://localhost:5185/#race=1','javascript:alert(1)','bad','https://vk.com/app0','https://vk.com/'])expect(storyLink(url)).toBeUndefined();
});
it('requires embedded VK and a supported method; failed capability checks are unavailable',async()=>{
 vi.spyOn(bridge,'isEmbedded').mockReturnValue(false);const supports=vi.spyOn(bridge,'supportsAsync').mockResolvedValue(true);
 expect(await supportsStories(new AbortController().signal)).toBe(false);expect(supports).not.toHaveBeenCalled();
 vi.mocked(bridge.isEmbedded).mockReturnValue(true);expect(await supportsStories(new AbortController().signal)).toBe(true);
 supports.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('unavailable'));expect(await supportsStories(new AbortController().signal)).toBe(false);expect(await supportsStories(new AbortController().signal)).toBe(false);
});
it('sends a clickable sticker with the clean link and never calls wall/share',async()=>{
 const send=vi.spyOn(bridge,'send').mockResolvedValue({result:true});
 expect(await sendStory(images,'https://vk.com/app12345#participant=9001',new AbortController().signal)).toBe('sent');
 expect(send).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledWith('VKWebAppShowStoryBox',expect.objectContaining({background_type:'image',blob:images.background,stickers:[expect.objectContaining({sticker_type:'renderable',sticker:expect.objectContaining({blob:images.sticker,clickable_zones:[expect.objectContaining({action_type:'link',action:{link:'https://vk.com/app12345#participant=9001',tooltip_text_key:'tooltip_open_page'}})]})})]}));
});
it('treats user denial as cancellation, rejects real failures and invalid destinations',async()=>{
 vi.spyOn(bridge,'send').mockRejectedValueOnce({error_data:{error_code:4}}).mockRejectedValueOnce(new Error('network'));
 expect(await sendStory(images,'https://vk.com/wall-1_1',new AbortController().signal)).toBe('cancelled');
 await expect(sendStory(images,'https://vk.com/wall-1_1',new AbortController().signal)).rejects.toThrow('network');
 await expect(sendStory(images,'https://evil.org/',new AbortController().signal)).rejects.toThrow('Ссылка');
});
it('bounds an unanswered editor, ignores its late result and allows a fresh attempt',async()=>{
 vi.useFakeTimers();let finish!:(value:{result:true})=>void;const send=vi.spyOn(bridge,'send').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const first=sendStory(images,'https://vk.com/app12345',new AbortController().signal);const rejected=expect(first).rejects.toThrow('VK не подтвердил завершение');
 await vi.advanceTimersByTimeAsync(60000);await rejected;finish({result:true});send.mockResolvedValueOnce({result:true});expect(await sendStory(images,'https://vk.com/app12345',new AbortController().signal)).toBe('sent');expect(vi.getTimerCount()).toBe(0);
});
it('clears deadlines on abort, resolution, rejection and already-aborted signals',async()=>{
 vi.useFakeTimers();const controller=new AbortController();const pending=withDeadline(new Promise(()=>{}),10000,controller.signal,'timeout');const rejected=expect(pending).rejects.toHaveProperty('name','AbortError');controller.abort();await rejected;
 await expect(withDeadline(Promise.resolve('ok'),10,new AbortController().signal,'timeout')).resolves.toBe('ok');
 await expect(withDeadline(Promise.reject(new Error('failed')),10,new AbortController().signal,'timeout')).rejects.toThrow('failed');
 await expect(withDeadline(Promise.resolve('late'),10,controller.signal,'timeout')).rejects.toHaveProperty('name','AbortError');expect(vi.getTimerCount()).toBe(0);
});

it('requires positive host acknowledgement instead of claiming a failed opening succeeded',async()=>{
 vi.spyOn(bridge,'send').mockResolvedValue({result:false});
 await expect(sendStory(images,'https://vk.com/app12345',new AbortController().signal)).rejects.toThrow('VK не подтвердил открытие редактора');
});
