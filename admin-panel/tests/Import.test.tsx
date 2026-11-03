import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {CsvImport} from '../src/pages/Results';
afterEach(()=>vi.unstubAllGlobals());
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
