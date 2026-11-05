import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import bridge from '@vkontakte/vk-bridge';
import {AppProviders} from '../src/app/AppProviders';
import {StoryShareButton} from '../src/components/StoryShareButton';
import {createStoryImages} from '../src/api/storyImage';
vi.mock('../src/api/storyImage',()=>({createStoryImages:vi.fn()}));
const card={heading:'Авача 2026',title:'Участник',lines:['№14'],action:'Открыть участника'};
const images={background:'data:image/png;base64,YQ==',sticker:'data:image/png;base64,Yg=='};
const show=(link='https://vk.com/app12345#race=10')=>render(<AppProviders><StoryShareButton card={card} link={link}/></AppProviders>);
beforeEach(()=>{vi.spyOn(bridge,'isEmbedded').mockReturnValue(true);vi.spyOn(bridge,'supportsAsync').mockResolvedValue(true);vi.spyOn(bridge,'send').mockResolvedValue({result:true});vi.mocked(createStoryImages).mockResolvedValue(images);});
afterEach(()=>vi.useRealTimers());
it('hides unavailable actions and local preview destinations',async()=>{
 vi.mocked(bridge.supportsAsync).mockResolvedValueOnce(false);const first=show();await act(async()=>{});expect(screen.queryByRole('button')).not.toBeInTheDocument();first.unmount();show('http://localhost:5185/#race=10');await act(async()=>{});expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('locks repeated clicks during preparation and permits sharing again after cancellation',async()=>{
 let finish!:(value:typeof images)=>void;vi.mocked(createStoryImages).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));vi.mocked(bridge.send).mockRejectedValueOnce({error_data:{error_code:4}});
 show();const button=await screen.findByRole('button',{name:'В историю VK'});act(()=>{button.click();button.click();});expect(createStoryImages).toHaveBeenCalledOnce();expect(button).toBeDisabled();
 await act(async()=>finish(images));await waitFor(()=>expect(button).toBeEnabled());expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.queryByRole('alert')).not.toBeInTheDocument();fireEvent.click(button);expect(await screen.findByRole('status')).toHaveTextContent('История передана в VK');
});
it.each([new Error('Изображение недоступно'),'failure'])('shows preparation failures and allows retry (%s)',async failure=>{
 vi.mocked(createStoryImages).mockRejectedValueOnce(failure);show();fireEvent.click(await screen.findByRole('button',{name:'В историю VK'}));expect(await screen.findByRole('alert')).toHaveTextContent(failure instanceof Error?failure.message:'Не удалось открыть историю VK');expect(bridge.send).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'В историю VK'}));expect(await screen.findByRole('status')).toBeVisible();expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('times out preparation without sending a late image to VK',async()=>{
 show();const button=await screen.findByRole('button',{name:'В историю VK'});let finish!:(value:typeof images)=>void;vi.mocked(createStoryImages).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));vi.useFakeTimers();fireEvent.click(button);await act(async()=>{await vi.advanceTimersByTimeAsync(10000);});expect(screen.getByRole('alert')).toHaveTextContent('10 секунд');await act(async()=>finish(images));expect(bridge.send).not.toHaveBeenCalled();expect(button).toBeEnabled();
});
it('aborts preparation and the host wait on unmount without late feedback',async()=>{
 let finish!:(value:typeof images)=>void;vi.mocked(createStoryImages).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));const view=show();fireEvent.click(await screen.findByRole('button',{name:'В историю VK'}));view.unmount();await act(async()=>finish(images));expect(bridge.send).not.toHaveBeenCalled();
 let answer!:(value:{result:true})=>void;vi.mocked(bridge.send).mockImplementationOnce(()=>new Promise(resolve=>{answer=resolve;}));const second=show();fireEvent.click(await screen.findByRole('button',{name:'В историю VK'}));await waitFor(()=>expect(bridge.send).toHaveBeenCalledOnce());second.unmount();await act(async()=>answer({result:true}));expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('ignores a capability response after unmount',async()=>{
 let answer!:(value:boolean)=>void;vi.mocked(bridge.supportsAsync).mockImplementationOnce(()=>new Promise(resolve=>{answer=resolve;}));const view=show();view.unmount();await act(async()=>answer(true));expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('cancels the old preparation when the destination changes and keeps the new attempt independent',async()=>{
 let finish!:(value:typeof images)=>void;vi.mocked(createStoryImages).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const view=show();fireEvent.click(await screen.findByRole('button',{name:'В историю VK'}));
 view.rerender(<AppProviders><StoryShareButton card={card} link="https://vk.com/app12345#race=11"/></AppProviders>);
 const button=await screen.findByRole('button',{name:'В историю VK'});await act(async()=>finish(images));expect(bridge.send).not.toHaveBeenCalled();fireEvent.click(button);expect(await screen.findByRole('status')).toBeVisible();expect(bridge.send).toHaveBeenCalledWith('VKWebAppShowStoryBox',expect.objectContaining({stickers:expect.arrayContaining([expect.objectContaining({sticker:expect.objectContaining({clickable_zones:expect.arrayContaining([expect.objectContaining({action:expect.objectContaining({link:'https://vk.com/app12345#race=11'})})])})})])}));
});
