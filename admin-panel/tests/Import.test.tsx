import {act,fireEvent,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {CsvImport} from '../src/pages/Results';
afterEach(()=>vi.unstubAllGlobals());
it('ignores a late dry-run result after the file selection changes',async()=>{
 let finish!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn(()=>new Promise(resolve=>{finish=resolve;})));render(<CsvImport raceId={1}/>);const input=screen.getByLabelText('CSV из Excel');await userEvent.upload(input,new File(['one'],'one.csv',{type:'text/csv'}));await userEvent.click(screen.getByRole('button',{name:'Проверить'}));expect(input).toBeDisabled();fireEvent.change(input,{target:{files:[new File(['two'],'two.csv',{type:'text/csv'})]}});await act(async()=>finish(new Response(JSON.stringify({data:{rows:1,participants_created:0,results_created:1,results_updated:0,results_unchanged:0,penalties_changed:0,protocols_created:1,warnings:[],saved:false}}))));expect(screen.queryByText('Проверка завершена')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Загрузить'})).toBeDisabled();
});
it('requires dry-run, resets its report on replacing the file and saves separately',async()=>{
 const fetcher=vi.fn(async(_url:string,init:RequestInit)=>new Response(JSON.stringify({data:{rows:1,participants_created:0,results_created:1,results_updated:0,results_unchanged:0,penalties_changed:0,protocols_created:1,warnings:[],saved:(init.body as FormData).get('dry_run')==='false'},error:null})));
 vi.stubGlobal('fetch',fetcher);render(<CsvImport raceId={10}/>);
 const input=screen.getByLabelText('CSV из Excel');await userEvent.upload(input,new File(['csv'],'results.csv',{type:'text/csv'}));
 expect(screen.getByRole('button',{name:'Загрузить'})).toBeDisabled();
 await userEvent.click(screen.getByRole('button',{name:'Проверить'}));expect(await screen.findByText('Проверка завершена')).toBeVisible();
 expect((fetcher.mock.calls[0][1].body as FormData).get('dry_run')).toBe('true');
 await userEvent.upload(input,new File(['changed'],'new.csv',{type:'text/csv'}));expect(screen.getByRole('button',{name:'Загрузить'})).toBeDisabled();
 await userEvent.click(screen.getByRole('button',{name:'Проверить'}));await screen.findByText('Проверка завершена');await userEvent.click(screen.getByRole('button',{name:'Загрузить'}));
 expect(await screen.findByText('Протокол загружен')).toBeVisible();expect((fetcher.mock.calls.at(-1)![1].body as FormData).get('dry_run')).toBe('false');
});

it('invalidates an earlier successful check when a new dry-run reports row errors',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data:{rows:1,participants_created:0,results_created:1,results_updated:0,results_unchanged:0,penalties_changed:0,protocols_created:1,warnings:[],saved:false},error:null}))).mockResolvedValueOnce(new Response(JSON.stringify({data:null,error:{code:'validation_error',message:'Файл не загружен',details:['Строка 3: участник изменён']}}),{status:422}));vi.stubGlobal('fetch',fetcher);render(<CsvImport raceId={10}/>);await userEvent.upload(screen.getByLabelText('CSV из Excel'),new File(['csv'],'r.csv',{type:'text/csv'}));await userEvent.click(screen.getByRole('button',{name:'Проверить'}));await screen.findByText('Проверка завершена');await userEvent.click(screen.getByRole('button',{name:'Проверить'}));expect(await screen.findByRole('alert')).toHaveTextContent('Строка 3');expect(screen.getByRole('button',{name:'Загрузить'})).toBeDisabled();
});
