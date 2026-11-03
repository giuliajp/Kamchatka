import {act,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {api,save,storeToken,tokenKey,useAction,useResource,downloadStats} from '../src/api';
import {Failure,LoadState} from '../src/ui';
afterEach(()=>{vi.unstubAllGlobals();sessionStorage.clear();});
it('rejects malformed envelopes and preserves structured server error details',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response('not-json')).mockResolvedValueOnce(new Response('null')).mockResolvedValueOnce(new Response(JSON.stringify({data:3,error:null}))).mockResolvedValueOnce(new Response(JSON.stringify({data:null,error:{code:'validation_error',message:'Ошибка строки',details:['Строка 3: неизвестный участник']}}),{status:422}));vi.stubGlobal('fetch',fetcher);
 await expect(api('/admin/me')).rejects.toThrow('Сервер вернул некорректный ответ');await expect(api('/admin/me')).rejects.toThrow('Ответ сервера не соответствует формату');await expect(api('/admin/me')).rejects.toThrow('Ответ сервера не соответствует формату');await expect(save('/admin/races/1/protocol-import','POST',new FormData())).rejects.toMatchObject({status:422,code:'validation_error',details:['Строка 3: неизвестный участник']});
});
it('expires a rejected token and does not send Authorization after sign out',async()=>{
 storeToken('expired');const expired=vi.fn();window.addEventListener('admin:expired',expired);const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{message:'Войдите'},data:null}),{status:401})).mockResolvedValueOnce(new Response(JSON.stringify({data:{id:1,login:'a',full_name:'A'},error:null})));vi.stubGlobal('fetch',fetcher);
 await expect(api('/admin/me')).rejects.toThrow('Войдите');expect(expired).toHaveBeenCalledOnce();expect(sessionStorage.getItem(tokenKey)).toBeNull();await api('/admin/me');expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty('Authorization');window.removeEventListener('admin:expired',expired);
});
function Probe({path}:{path:string|null}){const resource=useResource<string[]>(path);return <><LoadState resource={resource}/><output>{resource.data?.join(',')}</output></>;}
it('keeps successful data during reload failures, retries explicitly and ignores cancelled responses',async()=>{
 let finish!:(value:Response)=>void;const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data:['old'],error:null}))).mockRejectedValueOnce(new Error('Offline')).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetcher);const {rerender}=render(<Probe path="/admin/example"/>);await screen.findByText('old');act(()=>window.dispatchEvent(new Event('admin:changed')));expect(await screen.findByRole('alert')).toHaveTextContent('Offline');expect(screen.getByText('old')).toBeVisible();await userEvent.click(screen.getByRole('button',{name:'Повторить загрузку'}));rerender(<Probe path={null}/>);await act(async()=>finish(new Response(JSON.stringify({data:['late'],error:null}))));expect(screen.queryByText('late')).not.toBeInTheDocument();
});
function Action({operation}:{operation:()=>Promise<unknown>}){const action=useAction();return <><button onClick={()=>{void action.run(operation);void action.run(operation);}}>Save</button><Failure error={action.error}/>{action.done&&<output>Done</output>}</>;}
it('blocks duplicate clicks and surfaces a non-Error rejection',async()=>{const operation=vi.fn().mockRejectedValue('bad');render(<Action operation={operation}/>);await userEvent.click(screen.getByText('Save'));expect(operation).toHaveBeenCalledOnce();expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить действие');});
it('downloads CSV with the current Bearer token and reports failure',async()=>{
 storeToken('t');const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});URL.createObjectURL=vi.fn().mockReturnValue('blob:test');URL.revokeObjectURL=vi.fn();const fetcher=vi.fn().mockResolvedValueOnce(new Response('date;count')).mockResolvedValueOnce(new Response('',{status:401})).mockResolvedValueOnce(new Response('',{status:503}));vi.stubGlobal('fetch',fetcher);
 await downloadStats(1,14);expect(click).toHaveBeenCalledOnce();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');expect(fetcher).toHaveBeenCalledWith('/api/admin/races/1/support-stats.csv?days=14',{headers:{Authorization:'Bearer t'}});await expect(downloadStats(1,14)).rejects.toMatchObject({status:401});expect(sessionStorage.getItem(tokenKey)).toBeNull();await expect(downloadStats(1,14)).rejects.toMatchObject({status:503});
});
it('polls and cleans up when unmounted',async()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[],error:null}))));function Poll(){useResource('/admin/example',1000);return null;}const {unmount}=render(<Poll/>);await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});expect(fetch).toHaveBeenCalledTimes(2);unmount();await vi.advanceTimersByTimeAsync(1000);expect(fetch).toHaveBeenCalledTimes(2);vi.useRealTimers();});

it('ignores a rejected request after its view has been cancelled',async()=>{
 let reject!:(reason:Error)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise((_resolve,fail)=>{reject=fail;})));const {rerender}=render(<Probe path="/admin/example"/>);rerender(<Probe path={null}/>);await act(async()=>reject(new Error('Cancelled transport')));expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
