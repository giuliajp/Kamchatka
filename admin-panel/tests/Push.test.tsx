import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {PushPage} from '../src/pages/Push';
afterEach(()=>vi.unstubAllGlobals());
it('confirms once, displays actual delivery failures and does not retry sending',async()=>{
 const fetcher=vi.fn(async(_url:string,init?:RequestInit)=>new Response(JSON.stringify({data:init?.method==='POST'?{id:1,segment:'all',message:'Начало гонки',fragment:'map',trigger:'manual',recipients:5,delivered:0,error:'VK недоступен',created_by:'Судья',created_at:'2026-11-03T00:00Z'}:[],error:null})));
 vi.stubGlobal('fetch',fetcher);const confirm=vi.spyOn(window,'confirm').mockReturnValueOnce(false).mockReturnValue(true);render(<PushPage raceId={10}/>);
 await userEvent.type(screen.getByLabelText('Сообщение'),'Начало гонки');await userEvent.click(screen.getByRole('button',{name:'Отправить push'}));expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
 await userEvent.click(screen.getByRole('button',{name:'Отправить push'}));expect(await screen.findByRole('alert')).toHaveTextContent('VK недоступен');expect(screen.getByText('Доставлено: 0 из 5')).toBeVisible();expect(confirm).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
});
